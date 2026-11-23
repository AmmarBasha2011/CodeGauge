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
  ComplexityMetrics,
  HistoricalLanguageSnapshot,
  LanguageAdoptionMonth,
  LanguageAdoptionSummaryItem,
  LanguageAdoptionTrend,
  LanguageStat,
  MonthlyLanguagePoint,
  RefactoringCategory,
  RefactoringRecommendation,
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
  ms: number;
}

interface CommitActivityFetchResult {
  activity: CommitActivitySummary | null;
  latestSha: string | null;
  oneMonthAgoRef: CommitRef | null;
  commitRefs: CommitRef[];
  commitsSampledCount: number;
  rateLimitRemaining: number | null;
}

const VALID_SHA_RE = /^[a-f0-9]{7,40}$/i;

function parseRateLimitRemaining(headers: Headers): number | null {
  const raw = headers.get('x-ratelimit-remaining');
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

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
    const rateLimitRemaining = parseRateLimitRemaining(resp.headers);
    if (!resp.ok) {
      return {
        activity: null,
        latestSha: null,
        oneMonthAgoRef: null,
        commitRefs: [],
        commitsSampledCount: 0,
        rateLimitRemaining,
      };
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
        commitRefs: [],
        commitsSampledCount: 0,
        rateLimitRemaining,
      };
    }

    const timestamps: number[] = [];
    const commitRefs: CommitRef[] = [];
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
        if (entry.sha && VALID_SHA_RE.test(entry.sha)) {
          const ref: CommitRef = { sha: entry.sha, date: dateStr, ms };
          commitRefs.push(ref);
          if (!oneMonthAgoRef && ms <= thirtyDaysAgo) {
            oneMonthAgoRef = ref;
          }
        }
      }
    }

    let latestRateLimit = rateLimitRemaining;

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
        const nextLimit = parseRateLimitRemaining(histResp.headers);
        if (nextLimit !== null) latestRateLimit = nextLimit;
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
          const histMs = histDate ? Date.parse(histDate) : NaN;
          if (
            first?.sha &&
            VALID_SHA_RE.test(first.sha) &&
            histDate &&
            Number.isFinite(histMs)
          ) {
            oneMonthAgoRef = { sha: first.sha, date: histDate, ms: histMs };
          }
        }
      } catch {
        // Optional historical commit lookup failed; continue gracefully
      }
    }

    if (timestamps.length === 0) {
      return {
        activity: null,
        latestSha,
        oneMonthAgoRef,
        commitRefs,
        commitsSampledCount: commits.length,
        rateLimitRemaining: latestRateLimit,
      };
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
      commitRefs,
      commitsSampledCount: commits.length,
      rateLimitRemaining: latestRateLimit,
    };
  } catch {
    return {
      activity: null,
      latestSha: null,
      oneMonthAgoRef: null,
      commitRefs: [],
      commitsSampledCount: 0,
      rateLimitRemaining: null,
    };
  }
}

const MAX_HISTORICAL_ARCHIVE_BYTES = 50 * 1024 * 1024; // 50 MB cap for secondary historical pass
const MAX_ADOPTION_ARCHIVE_BYTES = 15 * 1024 * 1024; // 15 MB cap per tarball in 12-month adoption pass

interface ParsedSnapshotStats {
  sha: string;
  totalLines: number;
  codeLines: number;
  languages: Array<{
    name: string;
    color: string;
    lines: number;
    codeLines: number;
    files: number;
    percentage: number;
  }>;
  trackedFilePaths: Map<string, Set<string>>;
}

function createCurrentSnapshotStats(
  sha: string,
  languages: LanguageStat[],
  filesList: AnalyzedFile[],
  totalLines: number,
  codeLines: number,
  trackedLanguageNames: Set<string>
): ParsedSnapshotStats {
  const trackedFilePaths = new Map<string, Set<string>>();
  for (const name of trackedLanguageNames) {
    trackedFilePaths.set(name, new Set<string>());
  }
  for (const file of filesList) {
    if (trackedLanguageNames.has(file.language)) {
      trackedFilePaths.get(file.language)?.add(file.path);
    }
  }

  return {
    sha,
    totalLines,
    codeLines,
    languages: languages.map((item) => ({
      name: item.name,
      color: item.color,
      lines: item.lines,
      codeLines: item.codeLines,
      files: item.files,
      percentage: item.percentage,
    })),
    trackedFilePaths,
  };
}

async function parseSnapshotArchiveAtSha(
  owner: string,
  repo: string,
  sha: string,
  maxBytes: number,
  timeoutMs: number,
  trackedLanguageNames: Set<string>,
  parentSignal: AbortSignal
): Promise<ParsedSnapshotStats | null> {
  if (!VALID_SHA_RE.test(sha)) return null;

  const histController = new AbortController();
  const onParentAbort = () => histController.abort();
  parentSignal.addEventListener('abort', onParentAbort, { once: true });
  const timeoutId = setTimeout(() => histController.abort(), timeoutMs);

  try {
    const safeOwner = encodeURIComponent(owner);
    const safeRepo = encodeURIComponent(repo);
    const archiveUrl = `https://codeload.github.com/${safeOwner}/${safeRepo}/tar.gz/${encodeURIComponent(
      sha
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
    if (headerBytes > maxBytes) return null;

    let histBytes = 0;
    let histTotalLines = 0;
    let histCodeLines = 0;
    const histLangAgg = new Map<
      string,
      { name: string; color: string; lines: number; codeLines: number; files: number }
    >();
    const trackedFilePaths = new Map<string, Set<string>>();
    for (const name of trackedLanguageNames) {
      trackedFilePaths.set(name, new Set<string>());
    }

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

        if (trackedLanguageNames.has(lang.name)) {
          trackedFilePaths.get(lang.name)?.add(relativePath);
        }

        const existing = histLangAgg.get(lang.name);
        if (existing) {
          existing.lines += counts.lines;
          existing.codeLines += counts.codeLines;
          existing.files += 1;
        } else {
          histLangAgg.set(lang.name, {
            name: lang.name,
            color: lang.color,
            lines: counts.lines,
            codeLines: counts.codeLines,
            files: 1,
          });
        }
        next();
      });

      stream.on('error', () => next());
    });

    await new Promise<void>((resolve, reject) => {
      nodeStream.on('data', (chunk: Buffer) => {
        histBytes += chunk.length;
        if (histBytes > maxBytes) {
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
      sha,
      totalLines: histTotalLines,
      codeLines: histCodeLines,
      languages: histLanguages,
      trackedFilePaths,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
    parentSignal.removeEventListener('abort', onParentAbort);
  }
}

function buildSnapshotFromCache(
  cache: Map<string, Promise<ParsedSnapshotStats | null>>,
  owner: string,
  repo: string,
  sha: string,
  maxBytes: number,
  timeoutMs: number,
  trackedLanguageNames: Set<string>,
  parentSignal: AbortSignal
): Promise<ParsedSnapshotStats | null> {
  const existing = cache.get(sha);
  if (existing) return existing;
  const promise = parseSnapshotArchiveAtSha(
    owner,
    repo,
    sha,
    maxBytes,
    timeoutMs,
    trackedLanguageNames,
    parentSignal
  );
  cache.set(sha, promise);
  return promise;
}

async function fetchOneMonthAgoLanguageSnapshot(
  owner: string,
  repo: string,
  oneMonthAgoRef: CommitRef,
  latestSha: string | null,
  currentLanguages: LanguageStat[],
  currentTotalLines: number,
  currentCodeLines: number,
  snapshotCache: Map<string, Promise<ParsedSnapshotStats | null>>,
  trackedLanguageNames: Set<string>,
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

  const parsed = await buildSnapshotFromCache(
    snapshotCache,
    owner,
    repo,
    oneMonthAgoRef.sha,
    MAX_HISTORICAL_ARCHIVE_BYTES,
    15000,
    trackedLanguageNames,
    parentSignal
  );

  if (!parsed) return null;

  return {
    snapshotCommitSha: oneMonthAgoRef.sha,
    snapshotDate: oneMonthAgoRef.date,
    totalLines: parsed.totalLines,
    codeLines: parsed.codeLines,
    languages: parsed.languages.slice(0, 15).map((item) => ({
      name: item.name,
      color: item.color,
      lines: item.lines,
      codeLines: item.codeLines,
      percentage: item.percentage,
    })),
  };
}

function classifyAdoptionTrend(
  startCodeLines: number,
  endCodeLines: number,
  startPercentage: number,
  endPercentage: number,
  createdFiles12m: number
): 'increasing' | 'decreasing' | 'stable' {
  const deltaCodeLines = endCodeLines - startCodeLines;
  const deltaPercentage = endPercentage - startPercentage;

  if (startCodeLines === 0 && endCodeLines > 0) {
    return 'increasing';
  }
  if (startCodeLines === 0 && endCodeLines === 0) {
    return 'stable';
  }

  const relGrowth = deltaCodeLines / Math.max(1, startCodeLines);
  if (
    deltaCodeLines > 0 &&
    (relGrowth >= 0.03 ||
      deltaPercentage >= 0.4 ||
      deltaCodeLines >= 50 ||
      createdFiles12m >= 2)
  ) {
    return 'increasing';
  }
  if (
    deltaCodeLines < 0 &&
    (relGrowth <= -0.03 || deltaPercentage <= -0.4 || deltaCodeLines <= -50)
  ) {
    return 'decreasing';
  }
  if (deltaCodeLines === 0) {
    if (deltaPercentage >= 0.4) return 'increasing';
    if (deltaPercentage <= -0.4) return 'decreasing';
  }
  return 'stable';
}

function buildLanguageAdoptionSummary(
  top5: LanguageStat[],
  months: LanguageAdoptionMonth[]
): LanguageAdoptionSummaryItem[] {
  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];

  return top5.map((lang) => {
    const startPt = firstMonth?.languages[lang.name];
    const endPt = lastMonth?.languages[lang.name];
    const startCodeLines = startPt?.codeLines ?? 0;
    const endCodeLines = endPt?.codeLines ?? lang.codeLines;
    const deltaCodeLines = endCodeLines - startCodeLines;
    const startPercentage = Number((startPt?.percentage ?? 0).toFixed(2));
    const endPercentage = Number((endPt?.percentage ?? lang.percentage).toFixed(2));
    const deltaPercentage = Number((endPercentage - startPercentage).toFixed(2));
    const startFiles = startPt?.files ?? 0;
    const endFiles = endPt?.files ?? lang.files;
    const createdFiles12m = months.reduce(
      (sum, m) => sum + (m.languages[lang.name]?.newFiles ?? 0),
      0
    );

    return {
      name: lang.name,
      color: lang.color,
      startCodeLines,
      endCodeLines,
      deltaCodeLines,
      startPercentage,
      endPercentage,
      deltaPercentage,
      startFiles,
      endFiles,
      createdFiles12m,
      trend: classifyAdoptionTrend(
        startCodeLines,
        endCodeLines,
        startPercentage,
        endPercentage,
        createdFiles12m
      ),
    };
  });
}

async function fetchCommitShaBeforeDate(
  safeOwner: string,
  safeRepo: string,
  encodedBranch: string,
  untilIso: string,
  signal: AbortSignal
): Promise<CommitRef | null> {
  try {
    const url = `https://api.github.com/repos/${safeOwner}/${safeRepo}/commits?sha=${encodedBranch}&until=${encodeURIComponent(
      untilIso
    )}&per_page=1`;
    const resp = await fetch(url, {
      signal,
      headers: buildGitHubHeaders(),
    });
    if (!resp.ok) return null;
    const commits = (await resp.json()) as Array<{
      sha?: string;
      commit?: {
        author?: { date?: string };
        committer?: { date?: string };
      };
    }>;
    const first = Array.isArray(commits) ? commits[0] : undefined;
    const dateStr = first?.commit?.author?.date ?? first?.commit?.committer?.date;
    const ms = dateStr ? Date.parse(dateStr) : NaN;
    if (first?.sha && VALID_SHA_RE.test(first.sha) && dateStr && Number.isFinite(ms)) {
      return { sha: first.sha, date: dateStr, ms };
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchFileCreationMonthIndices(
  owner: string,
  repo: string,
  branch: string,
  top5: LanguageStat[],
  filesList: AnalyzedFile[],
  monthBuckets: Array<{ monthKey: string; startMs: number; endMs: number }>,
  parentSignal: AbortSignal
): Promise<LanguageAdoptionTrend | null> {
  const safeOwner = encodeURIComponent(owner);
  const safeRepo = encodeURIComponent(repo);
  const encodedBranch = encodeURIComponent(branch);

  const selectedFiles: Array<{ path: string; language: string; codeLines: number; lines: number }> = [];
  for (const lang of top5) {
    const candidates = filesList
      .filter((f) => f.language === lang.name)
      .slice(0, 4);
    for (const f of candidates) {
      selectedFiles.push({
        path: f.path,
        language: f.language,
        codeLines: f.codeLines,
        lines: f.lines,
      });
    }
  }

  if (selectedFiles.length === 0) return null;

  const controller = new AbortController();
  const onParentAbort = () => controller.abort();
  parentSignal.addEventListener('abort', onParentAbort, { once: true });
  const timeoutId = setTimeout(() => controller.abort(), 14000);

  try {
    const creationTimes = new Map<string, number>();
    const BATCH_SIZE = 5;

    for (let i = 0; i < selectedFiles.length; i += BATCH_SIZE) {
      if (controller.signal.aborted) break;
      const batch = selectedFiles.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (item) => {
          try {
            const url = `https://api.github.com/repos/${safeOwner}/${safeRepo}/commits?sha=${encodedBranch}&path=${encodeURIComponent(
              item.path
            )}&per_page=100`;
            const resp = await fetch(url, {
              signal: controller.signal,
              headers: buildGitHubHeaders(),
            });
            if (!resp.ok) return;
            const commits = (await resp.json()) as Array<{
              commit?: {
                author?: { date?: string };
                committer?: { date?: string };
              };
            }>;
            if (!Array.isArray(commits) || commits.length === 0) return;
            const earliest = commits[commits.length - 1];
            const dateStr =
              earliest?.commit?.author?.date ?? earliest?.commit?.committer?.date;
            const ms = dateStr ? Date.parse(dateStr) : NaN;
            if (Number.isFinite(ms)) {
              creationTimes.set(item.path, ms);
            }
          } catch {
            // Skip failed single file lookup
          }
        })
      );
    }

    if (creationTimes.size === 0) return null;

    const months: LanguageAdoptionMonth[] = [];
    const totalCurrentCodeLines = top5.reduce((s, l) => s + l.codeLines, 0);

    for (let mIdx = 0; mIdx < monthBuckets.length; mIdx++) {
      const bucket = monthBuckets[mIdx];
      const monthLangRaw = new Map<
        string,
        { codeLines: number; lines: number; files: number; newFiles: number }
      >();

      let monthTotalCode = 0;
      for (const lang of top5) {
        const langFiles = selectedFiles.filter((f) => f.language === lang.name);
        const sampledTotalCode = langFiles.reduce((s, f) => s + Math.max(1, f.codeLines), 0);

        let cumulativeRatio = 1;
        let newlyCreatedCount = 0;
        let existingSampleCount = 0;

        if (langFiles.length > 0 && sampledTotalCode > 0) {
          let existingCodeWeight = 0;
          for (const f of langFiles) {
            const createdMs = creationTimes.get(f.path);
            if (createdMs === undefined || createdMs <= bucket.endMs) {
              existingCodeWeight += Math.max(1, f.codeLines);
              existingSampleCount += 1;
            }
            if (
              createdMs !== undefined &&
              createdMs >= bucket.startMs &&
              createdMs <= bucket.endMs
            ) {
              newlyCreatedCount += 1;
            }
          }
          cumulativeRatio = existingCodeWeight / sampledTotalCode;
        }

        const estCodeLines = Math.round(lang.codeLines * cumulativeRatio);
        const estLines = Math.round(lang.lines * cumulativeRatio);
        const estFiles =
          langFiles.length > 0
            ? Math.round(lang.files * (existingSampleCount / langFiles.length))
            : lang.files;
        const estNewFiles =
          langFiles.length > 0
            ? Math.round((newlyCreatedCount / langFiles.length) * lang.files)
            : 0;

        monthTotalCode += estCodeLines;
        monthLangRaw.set(lang.name, {
          codeLines: estCodeLines,
          lines: estLines,
          files: estFiles,
          newFiles: estNewFiles,
        });
      }

      const top5CurrentShare = top5.reduce((s, l) => s + l.percentage, 0);
      const denom = Math.max(1, monthTotalCode);
      const langRecord: Record<string, MonthlyLanguagePoint> = {};
      for (const lang of top5) {
        const raw = monthLangRaw.get(lang.name)!;
        langRecord[lang.name] = {
          lines: raw.lines,
          codeLines: raw.codeLines,
          files: raw.files,
          newFiles: raw.newFiles,
          percentage:
            monthTotalCode > 0
              ? Number(((raw.codeLines / denom) * top5CurrentShare).toFixed(2))
              : 0,
        };
      }

      // Ensure last month matches exact current percentages & totals
      if (mIdx === monthBuckets.length - 1) {
        for (const lang of top5) {
          const prevNew = langRecord[lang.name]?.newFiles ?? 0;
          langRecord[lang.name] = {
            lines: lang.lines,
            codeLines: lang.codeLines,
            files: lang.files,
            newFiles: prevNew,
            percentage: lang.percentage,
          };
        }
      }

      months.push({
        monthKey: bucket.monthKey,
        timestamp: new Date(bucket.endMs).toISOString(),
        languages: langRecord,
      });
    }

    return {
      source: 'file-creations',
      topLanguages: top5.map((l) => ({ name: l.name, color: l.color })),
      months,
      summary: buildLanguageAdoptionSummary(top5, months),
    };
  } finally {
    clearTimeout(timeoutId);
    parentSignal.removeEventListener('abort', onParentAbort);
  }
}

async function fetchLanguageAdoptionTrend(
  owner: string,
  repo: string,
  branch: string,
  bytesDownloaded: number,
  currentLanguages: LanguageStat[],
  filesList: AnalyzedFile[],
  currentTotalLines: number,
  currentCodeLines: number,
  latestCommitSha: string | null,
  commitRefs: CommitRef[],
  commitsSampledCount: number,
  rateLimitRemaining: number | null,
  snapshotCache: Map<string, Promise<ParsedSnapshotStats | null>>,
  parentSignal: AbortSignal
): Promise<LanguageAdoptionTrend | null> {
  const top5 = currentLanguages.slice(0, 5);
  if (top5.length === 0) return null;

  const now = new Date();
  const monthBuckets: Array<{ monthKey: string; startMs: number; endMs: number }> = [];
  for (let offset = 11; offset >= 0; offset--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    const monthKey = `${y}-${String(m + 1).padStart(2, '0')}`;
    const startMs = Date.UTC(y, m, 1, 0, 0, 0, 0);
    const endMs =
      offset === 0
        ? now.getTime()
        : Date.UTC(y, m + 1, 1, 0, 0, 0, 0) - 1;
    monthBuckets.push({ monthKey, startMs, endMs });
  }

  const hasToken = Boolean(process.env.GITHUB_TOKEN?.trim());
  const hasHealthyRateLimit =
    hasToken || rateLimitRemaining === null || rateLimitRemaining >= 20;

  // Large archive fallback (> 15 MB): analyze file creation timestamps via path commit history
  if (bytesDownloaded > MAX_ADOPTION_ARCHIVE_BYTES) {
    if (!hasHealthyRateLimit) return null;
    return fetchFileCreationMonthIndices(
      owner,
      repo,
      branch,
      top5,
      filesList,
      monthBuckets,
      parentSignal
    );
  }

  const trackedNames = new Set(top5.map((l) => l.name));
  const currentStats = createCurrentSnapshotStats(
    latestCommitSha || 'HEAD',
    currentLanguages,
    filesList,
    currentTotalLines,
    currentCodeLines,
    trackedNames
  );
  if (latestCommitSha) {
    snapshotCache.set(latestCommitSha, Promise.resolve(currentStats));
  }

  // Sort commitRefs newest -> oldest
  const sortedCommits = [...commitRefs].sort((a, b) => b.ms - a.ms);
  const oldestSampledMs =
    sortedCommits.length > 0 ? sortedCommits[sortedCommits.length - 1].ms : null;
  const fullHistoryInMemory = commitsSampledCount < 100;

  const monthShaTargets: Array<string | null> = new Array(12).fill(null);
  monthShaTargets[11] = currentStats.sha;

  const uncoveredIndices: number[] = [];
  for (let i = 0; i < 11; i++) {
    const endMs = monthBuckets[i].endMs;
    const match = sortedCommits.find((c) => c.ms <= endMs);
    if (match) {
      monthShaTargets[i] = match.sha;
    } else if (fullHistoryInMemory) {
      // Repository did not have commits yet at this month-end
      monthShaTargets[i] = null;
    } else {
      uncoveredIndices.push(i);
    }
  }

  if (uncoveredIndices.length > 0) {
    const safeOwner = encodeURIComponent(owner);
    const safeRepo = encodeURIComponent(repo);
    const encodedBranch = encodeURIComponent(branch);

    const indicesToQuery =
      hasHealthyRateLimit
        ? uncoveredIndices
        : uncoveredIndices.filter((idx) => idx === 0 || idx === 2 || idx === 5 || idx === 8);

    const anchorController = new AbortController();
    const onAbort = () => anchorController.abort();
    parentSignal.addEventListener('abort', onAbort, { once: true });
    const anchorTimeout = setTimeout(() => anchorController.abort(), 8000);

    try {
      const queried = await Promise.all(
        indicesToQuery.map(async (idx) => {
          const ref = await fetchCommitShaBeforeDate(
            safeOwner,
            safeRepo,
            encodedBranch,
            new Date(monthBuckets[idx].endMs).toISOString(),
            anchorController.signal
          );
          return { idx, ref };
        })
      );

      for (const { idx, ref } of queried) {
        monthShaTargets[idx] = ref ? ref.sha : null;
      }

      // If rate limit caused sparse quarterly anchors, carry forward/back nearest anchor
      if (!hasHealthyRateLimit) {
        let lastKnown: string | null = null;
        for (let i = 0; i < 11; i++) {
          if (monthShaTargets[i]) {
            lastKnown = monthShaTargets[i];
          } else if (
            lastKnown &&
            (!oldestSampledMs || monthBuckets[i].endMs >= oldestSampledMs)
          ) {
            monthShaTargets[i] = lastKnown;
          }
        }
      }
    } finally {
      clearTimeout(anchorTimeout);
      parentSignal.removeEventListener('abort', onAbort);
    }
  }

  const uniqueShasToFetch = Array.from(
    new Set(
      monthShaTargets.filter(
        (sha): sha is string => Boolean(sha) && sha !== currentStats.sha
      )
    )
  );

  const adoptionController = new AbortController();
  const onParentAbort = () => adoptionController.abort();
  parentSignal.addEventListener('abort', onParentAbort, { once: true });
  const totalTimeoutId = setTimeout(() => adoptionController.abort(), 16000);

  try {
    const CONCURRENCY = 3;
    for (let i = 0; i < uniqueShasToFetch.length; i += CONCURRENCY) {
      if (adoptionController.signal.aborted) break;
      const batch = uniqueShasToFetch.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map((sha) =>
          buildSnapshotFromCache(
            snapshotCache,
            owner,
            repo,
            sha,
            MAX_ADOPTION_ARCHIVE_BYTES,
            12000,
            trackedNames,
            adoptionController.signal
          )
        )
      );
    }

    const resolvedStats: Array<ParsedSnapshotStats | null> = await Promise.all(
      monthShaTargets.map(async (sha, idx) => {
        if (!sha) return null;
        if (idx === 11 || sha === currentStats.sha) return currentStats;
        const cached = snapshotCache.get(sha);
        return cached ? await cached : null;
      })
    );

    // Fill transient fetch failures (where SHA existed) from nearest resolved snapshot
    for (let idx = 0; idx < 12; idx++) {
      if (monthShaTargets[idx] && !resolvedStats[idx]) {
        let fallback: ParsedSnapshotStats | null = null;
        for (let offset = 1; offset < 12; offset++) {
          if (idx - offset >= 0 && resolvedStats[idx - offset]) {
            fallback = resolvedStats[idx - offset];
            break;
          }
          if (idx + offset < 12 && resolvedStats[idx + offset]) {
            fallback = resolvedStats[idx + offset];
            break;
          }
        }
        resolvedStats[idx] = fallback;
      }
    }

    const seenPathsByLang = new Map<string, Set<string>>();
    for (const lang of top5) {
      seenPathsByLang.set(lang.name, new Set<string>());
    }

    const months: LanguageAdoptionMonth[] = [];
    const repoCreatedInMonthZero =
      fullHistoryInMemory &&
      oldestSampledMs !== null &&
      oldestSampledMs >= monthBuckets[0].startMs;

    for (let idx = 0; idx < 12; idx++) {
      const bucket = monthBuckets[idx];
      const stats = resolvedStats[idx];
      const langRecord: Record<string, MonthlyLanguagePoint> = {};

      const langMap = new Map(
        (stats?.languages ?? []).map((item) => [item.name, item])
      );

      for (const lang of top5) {
        const entry = langMap.get(lang.name);
        const currentPaths = stats?.trackedFilePaths.get(lang.name) ?? new Set<string>();
        const seen = seenPathsByLang.get(lang.name)!;

        let newFiles = 0;
        if (stats) {
          if (idx === 0 && !repoCreatedInMonthZero) {
            for (const p of currentPaths) {
              seen.add(p);
            }
            newFiles = 0;
          } else {
            for (const p of currentPaths) {
              if (!seen.has(p)) {
                seen.add(p);
                newFiles += 1;
              }
            }
          }
        }

        langRecord[lang.name] = {
          lines: entry?.lines ?? 0,
          codeLines: entry?.codeLines ?? 0,
          files: entry?.files ?? 0,
          newFiles,
          percentage: entry?.percentage ?? 0,
        };
      }

      months.push({
        monthKey: bucket.monthKey,
        timestamp: new Date(bucket.endMs).toISOString(),
        languages: langRecord,
      });
    }

    return {
      source: 'snapshots',
      topLanguages: top5.map((l) => ({ name: l.name, color: l.color })),
      months,
      summary: buildLanguageAdoptionSummary(top5, months),
    };
  } finally {
    clearTimeout(totalTimeoutId);
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

const NON_LOGIC_COMPLEXITY_LANGUAGES = new Set([
  'JSON',
  'Text',
  'CSV',
  'Markdown',
  'MDX',
  'reStructuredText',
  'Other',
  'YAML',
  'TOML',
  'XML',
  'SVG',
  'HTML',
  'CSS',
  'SCSS',
  'Sass',
  'Less',
  'Ignore List',
  'Git Config',
  'EditorConfig',
  'Config',
  'INI',
  'GraphQL',
]);

const INDENT_SCOPED_LANGUAGES = new Set([
  'Python',
  'Ruby',
  'Elixir',
  'Haskell',
  'CoffeeScript',
  'Nim',
]);

function countRegexMatches(line: string, pattern: RegExp): number {
  const matches = line.match(pattern);
  return matches ? matches.length : 0;
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
  complexity?: number;
  maxNesting?: number;
  functionCount?: number;
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
  const trackComplexity = !NON_LOGIC_COMPLEXITY_LANGUAGES.has(languageName);
  const useIndentNesting = INDENT_SCOPED_LANGUAGES.has(languageName);
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

  let complexity = 1;
  let functionCount = 0;
  let maxNesting = 0;
  let braceDepth = 0;

  for (let i = 0; i < lines; i++) {
    const rawLine = rawLines[i];
    const trimmed = rawLine.trim();
    if (trimmed.length === 0) {
      blankLines += 1;
      continue;
    }

    codeLines += 1;

    let isCommentLine = false;
    if (commentCapable) {
      if (style === 'apl') {
        if (trimmed.startsWith('⍝')) {
          commentLines += 1;
          isCommentLine = true;
        }
      } else if (style === 'hash') {
        if (trimmed.startsWith('#')) {
          commentLines += 1;
          isCommentLine = true;
        }
      } else if (style === 'dash') {
        if (inBlockComment) {
          commentLines += 1;
          isCommentLine = true;
          if (trimmed.includes('*/')) inBlockComment = false;
        } else if (trimmed.startsWith('--')) {
          commentLines += 1;
          isCommentLine = true;
        } else if (trimmed.startsWith('/*')) {
          commentLines += 1;
          isCommentLine = true;
          if (!trimmed.includes('*/')) inBlockComment = true;
        }
      } else if (style === 'html') {
        if (inBlockComment) {
          commentLines += 1;
          isCommentLine = true;
          if (trimmed.includes('-->')) inBlockComment = false;
        } else if (trimmed.startsWith('<!--')) {
          commentLines += 1;
          isCommentLine = true;
          if (!trimmed.includes('-->')) inBlockComment = true;
        }
      } else if (inBlockComment) {
        commentLines += 1;
        isCommentLine = true;
        if (trimmed.includes('*/')) inBlockComment = false;
      } else if (
        trimmed.startsWith('//') ||
        (languageName === 'PHP' && trimmed.startsWith('#'))
      ) {
        commentLines += 1;
        isCommentLine = true;
      } else if (trimmed.startsWith('/*')) {
        commentLines += 1;
        isCommentLine = true;
        if (!trimmed.includes('*/')) inBlockComment = true;
      }
    }

    if (!trackComplexity || isCommentLine) continue;

    // Strip quoted string literals and trailing single-line comments before scanning tokens
    let sanitized = trimmed.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');
    if (style === 'apl') {
      const commentIdx = sanitized.indexOf('⍝');
      if (commentIdx >= 0) sanitized = sanitized.slice(0, commentIdx);
    } else if (style === 'hash') {
      const commentIdx = sanitized.indexOf('#');
      if (commentIdx >= 0) sanitized = sanitized.slice(0, commentIdx);
    } else if (style === 'c') {
      const commentIdx = sanitized.indexOf('//');
      if (commentIdx >= 0) sanitized = sanitized.slice(0, commentIdx);
    } else if (style === 'dash') {
      const commentIdx = sanitized.indexOf('--');
      if (commentIdx >= 0) sanitized = sanitized.slice(0, commentIdx);
    }

    if (languageName === 'APL') {
      complexity += countRegexMatches(
        sanitized,
        /:(?:If|ElseIf|For|While|Repeat|Select|Case|Trap)\b/gi
      );
      complexity += countRegexMatches(sanitized, /→/g);
      complexity += countRegexMatches(sanitized, /(?<=\S\s*):(?=\s*\S)/g);
      functionCount += countRegexMatches(sanitized, /∇|\{/g);
    } else {
      complexity += countRegexMatches(
        sanitized,
        /\b(?:if|else\s+if|elif|elsif|case|catch|except|rescue|when|for|foreach|while|until|match)\b/g
      );
      complexity += countRegexMatches(sanitized, /&&|\|\||\?\?/g);
      complexity += countRegexMatches(sanitized, /\s\?\s/g);
      functionCount += countRegexMatches(
        sanitized,
        /\b(?:function|def|fn|func|sub|proc)\b|=>/g
      );
    }

    if (useIndentNesting) {
      const leadingMatch = rawLine.match(/^[ \t]*/);
      const leadingStr = leadingMatch ? leadingMatch[0] : '';
      const spaces = leadingStr.replace(/\t/g, '    ').length;
      const step =
        languageName === 'Ruby' || languageName === 'Elixir' ? 2 : 4;
      const depth = Math.min(16, Math.floor(spaces / step));
      if (depth > maxNesting) maxNesting = depth;
    } else {
      const opens = countRegexMatches(sanitized, /\{/g);
      const closes = countRegexMatches(sanitized, /\}/g);
      braceDepth = Math.max(0, braceDepth + opens);
      if (braceDepth > maxNesting) maxNesting = Math.min(16, braceDepth);
      braceDepth = Math.max(0, braceDepth - closes);
    }
  }

  return {
    lines,
    codeLines,
    blankLines,
    commentLines,
    commentCapable,
    ...(trackComplexity
      ? {
          complexity,
          maxNesting,
          functionCount: Math.max(functionCount, complexity > 1 ? 1 : 0),
        }
      : {}),
  };
}

function buildFileRefactoringRecommendation(
  file: AnalyzedFile
): RefactoringRecommendation | null {
  const complexity = file.complexity ?? 1;
  const maxNesting = file.maxNesting ?? 0;
  const functionCount = file.functionCount ?? 1;

  const isFlagged =
    complexity >= 15 ||
    (maxNesting >= 5 && file.codeLines >= 100) ||
    (file.codeLines >= 450 && complexity >= 10);

  if (!isFlagged) return null;

  const severity: RefactoringRecommendation['severity'] =
    complexity >= 50 || (maxNesting >= 7 && complexity >= 25)
      ? 'critical'
      : complexity >= 25 || maxNesting >= 5
        ? 'high'
        : 'moderate';

  const categories: RefactoringCategory[] = [];
  if (maxNesting >= 4) {
    categories.push('flatten-nesting');
  }
  if (complexity >= 18 && complexity / Math.max(1, functionCount) >= 7) {
    categories.push('extract-functions');
  }
  if (complexity >= 22) {
    categories.push('simplify-conditionals');
  }
  if (file.codeLines >= 350 || file.sizeBytes >= 40 * 1024) {
    categories.push('split-module');
  }
  if (
    getCommentStyle(file.language) !== 'none' &&
    (file.commentLines ?? 0) / Math.max(1, file.codeLines) < 0.05 &&
    complexity >= 18
  ) {
    categories.push('add-documentation');
  }

  if (categories.length === 0) {
    categories.push('extract-functions');
  }

  return {
    path: file.path,
    language: file.language,
    color: file.color,
    lines: file.lines,
    codeLines: file.codeLines,
    sizeBytes: file.sizeBytes,
    complexity,
    maxNesting,
    functionCount,
    severity,
    categories: categories.slice(0, 3),
  };
}

function computeComplexityMetrics(files: AnalyzedFile[]): ComplexityMetrics {
  const logicFiles = files.filter((f) => typeof f.complexity === 'number');
  const logicFilesCount = logicFiles.length;

  if (logicFilesCount === 0) {
    return {
      score: 100,
      avgComplexity: 1,
      maxComplexity: 1,
      highComplexityFilesCount: 0,
      avgNestingDepth: 0,
      logicFilesCount: 0,
      recommendations: [],
    };
  }

  let totalComplexity = 0;
  let totalNesting = 0;
  let maxComplexity = 1;
  let highComplexityFilesCount = 0;
  const recommendations: RefactoringRecommendation[] = [];

  for (const f of logicFiles) {
    const c = f.complexity ?? 1;
    const n = f.maxNesting ?? 0;
    totalComplexity += c;
    totalNesting += n;
    if (c > maxComplexity) maxComplexity = c;
    if (c >= 15 || (n >= 5 && f.codeLines >= 100)) {
      highComplexityFilesCount += 1;
    }

    const rec = buildFileRefactoringRecommendation(f);
    if (rec) {
      recommendations.push(rec);
    }
  }

  recommendations.sort((a, b) => {
    const rankA = a.complexity * 1.5 + a.maxNesting * 4 + a.codeLines / 60;
    const rankB = b.complexity * 1.5 + b.maxNesting * 4 + b.codeLines / 60;
    return rankB - rankA;
  });

  const avgComplexity = Number((totalComplexity / logicFilesCount).toFixed(1));
  const avgNestingDepth = Number((totalNesting / logicFilesCount).toFixed(1));
  const highRatio = highComplexityFilesCount / logicFilesCount;

  const avgPenalty = Math.max(0, avgComplexity - 5) * 2.2;
  const highRatioPenalty = highRatio * 95;
  const nestingPenalty = Math.max(0, avgNestingDepth - 2.2) * 8;
  const peakPenalty = Math.max(0, maxComplexity - 40) * 0.15;

  const score = Math.max(
    5,
    Math.min(
      100,
      Math.round(100 - avgPenalty - highRatioPenalty - nestingPenalty - peakPenalty)
    )
  );

  return {
    score,
    avgComplexity,
    maxComplexity,
    highComplexityFilesCount,
    avgNestingDepth,
    logicFilesCount,
    recommendations: recommendations.slice(0, 8),
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

  let rawCommentScore = 35;
  if (commentDataAvailable) {
    if (commentRatioPct >= 10 && commentRatioPct <= 30) {
      rawCommentScore = 50;
    } else if (commentRatioPct < 10) {
      rawCommentScore = 15 + (commentRatioPct / 10) * 35;
    } else {
      rawCommentScore = Math.max(25, 50 - ((commentRatioPct - 30) / 40) * 25);
    }
  }

  const complexity = computeComplexityMetrics(files);

  if (analyzedCount === 0) {
    return {
      score: 0,
      commentScore: 0,
      fileSizeScore: 0,
      complexityScore: 0,
      commentLines: 0,
      commentCapableLines: 0,
      commentRatioPct: 0,
      commentDataAvailable: false,
      avgFileSizeBytes: 0,
      medianFileSizeBytes: 0,
      oversizedFilesCount: 0,
      healthySizeFilesPct: 100,
      complexity,
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

  let rawFileSizeScore = 50;
  rawFileSizeScore -= Math.min(25, oversizedRatio * 125);
  if (avgKb > 20) {
    rawFileSizeScore -= Math.min(15, ((avgKb - 20) / 80) * 15);
  }
  if (emptyRatio > 0.1) {
    rawFileSizeScore -= Math.min(10, (emptyRatio - 0.1) * 50);
  }
  rawFileSizeScore = Math.max(0, Math.min(50, rawFileSizeScore));

  const healthySizeFilesPct = Number(
    (((analyzedCount - oversizedFilesCount) / analyzedCount) * 100).toFixed(1)
  );

  // Weighted Code Health breakdown: Comments (35) + File Size (35) + Cyclomatic Complexity (30) = 100
  const commentScore = Math.round((rawCommentScore / 50) * 35);
  const fileSizeScore = Math.round((rawFileSizeScore / 50) * 35);
  const complexityScore = Math.round((complexity.score / 100) * 30);
  const score = Math.max(
    0,
    Math.min(100, commentScore + fileSizeScore + complexityScore)
  );

  return {
    score,
    commentScore,
    fileSizeScore,
    complexityScore,
    commentLines: totalCommentLines,
    commentCapableLines,
    commentRatioPct,
    commentDataAvailable,
    avgFileSizeBytes,
    medianFileSizeBytes,
    oversizedFilesCount,
    healthySizeFilesPct,
    complexity,
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
    let commitRefs: CommitRef[] = [];
    let commitsSampledCount = 0;
    let rateLimitRemaining: number | null = null;

    const metaResp = await fetch(metaUrl, {
      signal: abortController.signal,
      headers: buildGitHubHeaders(),
    });
    rateLimitRemaining = parseRateLimitRemaining(metaResp.headers);

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
      commitRefs = activityFetch?.commitRefs ?? [];
      commitsSampledCount = activityFetch?.commitsSampledCount ?? 0;
      if (
        activityFetch?.rateLimitRemaining !== null &&
        activityFetch?.rateLimitRemaining !== undefined
      ) {
        rateLimitRemaining = activityFetch.rateLimitRemaining;
      }

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
          ...(typeof counts.complexity === 'number'
            ? {
                complexity: counts.complexity,
                maxNesting: counts.maxNesting,
                functionCount: counts.functionCount,
              }
            : {}),
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

    const snapshotCache = new Map<string, Promise<ParsedSnapshotStats | null>>();
    const trackedTop5Names = new Set(languages.slice(0, 5).map((l) => l.name));

    const [languageHistoryOutcome, languageAdoptionOutcome] =
      await Promise.allSettled([
        oneMonthAgoRef && bytesDownloaded <= MAX_HISTORICAL_ARCHIVE_BYTES
          ? fetchOneMonthAgoLanguageSnapshot(
              owner,
              repo,
              oneMonthAgoRef,
              latestCommitSha,
              languages,
              totalLines,
              codeLines,
              snapshotCache,
              trackedTop5Names,
              abortController.signal
            )
          : Promise.resolve(null),
        !metadataRateLimited && languages.length > 0
          ? fetchLanguageAdoptionTrend(
              owner,
              repo,
              metadata.defaultBranch,
              bytesDownloaded,
              languages,
              filesList,
              totalLines,
              codeLines,
              latestCommitSha,
              commitRefs,
              commitsSampledCount,
              rateLimitRemaining,
              snapshotCache,
              abortController.signal
            )
          : Promise.resolve(null),
      ]);

    const languageHistory =
      languageHistoryOutcome.status === 'fulfilled'
        ? languageHistoryOutcome.value
        : null;
    const languageAdoption =
      languageAdoptionOutcome.status === 'fulfilled'
        ? languageAdoptionOutcome.value
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
      languageAdoption,
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
