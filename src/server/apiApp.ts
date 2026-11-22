import express, { type Express, type Request, type Response } from 'express';
import path from 'node:path';
import { Readable } from 'node:stream';
import zlib from 'node:zlib';
import tarStream from 'tar-stream';
import {
  detectLanguage,
  extractExtension,
  isBinaryExtension,
} from '../lib/languageMap.ts';
import type {
  AnalyzedFile,
  AnalysisResult,
  CodeHealthMetrics,
  CommitActivitySummary,
  HistoricalLanguageSnapshot,
  LanguageStat,
  RepoMetadata,
  StreamEvent,
  WeeklyCommitBucket,
} from '../lib/types.ts';

const MAX_ARCHIVE_BYTES = 250 * 1024 * 1024; // 250 MB compressed archive cap
const MAX_SINGLE_FILE_BYTES = 5 * 1024 * 1024; // 5 MB single text file cap
const MAX_RETURNED_FILES = 15000;

interface ParsedRepoRef {
  owner: string;
  repo: string;
  branch?: string;
}

const VALID_SEGMENT_RE = /^[a-zA-Z0-9._-]+$/;
const VALID_BRANCH_RE = /^[a-zA-Z0-9._/-]+$/;

function parseGitHubInput(rawInput: string): ParsedRepoRef | null {
  const trimmed = rawInput.trim();
  if (!trimmed || trimmed.length > 300) {
    return null;
  }

  // Support shorthand: owner/repo
  if (!trimmed.includes('://') && !trimmed.startsWith('github.com')) {
    const clean = trimmed.replace(/^\/+|\/+$/g, '').replace(/\.git$/i, '');
    const parts = clean.split('/');
    if (parts.length === 2) {
      const [owner, repo] = parts;
      if (
        owner &&
        repo &&
        owner !== '.' &&
        owner !== '..' &&
        repo !== '.' &&
        repo !== '..' &&
        VALID_SEGMENT_RE.test(owner) &&
        VALID_SEGMENT_RE.test(repo)
      ) {
        return { owner, repo };
      }
    }
    return null;
  }

  const withScheme = trimmed.startsWith('github.com')
    ? `https://${trimmed}`
    : trimmed;

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (host !== 'github.com' && host !== 'www.github.com') {
    return null;
  }

  const segments = parsed.pathname
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length < 2) {
    return null;
  }

  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, '');

  if (
    !owner ||
    !repo ||
    owner === '.' ||
    owner === '..' ||
    repo === '.' ||
    repo === '..' ||
    !VALID_SEGMENT_RE.test(owner) ||
    !VALID_SEGMENT_RE.test(repo)
  ) {
    return null;
  }

  let branch: string | undefined;
  if (segments.length >= 4 && segments[2] === 'tree') {
    const candidate = decodeURIComponent(segments.slice(3).join('/'));
    if (
      candidate &&
      !candidate.includes('..') &&
      VALID_BRANCH_RE.test(candidate)
    ) {
      branch = candidate;
    }
  }

  return { owner, repo, branch };
}

function sendSse(res: Response, event: StreamEvent): void {
  if (res.writableEnded || res.destroyed) return;
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function buildGitHubHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': 'CodeGauge-Repository-Analyzer/1.0',
    Accept: 'application/vnd.github+json',
  };
  const token = process.env.GITHUB_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function fetchOpenPullRequestCount(
  safeOwner: string,
  safeRepo: string,
  signal: AbortSignal
): Promise<number | null> {
  try {
    const url = `https://api.github.com/repos/${safeOwner}/${safeRepo}/pulls?state=open&per_page=1`;
    const resp = await fetch(url, {
      signal,
      headers: buildGitHubHeaders(),
    });
    if (!resp.ok) return null;

    const linkHeader = resp.headers.get('link');
    if (linkHeader) {
      const lastMatch = linkHeader.match(/[?&]page=(\d+)[^>]*>;\s*rel="last"/i);
      if (lastMatch && lastMatch[1]) {
        const count = Number(lastMatch[1]);
        if (Number.isFinite(count) && count >= 0) return count;
      }
    }

    const items = (await resp.json()) as unknown[];
    return Array.isArray(items) ? items.length : null;
  } catch {
    return null;
  }
}

interface CommitRef {
  sha: string;
  date: string;
}

interface CommitActivityFetchResult {
  activity: CommitActivitySummary | null;
  latestSha: string | null;
  oneMonthAgoRef: CommitRef | null;
}

const VALID_SHA_RE = /^[a-f0-9]{7,40}$/i;

async function fetchCommitActivity(
  safeOwner: string,
  safeRepo: string,
  branch: string,
  signal: AbortSignal
): Promise<CommitActivityFetchResult> {
  try {
    const encodedBranch = encodeURIComponent(branch);
    const url = `https://api.github.com/repos/${safeOwner}/${safeRepo}/commits?sha=${encodedBranch}&per_page=100`;
    const resp = await fetch(url, {
      signal,
      headers: buildGitHubHeaders(),
    });
    if (!resp.ok) {
      return { activity: null, latestSha: null, oneMonthAgoRef: null };
    }

    const commits = (await resp.json()) as Array<{
      sha?: string;
      commit?: {
        author?: { date?: string };
        committer?: { date?: string };
      };
    }>;

    if (!Array.isArray(commits) || commits.length === 0) {
      return {
        activity: {
          lastCommitAt: null,
          commitsLast30Days: 0,
          commitsLast30DaysCapped: false,
          commitsPerWeek: 0,
          sampledCommits: 0,
          weeklyBuckets: [],
        },
        latestSha: null,
        oneMonthAgoRef: null,
      };
    }

    const timestamps: number[] = [];
    let lastCommitAt: string | null = null;
    const latestSha =
      commits[0]?.sha && VALID_SHA_RE.test(commits[0].sha)
        ? commits[0].sha
        : null;

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now - 30 * dayMs;
    let oneMonthAgoRef: CommitRef | null = null;

    for (const entry of commits) {
      const dateStr =
        entry.commit?.author?.date ?? entry.commit?.committer?.date ?? null;
      if (!dateStr) continue;
      if (!lastCommitAt) lastCommitAt = dateStr;
      const ms = Date.parse(dateStr);
      if (Number.isFinite(ms)) {
        timestamps.push(ms);
        if (
          !oneMonthAgoRef &&
          ms <= thirtyDaysAgo &&
          entry.sha &&
          VALID_SHA_RE.test(entry.sha)
        ) {
          oneMonthAgoRef = { sha: entry.sha, date: dateStr };
        }
      }
    }

    // If all 100 sampled commits were within the last 30 days, query 1 commit <= 30d ago
    if (!oneMonthAgoRef && commits.length >= 100) {
      try {
        const untilIso = new Date(thirtyDaysAgo).toISOString();
        const histUrl = `https://api.github.com/repos/${safeOwner}/${safeRepo}/commits?sha=${encodedBranch}&until=${encodeURIComponent(
          untilIso
        )}&per_page=1`;
        const histResp = await fetch(histUrl, {
          signal,
          headers: buildGitHubHeaders(),
        });
        if (histResp.ok) {
          const histCommits = (await histResp.json()) as Array<{
            sha?: string;
            commit?: {
              author?: { date?: string };
              committer?: { date?: string };
            };
          }>;
          const first = histCommits[0];
          const histDate =
            first?.commit?.author?.date ?? first?.commit?.committer?.date;
          if (first?.sha && VALID_SHA_RE.test(first.sha) && histDate) {
            oneMonthAgoRef = { sha: first.sha, date: histDate };
          }
        }
      } catch {
        // Optional historical commit lookup failed; continue gracefully
      }
    }

    if (timestamps.length === 0) {
      return { activity: null, latestSha, oneMonthAgoRef };
    }

    const commitsLast30Days = timestamps.filter((t) => t >= thirtyDaysAgo).length;
    const commitsLast30DaysCapped =
      commits.length >= 100 && commitsLast30Days === commits.length;

    const oldestTs = Math.min(...timestamps);
    const spanWeeks = Math.max(1, (now - oldestTs) / (7 * dayMs));
    const commitsPerWeek = Number((timestamps.length / spanWeeks).toFixed(1));

    const bucketCount = 8;
    const weekMs = 7 * dayMs;
    const buckets: WeeklyCommitBucket[] = [];

    for (let i = bucketCount - 1; i >= 0; i--) {
      const bucketEnd = now - i * weekMs;
      const bucketStart = bucketEnd - weekMs;
      const count = timestamps.filter(
        (t) => t > bucketStart && t <= bucketEnd
      ).length;
      const startDate = new Date(bucketStart + dayMs);
      const label = `${startDate.getUTCMonth() + 1}/${startDate.getUTCDate()}`;
      buckets.push({ label, commits: count });
    }

    return {
      activity: {
        lastCommitAt,
        commitsLast30Days,
        commitsLast30DaysCapped,
        commitsPerWeek,
        sampledCommits: timestamps.length,
        weeklyBuckets: buckets,
      },
      latestSha,
      oneMonthAgoRef,
    };
  } catch {
    return { activity: null, latestSha: null, oneMonthAgoRef: null };
  }
}

const MAX_HISTORICAL_ARCHIVE_BYTES = 50 * 1024 * 1024; // 50 MB cap for secondary historical pass

async function fetchOneMonthAgoLanguageSnapshot(
  owner: string,
  repo: string,
  oneMonthAgoRef: CommitRef,
  latestSha: string | null,
  currentLanguages: LanguageStat[],
  currentTotalLines: number,
  currentCodeLines: number,
  parentSignal: AbortSignal
): Promise<HistoricalLanguageSnapshot | null> {
  if (!VALID_SHA_RE.test(oneMonthAgoRef.sha)) return null;

  // If no commits occurred in the last 30 days, historical distribution equals current
  if (latestSha && oneMonthAgoRef.sha === latestSha) {
    return {
      snapshotCommitSha: oneMonthAgoRef.sha,
      snapshotDate: oneMonthAgoRef.date,
      totalLines: currentTotalLines,
      codeLines: currentCodeLines,
      languages: currentLanguages.slice(0, 12).map((item) => ({
        name: item.name,
        color: item.color,
        lines: item.lines,
        codeLines: item.codeLines,
        percentage: item.percentage,
      })),
    };
  }

  const histController = new AbortController();
  const onParentAbort = () => histController.abort();
  parentSignal.addEventListener('abort', onParentAbort, { once: true });
  const timeoutId = setTimeout(() => histController.abort(), 15000);

  try {
    const safeOwner = encodeURIComponent(owner);
    const safeRepo = encodeURIComponent(repo);
    const archiveUrl = `https://codeload.github.com/${safeOwner}/${safeRepo}/tar.gz/${encodeURIComponent(
      oneMonthAgoRef.sha
    )}`;

    const resp = await fetch(archiveUrl, {
      signal: histController.signal,
      headers: {
        'User-Agent': 'CodeGauge-Repository-Analyzer/1.0',
      },
      redirect: 'follow',
    });

    if (!resp.ok || !resp.body) return null;

    const contentLengthHeader = resp.headers.get('content-length');
    const headerBytes = contentLengthHeader ? Number(contentLengthHeader) : 0;
    if (headerBytes > MAX_HISTORICAL_ARCHIVE_BYTES) return null;

    let histBytes = 0;
    let histTotalLines = 0;
    let histCodeLines = 0;
    const histLangAgg = new Map<
      string,
      { name: string; color: string; lines: number; codeLines: number }
    >();

    const nodeStream = Readable.fromWeb(
      resp.body as unknown as import('node:stream/web').ReadableStream<Uint8Array>
    );
    const gunzip = zlib.createGunzip();
    const extract = tarStream.extract();

    extract.on('entry', (header, stream, next) => {
      if (header.type !== 'file') {
        stream.resume();
        next();
        return;
      }

      const slashIdx = header.name.indexOf('/');
      const relativePath = slashIdx >= 0 ? header.name.slice(slashIdx + 1) : header.name;
      if (!relativePath || relativePath.startsWith('.git/')) {
        stream.resume();
        next();
        return;
      }

      const fileName = path.posix.basename(relativePath);
      if (isBinaryExtension(fileName) || (header.size ?? 0) > MAX_SINGLE_FILE_BYTES) {
        stream.resume();
        next();
        return;
      }

      const chunks: Buffer[] = [];
      let readBytes = 0;
      let skipBinary = false;

      stream.on('data', (chunk: unknown) => {
        if (skipBinary) return;
        const buf = Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk as Uint8Array);
        readBytes += buf.length;
        if (readBytes > MAX_SINGLE_FILE_BYTES) {
          skipBinary = true;
          chunks.length = 0;
          return;
        }
        if (chunks.length === 0 && isLikelyBinaryBuffer(buf)) {
          skipBinary = true;
          chunks.length = 0;
          return;
        }
        chunks.push(buf);
      });

      stream.on('end', () => {
        if (skipBinary) {
          next();
          return;
        }
        const fullBuf = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
        const lang = detectLanguage(fileName);
        const counts = analyzeSourceBuffer(fullBuf, lang.name);

        histTotalLines += counts.lines;
        histCodeLines += counts.codeLines;

        const existing = histLangAgg.get(lang.name);
        if (existing) {
          existing.lines += counts.lines;
          existing.codeLines += counts.codeLines;
        } else {
          histLangAgg.set(lang.name, {
            name: lang.name,
            color: lang.color,
            lines: counts.lines,
            codeLines: counts.codeLines,
          });
        }
        next();
      });

      stream.on('error', () => next());
    });

    await new Promise<void>((resolve, reject) => {
      nodeStream.on('data', (chunk: Buffer) => {
        histBytes += chunk.length;
        if (histBytes > MAX_HISTORICAL_ARCHIVE_BYTES) {
          histController.abort();
          nodeStream.destroy();
          gunzip.destroy();
          extract.destroy();
          reject(new Error('HISTORICAL_ARCHIVE_TOO_LARGE'));
        }
      });
      nodeStream.on('error', reject);
      gunzip.on('error', reject);
      extract.on('error', reject);
      extract.on('finish', resolve);

      nodeStream.pipe(gunzip).pipe(extract);
    });

    const histLanguages = Array.from(histLangAgg.values())
      .map((item) => ({
        ...item,
        percentage:
          histTotalLines > 0
            ? Number(((item.lines / histTotalLines) * 100).toFixed(2))
            : 0,
      }))
      .sort((a, b) => b.lines - a.lines);

    return {
      snapshotCommitSha: oneMonthAgoRef.sha,
      snapshotDate: oneMonthAgoRef.date,
      totalLines: histTotalLines,
      codeLines: histCodeLines,
      languages: histLanguages.slice(0, 15),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
    parentSignal.removeEventListener('abort', onParentAbort);
  }
}

type CommentStyle = 'c' | 'hash' | 'dash' | 'apl' | 'html' | 'none';

const HASH_COMMENT_LANGUAGES = new Set([
  'Python',
  'Ruby',
  'Shell',
  'YAML',
  'TOML',
  'R',
  'R Markdown',
  'Julia',
  'Perl',
  'Elixir',
  'Nim',
  'Makefile',
  'Dockerfile',
  'HCL',
  'PowerShell',
  'Nix',
  'CMake',
  'Just',
  'Ignore List',
  'Git Config',
  'EditorConfig',
  'Config',
  'INI',
  'GraphQL',
]);

const DASH_COMMENT_LANGUAGES = new Set([
  'SQL',
  'Lua',
  'Haskell',
  'Ada',
  'VHDL',
]);

const HTML_COMMENT_LANGUAGES = new Set([
  'HTML',
  'XML',
  'SVG',
  'Vue',
  'Svelte',
  'Astro',
]);

const NON_COMMENT_LANGUAGES = new Set([
  'JSON',
  'Text',
  'CSV',
  'Markdown',
  'MDX',
  'reStructuredText',
  'Other',
]);

function getCommentStyle(languageName: string): CommentStyle {
  if (languageName === 'APL') return 'apl';
  if (HASH_COMMENT_LANGUAGES.has(languageName)) return 'hash';
  if (DASH_COMMENT_LANGUAGES.has(languageName)) return 'dash';
  if (HTML_COMMENT_LANGUAGES.has(languageName)) return 'html';
  if (NON_COMMENT_LANGUAGES.has(languageName)) return 'none';
  return 'c';
}

function analyzeSourceBuffer(
  buffer: Buffer,
  languageName: string
): {
  lines: number;
  codeLines: number;
  blankLines: number;
  commentLines: number;
  commentCapable: boolean;
} {
  if (buffer.length === 0) {
    return {
      lines: 0,
      codeLines: 0,
      blankLines: 0,
      commentLines: 0,
      commentCapable: false,
    };
  }

  const style = getCommentStyle(languageName);
  const commentCapable = style !== 'none';
  const text = buffer.toString('utf8');
  const rawLines = text.split('\n');
  const lines =
    rawLines.length > 1 && rawLines[rawLines.length - 1] === ''
      ? rawLines.length - 1
      : rawLines.length;

  let codeLines = 0;
  let blankLines = 0;
  let commentLines = 0;
  let inBlockComment = false;

  for (let i = 0; i < lines; i++) {
    const trimmed = rawLines[i].trim();
    if (trimmed.length === 0) {
      blankLines += 1;
      continue;
    }

    codeLines += 1;

    if (!commentCapable) continue;

    if (style === 'apl') {
      if (trimmed.startsWith('⍝')) {
        commentLines += 1;
      }
      continue;
    }

    if (style === 'hash') {
      if (trimmed.startsWith('#')) {
        commentLines += 1;
      }
      continue;
    }

    if (style === 'dash') {
      if (inBlockComment) {
        commentLines += 1;
        if (trimmed.includes('*/')) inBlockComment = false;
      } else if (trimmed.startsWith('--')) {
        commentLines += 1;
      } else if (trimmed.startsWith('/*')) {
        commentLines += 1;
        if (!trimmed.includes('*/')) inBlockComment = true;
      }
      continue;
    }

    if (style === 'html') {
      if (inBlockComment) {
        commentLines += 1;
        if (trimmed.includes('-->')) inBlockComment = false;
      } else if (trimmed.startsWith('<!--')) {
        commentLines += 1;
        if (!trimmed.includes('-->')) inBlockComment = true;
      }
      continue;
    }

    if (inBlockComment) {
      commentLines += 1;
      if (trimmed.includes('*/')) inBlockComment = false;
    } else if (
      trimmed.startsWith('//') ||
      (languageName === 'PHP' && trimmed.startsWith('#'))
    ) {
      commentLines += 1;
    } else if (trimmed.startsWith('/*')) {
      commentLines += 1;
      if (!trimmed.includes('*/')) inBlockComment = true;
    }
  }

  return {
    lines,
    codeLines,
    blankLines,
    commentLines,
    commentCapable,
  };
}

function computeCodeHealth(
  files: AnalyzedFile[],
  totalCommentLines: number,
  commentCapableLines: number,
  totalSizeBytes: number
): CodeHealthMetrics {
  const analyzedCount = files.length;
  const commentDataAvailable = commentCapableLines > 0;
  const commentRatioPct = commentDataAvailable
    ? Number(((totalCommentLines / commentCapableLines) * 100).toFixed(1))
    : 0;

  let commentScore = 35;
  if (commentDataAvailable) {
    if (commentRatioPct >= 10 && commentRatioPct <= 30) {
      commentScore = 50;
    } else if (commentRatioPct < 10) {
      commentScore = 15 + (commentRatioPct / 10) * 35;
    } else {
      commentScore = Math.max(25, 50 - ((commentRatioPct - 30) / 40) * 25);
    }
  }

  if (analyzedCount === 0) {
    return {
      score: 0,
      commentScore: 0,
      fileSizeScore: 0,
      commentLines: 0,
      commentCapableLines: 0,
      commentRatioPct: 0,
      commentDataAvailable: false,
      avgFileSizeBytes: 0,
      medianFileSizeBytes: 0,
      oversizedFilesCount: 0,
      healthySizeFilesPct: 100,
    };
  }

  const OVERSIZED_BYTES = 50 * 1024;
  const sizes = files.map((f) => f.sizeBytes).sort((a, b) => a - b);
  const mid = Math.floor(sizes.length / 2);
  const medianFileSizeBytes =
    sizes.length % 2 === 0
      ? Math.round((sizes[mid - 1] + sizes[mid]) / 2)
      : sizes[mid];
  const avgFileSizeBytes = Math.round(totalSizeBytes / analyzedCount);

  let oversizedFilesCount = 0;
  let emptyFilesCount = 0;
  for (const f of files) {
    if (f.sizeBytes > OVERSIZED_BYTES) oversizedFilesCount += 1;
    if (f.lines === 0) emptyFilesCount += 1;
  }

  const oversizedRatio = oversizedFilesCount / analyzedCount;
  const emptyRatio = emptyFilesCount / analyzedCount;
  const avgKb = avgFileSizeBytes / 1024;

  let fileSizeScore = 50;
  fileSizeScore -= Math.min(25, oversizedRatio * 125);
  if (avgKb > 20) {
    fileSizeScore -= Math.min(15, ((avgKb - 20) / 80) * 15);
  }
  if (emptyRatio > 0.1) {
    fileSizeScore -= Math.min(10, (emptyRatio - 0.1) * 50);
  }
  fileSizeScore = Math.max(0, Math.min(50, fileSizeScore));

  const healthySizeFilesPct = Number(
    (((analyzedCount - oversizedFilesCount) / analyzedCount) * 100).toFixed(1)
  );

  const roundedCommentScore = Math.round(commentScore);
  const roundedFileSizeScore = Math.round(fileSizeScore);
  const score = Math.max(
    0,
    Math.min(100, roundedCommentScore + roundedFileSizeScore)
  );

  return {
    score,
    commentScore: roundedCommentScore,
    fileSizeScore: roundedFileSizeScore,
    commentLines: totalCommentLines,
    commentCapableLines,
    commentRatioPct,
    commentDataAvailable,
    avgFileSizeBytes,
    medianFileSizeBytes,
    oversizedFilesCount,
    healthySizeFilesPct,
  };
}

function isLikelyBinaryBuffer(buffer: Buffer): boolean {
  const inspectLen = Math.min(buffer.length, 4096);
  for (let i = 0; i < inspectLen; i++) {
    if (buffer[i] === 0) {
      return true;
    }
  }
  return false;
}

async function fetchArchiveWithFallback(
  owner: string,
  repo: string,
  preferredBranch: string | undefined,
  signal: AbortSignal
): Promise<{ response: globalThis.Response; resolvedBranch: string }> {
  const safeOwner = encodeURIComponent(owner);
  const safeRepo = encodeURIComponent(repo);

  const candidates = preferredBranch
    ? [preferredBranch]
    : ['main', 'master'];

  let lastStatus = 404;

  for (const branch of candidates) {
    const encodedBranch = branch
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');
    const archiveUrl = `https://codeload.github.com/${safeOwner}/${safeRepo}/tar.gz/refs/heads/${encodedBranch}`;

    const resp = await fetch(archiveUrl, {
      signal,
      headers: {
        'User-Agent': 'CodeGauge-Repository-Analyzer/1.0',
      },
      redirect: 'follow',
    });

    if (resp.ok && resp.body) {
      return { response: resp, resolvedBranch: branch };
    }
    lastStatus = resp.status;

    if (preferredBranch) {
      const refUrl = `https://codeload.github.com/${safeOwner}/${safeRepo}/tar.gz/${encodedBranch}`;
      const refResp = await fetch(refUrl, {
        signal,
        headers: {
          'User-Agent': 'CodeGauge-Repository-Analyzer/1.0',
        },
        redirect: 'follow',
      });
      if (refResp.ok && refResp.body) {
        return { response: refResp, resolvedBranch: branch };
      }
      lastStatus = refResp.status;
    }
  }

  const err = new Error(`Archive fetch failed with status ${lastStatus}`) as Error & {
    statusCode?: number;
  };
  err.statusCode = lastStatus;
  throw err;
}

async function analyzeRepositoryStream(
  rawUrl: string,
  _req: Request,
  res: Response
): Promise<void> {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const parsed = parseGitHubInput(rawUrl);
  if (!parsed) {
    sendSse(res, {
      type: 'error',
      code: 'INVALID_URL',
      message: 'Invalid GitHub repository URL.',
    });
    res.end();
    return;
  }

  const { owner, repo, branch: requestedBranch } = parsed;
  const abortController = new AbortController();
  let clientClosed = false;

  res.on('close', () => {
    if (!res.writableEnded) {
      clientClosed = true;
      abortController.abort();
    }
  });

  const startedAt = Date.now();

  try {
    sendSse(res, {
      type: 'progress',
      stage: 'connecting',
      progress: 5,
      bytesDownloaded: 0,
      totalBytes: null,
      filesProcessed: 0,
      linesCounted: 0,
    });

    sendSse(res, {
      type: 'progress',
      stage: 'metadata',
      progress: 12,
      bytesDownloaded: 0,
      totalBytes: null,
      filesProcessed: 0,
      linesCounted: 0,
    });

    const safeOwner = encodeURIComponent(owner);
    const safeRepo = encodeURIComponent(repo);
    const metaUrl = `https://api.github.com/repos/${safeOwner}/${safeRepo}`;

    let metadata: RepoMetadata = {
      owner,
      name: repo,
      fullName: `${owner}/${repo}`,
      description: null,
      htmlUrl: `https://github.com/${safeOwner}/${safeRepo}`,
      avatarUrl: null,
      defaultBranch: requestedBranch || 'main',
      stars: 0,
      forks: 0,
      license: null,
      repoSizeKb: 0,
      updatedAt: null,
      pushedAt: null,
      openPullRequests: null,
      activity: null,
    };

    let metadataRateLimited = false;
    let latestCommitSha: string | null = null;
    let oneMonthAgoRef: CommitRef | null = null;

    const metaResp = await fetch(metaUrl, {
      signal: abortController.signal,
      headers: buildGitHubHeaders(),
    });

    if (metaResp.ok) {
      const json = (await metaResp.json()) as {
        name?: string;
        full_name?: string;
        description?: string | null;
        html_url?: string;
        default_branch?: string;
        stargazers_count?: number;
        forks_count?: number;
        size?: number;
        updated_at?: string;
        pushed_at?: string;
        license?: { spdx_id?: string | null; name?: string | null } | null;
        owner?: { login?: string; avatar_url?: string };
      };

      const resolvedBranch = requestedBranch || json.default_branch || 'main';

      const [openPrOutcome, activityOutcome] = await Promise.allSettled([
        fetchOpenPullRequestCount(safeOwner, safeRepo, abortController.signal),
        fetchCommitActivity(
          safeOwner,
          safeRepo,
          resolvedBranch,
          abortController.signal
        ),
      ]);

      const activityFetch =
        activityOutcome.status === 'fulfilled' ? activityOutcome.value : null;
      latestCommitSha = activityFetch?.latestSha ?? null;
      oneMonthAgoRef = activityFetch?.oneMonthAgoRef ?? null;

      metadata = {
        owner: json.owner?.login || owner,
        name: json.name || repo,
        fullName: json.full_name || `${owner}/${repo}`,
        description: json.description ?? null,
        htmlUrl: json.html_url || `https://github.com/${safeOwner}/${safeRepo}`,
        avatarUrl: json.owner?.avatar_url ?? null,
        defaultBranch: resolvedBranch,
        stars: json.stargazers_count ?? 0,
        forks: json.forks_count ?? 0,
        license:
          json.license?.spdx_id && json.license.spdx_id !== 'NOASSERTION'
            ? json.license.spdx_id
            : json.license?.name ?? null,
        repoSizeKb: json.size ?? 0,
        updatedAt: json.updated_at ?? null,
        pushedAt: json.pushed_at ?? json.updated_at ?? null,
        openPullRequests:
          openPrOutcome.status === 'fulfilled' ? openPrOutcome.value : null,
        activity: activityFetch?.activity ?? null,
      };
    } else if (metaResp.status === 404) {
      sendSse(res, {
        type: 'error',
        code: 'NOT_FOUND',
        message: 'Repository not found or is private.',
      });
      res.end();
      return;
    } else if (metaResp.status === 403 || metaResp.status === 429) {
      metadataRateLimited = true;
    }

    if (clientClosed) return;

    sendSse(res, {
      type: 'progress',
      stage: 'downloading',
      progress: 20,
      bytesDownloaded: 0,
      totalBytes: metadata.repoSizeKb > 0 ? metadata.repoSizeKb * 1024 : null,
      filesProcessed: 0,
      linesCounted: 0,
    });

    let archiveResult: { response: globalThis.Response; resolvedBranch: string };
    try {
      archiveResult = await fetchArchiveWithFallback(
        owner,
        repo,
        metadataRateLimited ? requestedBranch : metadata.defaultBranch,
        abortController.signal
      );
    } catch (err) {
      if (abortController.signal.aborted) return;
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404) {
        sendSse(res, {
          type: 'error',
          code: 'NOT_FOUND',
          message: 'Repository or branch was not found.',
        });
      } else if (status === 403 || status === 429) {
        sendSse(res, {
          type: 'error',
          code: 'RATE_LIMIT',
          message: 'GitHub rate limit exceeded.',
        });
      } else {
        sendSse(res, {
          type: 'error',
          code: 'FETCH_FAILED',
          message: 'Failed to download repository archive.',
        });
      }
      res.end();
      return;
    }

    metadata.defaultBranch = archiveResult.resolvedBranch;
    const contentLengthHeader = archiveResult.response.headers.get('content-length');
    const headerTotalBytes = contentLengthHeader ? Number(contentLengthHeader) : null;
    const estimatedBytes =
      headerTotalBytes && Number.isFinite(headerTotalBytes) && headerTotalBytes > 0
        ? headerTotalBytes
        : null;

    if (headerTotalBytes && headerTotalBytes > MAX_ARCHIVE_BYTES) {
      abortController.abort();
      sendSse(res, {
        type: 'error',
        code: 'ARCHIVE_TOO_LARGE',
        message: 'Repository archive exceeds 250 MB limit.',
      });
      res.end();
      return;
    }

    let bytesDownloaded = 0;
    let totalFiles = 0;
    let analyzedFiles = 0;
    let skippedBinaryFiles = 0;
    let skippedLargeFiles = 0;
    let totalLines = 0;
    let codeLines = 0;
    let blankLines = 0;
    let totalCommentLines = 0;
    let commentCapableLines = 0;
    let totalSizeBytes = 0;
    let currentFile = '';

    const languageAgg = new Map<
      string,
      {
        name: string;
        color: string;
        lines: number;
        codeLines: number;
        blankLines: number;
        files: number;
        sizeBytes: number;
      }
    >();
    const filesList: AnalyzedFile[] = [];

    let lastEmitTime = 0;
    const emitProgress = (stage: 'downloading' | 'parsing', force = false) => {
      const now = Date.now();
      if (!force && now - lastEmitTime < 140) return;
      lastEmitTime = now;

      let pct = 25;
      if (estimatedBytes && estimatedBytes > 0) {
        const ratio = Math.min(1, bytesDownloaded / estimatedBytes);
        pct = Math.round(22 + ratio * 72);
      } else {
        pct = Math.min(94, 25 + Math.round(Math.log10(Math.max(10, totalFiles + 1)) * 18));
      }

      sendSse(res, {
        type: 'progress',
        stage,
        progress: Math.min(95, pct),
        bytesDownloaded,
        totalBytes: estimatedBytes,
        filesProcessed: totalFiles,
        linesCounted: totalLines,
        currentFile,
      });
    };

    const webBody = archiveResult.response.body;
    if (!webBody) {
      sendSse(res, {
        type: 'error',
        code: 'FETCH_FAILED',
        message: 'Empty response stream from GitHub.',
      });
      res.end();
      return;
    }

    const nodeStream = Readable.fromWeb(
      webBody as unknown as import('node:stream/web').ReadableStream<Uint8Array>
    );
    const gunzip = zlib.createGunzip();
    const extract = tarStream.extract();

    let archiveLimitExceeded = false;

    extract.on('entry', (header, stream, next) => {
      if (header.type !== 'file') {
        stream.resume();
        next();
        return;
      }

      const slashIdx = header.name.indexOf('/');
      const relativePath = slashIdx >= 0 ? header.name.slice(slashIdx + 1) : header.name;

      if (!relativePath || relativePath.startsWith('.git/')) {
        stream.resume();
        next();
        return;
      }

      totalFiles += 1;
      currentFile = relativePath;
      const fileName = path.posix.basename(relativePath);
      const fileSize = header.size ?? 0;

      if (isBinaryExtension(fileName)) {
        skippedBinaryFiles += 1;
        stream.resume();
        emitProgress('parsing');
        next();
        return;
      }

      if (fileSize > MAX_SINGLE_FILE_BYTES) {
        skippedLargeFiles += 1;
        stream.resume();
        emitProgress('parsing');
        next();
        return;
      }

      const chunks: Buffer[] = [];
      let readBytes = 0;
      let isBinaryDetected = false;

      stream.on('data', (chunk: unknown) => {
        if (isBinaryDetected) return;
        const buf = Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk as Uint8Array);
        readBytes += buf.length;
        if (readBytes > MAX_SINGLE_FILE_BYTES) {
          isBinaryDetected = true;
          chunks.length = 0;
          return;
        }
        if (chunks.length === 0 && isLikelyBinaryBuffer(buf)) {
          isBinaryDetected = true;
          chunks.length = 0;
          return;
        }
        chunks.push(buf);
      });

      stream.on('end', () => {
        if (isBinaryDetected) {
          if (readBytes > MAX_SINGLE_FILE_BYTES) {
            skippedLargeFiles += 1;
          } else {
            skippedBinaryFiles += 1;
          }
          emitProgress('parsing');
          next();
          return;
        }

        const fullBuf = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
        const lang = detectLanguage(fileName);
        const ext = extractExtension(fileName);
        const counts = analyzeSourceBuffer(fullBuf, lang.name);

        analyzedFiles += 1;
        totalLines += counts.lines;
        codeLines += counts.codeLines;
        blankLines += counts.blankLines;
        totalCommentLines += counts.commentLines;
        if (counts.commentCapable) {
          commentCapableLines += counts.codeLines;
        }
        totalSizeBytes += fullBuf.length;

        const existing = languageAgg.get(lang.name);
        if (existing) {
          existing.lines += counts.lines;
          existing.codeLines += counts.codeLines;
          existing.blankLines += counts.blankLines;
          existing.files += 1;
          existing.sizeBytes += fullBuf.length;
        } else {
          languageAgg.set(lang.name, {
            name: lang.name,
            color: lang.color,
            lines: counts.lines,
            codeLines: counts.codeLines,
            blankLines: counts.blankLines,
            files: 1,
            sizeBytes: fullBuf.length,
          });
        }

        filesList.push({
          path: relativePath,
          name: fileName,
          extension: ext,
          language: lang.name,
          color: lang.color,
          lines: counts.lines,
          codeLines: counts.codeLines,
          blankLines: counts.blankLines,
          commentLines: counts.commentLines,
          sizeBytes: fullBuf.length,
        });

        emitProgress('parsing');
        next();
      });

      stream.on('error', () => {
        next();
      });
    });

    await new Promise<void>((resolve, reject) => {
      nodeStream.on('data', (chunk: Buffer) => {
        bytesDownloaded += chunk.length;
        if (bytesDownloaded > MAX_ARCHIVE_BYTES) {
          archiveLimitExceeded = true;
          abortController.abort();
          nodeStream.destroy();
          gunzip.destroy();
          extract.destroy();
          reject(new Error('ARCHIVE_TOO_LARGE'));
          return;
        }
        emitProgress('downloading');
      });

      nodeStream.on('error', reject);
      gunzip.on('error', reject);
      extract.on('error', reject);
      extract.on('finish', resolve);

      nodeStream.pipe(gunzip).pipe(extract);
    });

    if (clientClosed || archiveLimitExceeded) {
      if (archiveLimitExceeded) {
        sendSse(res, {
          type: 'error',
          code: 'ARCHIVE_TOO_LARGE',
          message: 'Repository archive exceeds 250 MB limit.',
        });
        res.end();
      }
      return;
    }

    const languages: LanguageStat[] = Array.from(languageAgg.values())
      .map((item) => ({
        ...item,
        percentage:
          totalLines > 0 ? Number(((item.lines / totalLines) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.lines - a.lines || b.files - a.files);

    filesList.sort((a, b) => b.lines - a.lines || b.sizeBytes - a.sizeBytes);
    const filesTruncated = filesList.length > MAX_RETURNED_FILES;
    const returnedFiles = filesTruncated
      ? filesList.slice(0, MAX_RETURNED_FILES)
      : filesList;

    const health = computeCodeHealth(
      filesList,
      totalCommentLines,
      commentCapableLines,
      totalSizeBytes
    );

    const languageHistory =
      oneMonthAgoRef && bytesDownloaded <= MAX_HISTORICAL_ARCHIVE_BYTES
        ? await fetchOneMonthAgoLanguageSnapshot(
            owner,
            repo,
            oneMonthAgoRef,
            latestCommitSha,
            languages,
            totalLines,
            codeLines,
            abortController.signal
          )
        : null;

    if (clientClosed) return;

    const result: AnalysisResult = {
      repository: metadata,
      summary: {
        totalLines,
        codeLines,
        blankLines,
        commentLines: totalCommentLines,
        totalFiles,
        analyzedFiles,
        skippedBinaryFiles,
        skippedLargeFiles,
        totalSizeBytes,
        languageCount: languages.length,
        analysisDurationMs: Date.now() - startedAt,
        filesTruncated,
        health,
      },
      languages,
      files: returnedFiles,
      analyzedAt: new Date().toISOString(),
      languageHistory,
    };

    sendSse(res, {
      type: 'progress',
      stage: 'complete',
      progress: 100,
      bytesDownloaded,
      totalBytes: bytesDownloaded,
      filesProcessed: totalFiles,
      linesCounted: totalLines,
    });

    sendSse(res, {
      type: 'complete',
      data: result,
    });
    res.end();
  } catch (err) {
    if (clientClosed || abortController.signal.aborted) {
      if (!res.writableEnded) res.end();
      return;
    }
    const message =
      err instanceof Error ? err.message : 'Unexpected analysis error.';
    sendSse(res, {
      type: 'error',
      code: message === 'ARCHIVE_TOO_LARGE' ? 'ARCHIVE_TOO_LARGE' : 'FETCH_FAILED',
      message,
    });
    res.end();
  }
}

export function createApiApp(): Express {
  const app = express();
  app.disable('x-powered-by');

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/analyze', async (req, res) => {
    const rawUrl = typeof req.query.url === 'string' ? req.query.url : '';
    await analyzeRepositoryStream(rawUrl, req, res);
  });

  return app;
}
