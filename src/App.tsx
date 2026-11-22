import {
  AlertCircle,
  ExternalLink,
  FileDown,
  GitBranch,
  GitCompareArrows,
  GitFork,
  Loader2,
  Star,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityHistory } from './components/ActivityHistory.tsx';
import {
  FileExplorer,
  type FileFilterState,
} from './components/FileExplorer.tsx';
import { Header } from './components/Header.tsx';
import { LanguageBreakdown } from './components/LanguageBreakdown.tsx';
import { OfflineIndicator } from './components/OfflineIndicator.tsx';
import { PdfReportSheet } from './components/PdfReportSheet.tsx';
import { ProgressPanel } from './components/ProgressPanel.tsx';
import { RepoComparison } from './components/RepoComparison.tsx';
import { RepoSearchBar } from './components/RepoSearchBar.tsx';
import { exportReportToPdf } from './lib/exportPdf.ts';
import { resolveCodeHealth } from './lib/health.ts';
import { DICTIONARY, formatMessage, formatNumber } from './lib/i18n.ts';
import { formatBytes } from './lib/languageMap.ts';
import type {
  AnalysisProgressEvent,
  AnalysisResult,
  AppLanguage,
  CodeHealthMetrics,
  StreamEvent,
} from './lib/types.ts';

const INITIAL_FILTERS: FileFilterState = {
  query: '',
  searchScope: 'filename',
  language: 'ALL',
  extension: 'ALL',
  sizePreset: 'all',
  minKb: '',
  maxKb: '',
  sort: 'lines-desc',
};

function getInitialLanguage(): AppLanguage {
  try {
    const saved = localStorage.getItem('codegauge_lang');
    if (saved === 'ar' || saved === 'en') return saved;
  } catch {
    // Ignore storage errors
  }
  return 'en';
}

function normalizeRepoKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?github\.com\//, '')
    .replace(/\.git$/, '')
    .replace(/\/+$/, '');
}

function getCachedResult(): AnalysisResult | null {
  try {
    const raw = localStorage.getItem('codegauge_last_result');
    if (!raw) return null;
    return JSON.parse(raw) as AnalysisResult;
  } catch {
    return null;
  }
}

export default function App() {
  const [lang, setLang] = useState<AppLanguage>(getInitialLanguage);
  const initialCached = useMemo(() => getCachedResult(), []);
  const [repoUrl, setRepoUrl] = useState(
    initialCached?.repository.htmlUrl ?? ''
  );
  const [analyzedPrimaryKey, setAnalyzedPrimaryKey] = useState(
    initialCached ? normalizeRepoKey(initialCached.repository.fullName) : ''
  );
  const [isLoadingA, setIsLoadingA] = useState(false);
  const [progressA, setProgressA] = useState<AnalysisProgressEvent | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(initialCached);

  const [compareMode, setCompareMode] = useState(false);
  const [secondRepoUrl, setSecondRepoUrl] = useState('');
  const [isLoadingB, setIsLoadingB] = useState(false);
  const [progressB, setProgressB] = useState<AnalysisProgressEvent | null>(null);
  const [compareResult, setCompareResult] = useState<AnalysisResult | null>(null);
  const [activeRepoTab, setActiveRepoTab] = useState<'A' | 'B'>('A');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filters, setFilters] = useState<FileFilterState>(INITIAL_FILTERS);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [includeDetailedBreakdown, setIncludeDetailedBreakdown] = useState(true);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const eventSourceARef = useRef<EventSource | null>(null);
  const eventSourceBRef = useRef<EventSource | null>(null);
  const initializedFromUrlRef = useRef(false);
  const t = DICTIONARY[lang];

  const isLoading = isLoadingA || isLoadingB;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem('codegauge_lang', lang);
    } catch {
      // Ignore storage errors
    }
  }, [lang]);

  useEffect(() => {
    if (!result) return;
    try {
      const compact: AnalysisResult = {
        ...result,
        files: result.files.slice(0, 1500),
      };
      localStorage.setItem('codegauge_last_result', JSON.stringify(compact));
    } catch {
      // Ignore storage quota errors
    }
  }, [result]);

  useEffect(() => {
    return () => {
      eventSourceARef.current?.close();
      eventSourceBRef.current?.close();
    };
  }, []);

  const mapErrorCode = useCallback(
    (code: string, fallback?: string): string => {
      switch (code) {
        case 'INVALID_URL':
          return t.errorInvalidUrl;
        case 'NOT_FOUND':
          return t.errorNotFound;
        case 'RATE_LIMIT':
          return t.errorRateLimit;
        case 'ARCHIVE_TOO_LARGE':
          return t.errorArchiveTooLarge;
        default:
          return fallback || t.errorGeneric;
      }
    },
    [t]
  );

  const handleCancel = useCallback(() => {
    eventSourceARef.current?.close();
    eventSourceARef.current = null;
    eventSourceBRef.current?.close();
    eventSourceBRef.current = null;
    setIsLoadingA(false);
    setIsLoadingB(false);
    setProgressA(null);
    setProgressB(null);
  }, []);

  const startStream = useCallback(
    (
      targetUrl: string,
      esRef: { current: EventSource | null },
      setLoading: (v: boolean) => void,
      setProg: (p: AnalysisProgressEvent | null) => void,
      onComplete: (data: AnalysisResult) => void
    ) => {
      esRef.current?.close();
      esRef.current = null;

      setLoading(true);
      setProg({
        type: 'progress',
        stage: 'connecting',
        progress: 4,
        bytesDownloaded: 0,
        totalBytes: null,
        filesProcessed: 0,
        linesCounted: 0,
      });

      const streamUrl = `/api/analyze?url=${encodeURIComponent(targetUrl)}`;
      const es = new EventSource(streamUrl);
      esRef.current = es;

      es.onmessage = (event) => {
        let parsed: StreamEvent;
        try {
          parsed = JSON.parse(event.data) as StreamEvent;
        } catch {
          return;
        }

        if (parsed.type === 'progress') {
          setProg(parsed);
        } else if (parsed.type === 'complete') {
          onComplete(parsed.data);
          setLoading(false);
          setProg(null);
          es.close();
          esRef.current = null;
        } else if (parsed.type === 'error') {
          setErrorMsg(mapErrorCode(parsed.code));
          setLoading(false);
          setProg(null);
          es.close();
          esRef.current = null;
        }
      };

      es.onerror = () => {
        if (esRef.current === es) {
          setErrorMsg(t.errorGeneric);
          setLoading(false);
          setProg(null);
          es.close();
          esRef.current = null;
        }
      };
    },
    [mapErrorCode, t.errorGeneric]
  );

  const handleAnalyze = useCallback(
    (primaryOverride?: string, secondaryOverride?: string) => {
      const targetA = (primaryOverride ?? repoUrl).trim();
      const targetB = (secondaryOverride ?? secondRepoUrl).trim();
      if (!targetA) return;

      setErrorMsg(null);
      setAvatarFailed(false);

      if ((compareMode || Boolean(secondaryOverride)) && targetB) {
        if (normalizeRepoKey(targetA) === normalizeRepoKey(targetB)) {
          setErrorMsg(t.errorSameRepo);
          return;
        }

        const primaryAlreadyAnalyzed =
          result !== null &&
          normalizeRepoKey(targetA) === analyzedPrimaryKey;

        if (!primaryAlreadyAnalyzed) {
          startStream(
            targetA,
            eventSourceARef,
            setIsLoadingA,
            setProgressA,
            (data) => {
              setResult(data);
              setAnalyzedPrimaryKey(normalizeRepoKey(targetA));
              setFilters(INITIAL_FILTERS);
            }
          );
        }

        startStream(
          targetB,
          eventSourceBRef,
          setIsLoadingB,
          setProgressB,
          (data) => {
            setCompareResult(data);
            setFilters(INITIAL_FILTERS);
          }
        );
      } else {
        setCompareResult(null);
        setActiveRepoTab('A');
        startStream(
          targetA,
          eventSourceARef,
          setIsLoadingA,
          setProgressA,
          (data) => {
            setResult(data);
            setAnalyzedPrimaryKey(normalizeRepoKey(targetA));
            setFilters(INITIAL_FILTERS);
          }
        );
      }
    },
    [
      repoUrl,
      secondRepoUrl,
      compareMode,
      result,
      analyzedPrimaryKey,
      startStream,
      t.errorSameRepo,
    ]
  );

  const inspectedResult =
    compareResult && activeRepoTab === 'B' ? compareResult : result;

  useEffect(() => {
    if (initializedFromUrlRef.current || typeof window === 'undefined') return;
    initializedFromUrlRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const sharedRepo = params.get('repo')?.trim() ?? '';
    const sharedCompare = params.get('compare')?.trim() ?? '';

    if (!sharedRepo || sharedRepo.length > 300) return;

    setRepoUrl(sharedRepo);
    if (sharedCompare && sharedCompare.length <= 300) {
      setCompareMode(true);
      setSecondRepoUrl(sharedCompare);
      handleAnalyze(sharedRepo, sharedCompare);
    } else {
      handleAnalyze(sharedRepo);
    }
  }, [handleAnalyze]);

  useEffect(() => {
    if (!result || typeof window === 'undefined') return;
    try {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('repo', result.repository.fullName);
      if (compareResult) {
        nextUrl.searchParams.set('compare', compareResult.repository.fullName);
      } else {
        nextUrl.searchParams.delete('compare');
      }
      window.history.replaceState({}, '', nextUrl.toString());
    } catch {
      // Ignore history API errors
    }
  }, [result, compareResult]);

  const headerHealth = useMemo<CodeHealthMetrics | null>(() => {
    if (!inspectedResult || isLoading) return null;
    return resolveCodeHealth(inspectedResult);
  }, [inspectedResult, isLoading]);

  const filteredFiles = useMemo(() => {
    if (!inspectedResult) return [];
    const tokens = filters.query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    let minBytes: number | null = null;
    let maxBytes: number | null = null;

    if (filters.sizePreset === 'tiny') {
      maxBytes = 1024;
    } else if (filters.sizePreset === 'small') {
      minBytes = 1024;
      maxBytes = 10 * 1024;
    } else if (filters.sizePreset === 'medium') {
      minBytes = 10 * 1024;
      maxBytes = 100 * 1024;
    } else if (filters.sizePreset === 'large') {
      minBytes = 100 * 1024;
    } else {
      const parsedMin = Number(filters.minKb);
      const parsedMax = Number(filters.maxKb);
      if (filters.minKb.trim() !== '' && Number.isFinite(parsedMin) && parsedMin >= 0) {
        minBytes = parsedMin * 1024;
      }
      if (filters.maxKb.trim() !== '' && Number.isFinite(parsedMax) && parsedMax >= 0) {
        maxBytes = parsedMax * 1024;
      }
    }

    const list = inspectedResult.files.filter((file) => {
      if (tokens.length > 0) {
        const targetText =
          filters.searchScope === 'filename'
            ? file.name.toLowerCase()
            : file.path.toLowerCase();
        for (const token of tokens) {
          if (!targetText.includes(token)) return false;
        }
      }
      if (filters.language !== 'ALL' && file.language !== filters.language)
        return false;
      if (filters.extension !== 'ALL' && file.extension !== filters.extension)
        return false;
      if (minBytes !== null && file.sizeBytes < minBytes) return false;
      if (maxBytes !== null && file.sizeBytes > maxBytes) return false;
      return true;
    });

    list.sort((a, b) => {
      switch (filters.sort) {
        case 'lines-asc':
          return a.lines - b.lines || a.sizeBytes - b.sizeBytes;
        case 'size-desc':
          return b.sizeBytes - a.sizeBytes || b.lines - a.lines;
        case 'size-asc':
          return a.sizeBytes - b.sizeBytes || a.lines - b.lines;
        case 'path-asc':
          return a.path.localeCompare(b.path);
        case 'lines-desc':
        default:
          return b.lines - a.lines || b.sizeBytes - a.sizeBytes;
      }
    });

    return list;
  }, [inspectedResult, filters]);

  const handleExportPdf = async () => {
    if (!inspectedResult || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 120));
      const safeName =
        `${inspectedResult.repository.owner}-${inspectedResult.repository.name}`.replace(
          /[^a-zA-Z0-9._-]/g,
          '-'
        );
      await exportReportToPdf(`${safeName}-code-report.pdf`);
    } catch {
      setErrorMsg(t.errorGeneric);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const safeRepoHref =
    result && result.repository.htmlUrl.startsWith('https://github.com/')
      ? result.repository.htmlUrl
      : '#';

  const handleClearComparison = () => {
    setCompareResult(null);
    setCompareMode(false);
    setSecondRepoUrl('');
    setActiveRepoTab('A');
    setFilters(INITIAL_FILTERS);
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-[#0B0F17] text-slate-100">
      <Header
        t={t}
        lang={lang}
        onToggleLang={() => setLang((prev) => (prev === 'en' ? 'ar' : 'en'))}
        hasResult={Boolean(result)}
        hasComparison={Boolean(result && compareResult)}
        health={headerHealth}
        shareResult={!isLoading ? inspectedResult : null}
        compareResult={!isLoading ? compareResult : null}
      />

      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {/* Hero / Repository Analyzer Bar */}
        <section className="pb-8">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl [text-wrap:balance]">
              {t.heroTitle}
            </h1>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-400 sm:text-[15px]">
              {t.heroSubtitle}
            </p>
          </div>

          <div className="mt-6">
            <RepoSearchBar
              t={t}
              repoUrl={repoUrl}
              onRepoUrlChange={setRepoUrl}
              compareMode={compareMode}
              onToggleCompareMode={() => {
                setCompareMode((prev) => {
                  const next = !prev;
                  if (!next) {
                    setCompareResult(null);
                    setActiveRepoTab('A');
                  }
                  return next;
                });
              }}
              secondRepoUrl={secondRepoUrl}
              onSecondRepoUrlChange={setSecondRepoUrl}
              onSubmit={handleAnalyze}
              onCancel={handleCancel}
              isLoading={isLoading}
            />
          </div>
        </section>

        {/* Error Banner */}
        {errorMsg && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-sm text-red-200"
          >
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0 text-red-400"
              aria-hidden="true"
            />
            <div>
              <div className="font-semibold text-red-100">{t.errorTitle}</div>
              <p className="mt-0.5 text-red-200/90">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Live Fetching & Parsing Progress Indicators */}
        {isLoading && (progressA || progressB) && (
          <div className="mb-6 space-y-4">
            {progressA && (
              <div>
                {compareMode && (
                  <div className="mb-1.5 text-xs font-medium text-sky-400">
                    {t.repoALabel}
                  </div>
                )}
                <ProgressPanel t={t} lang={lang} progress={progressA} />
              </div>
            )}
            {progressB && (
              <div>
                <div className="mb-1.5 text-xs font-medium text-emerald-400">
                  {t.repoBLabel}
                </div>
                <ProgressPanel t={t} lang={lang} progress={progressB} />
              </div>
            )}
          </div>
        )}

        {/* Analysis Dashboard Results */}
        {result && !isLoading && (
          <div className="space-y-8">
            {/* Repository Overview Header + Export PDF */}
            <section id="overview" className="border-t border-slate-800/80 pt-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3.5 min-w-0">
                  {result.repository.avatarUrl && !avatarFailed ? (
                    <img
                      src={result.repository.avatarUrl}
                      alt={result.repository.owner}
                      referrerPolicy="no-referrer"
                      onError={() => setAvatarFailed(true)}
                      className="h-11 w-11 shrink-0 rounded-lg border border-slate-700/80 object-cover bg-slate-800"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800 font-mono text-sm font-bold text-sky-400">
                      {result.repository.owner.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <a
                        href={safeRepoHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        dir="ltr"
                        className="inline-flex items-center gap-1.5 truncate font-mono text-base font-bold text-slate-50 hover:text-sky-400 transition-colors sm:text-lg"
                      >
                        <span className="truncate">{result.repository.fullName}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                      </a>
                    </div>

                    {result.repository.description && (
                      <p className="mt-1 text-sm text-slate-400 line-clamp-2">
                        {result.repository.description}
                      </p>
                    )}

                    {/* Zero-pill unboxed metadata row */}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <GitBranch className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                        <span>{t.branchLabel}:</span>
                        <span dir="ltr" className="font-mono text-slate-200">
                          {result.repository.defaultBranch}
                        </span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Star className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                        <span>{formatNumber(result.repository.stars, lang)}</span>
                        <span>{t.starsLabel}</span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <GitFork className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                        <span>{formatNumber(result.repository.forks, lang)}</span>
                        <span>{t.forksLabel}</span>
                      </span>
                      {result.repository.license && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            {t.licenseLabel}: {result.repository.license}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Toolbar Actions */}
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  {!compareMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setCompareMode(true);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    >
                      <GitCompareArrows className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                      <span>{t.compareModeButton}</span>
                    </button>
                  )}

                  <label className="inline-flex min-h-[42px] items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeDetailedBreakdown}
                      onChange={(e) => setIncludeDetailedBreakdown(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-600 bg-[#0B0F17] accent-sky-500 cursor-pointer"
                    />
                    <span>{t.pdfIncludeDetailedBreakdown}</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleExportPdf}
                    disabled={isExportingPdf}
                    className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400 transition-colors disabled:opacity-60 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                  >
                    {isExportingPdf ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <FileDown className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>{isExportingPdf ? t.exportingPdf : t.exportPdf}</span>
                  </button>
                </div>
              </div>

              {/* 4-Column KPI Strip (single elevation cards) */}
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-800/80 bg-[#111827] p-5">
                  <div className="text-xs font-medium text-slate-400">
                    {t.kpiTotalLines}
                  </div>
                  <div className="mt-1.5 font-mono text-2xl font-bold text-slate-50 tabular-nums">
                    {formatNumber(result.summary.totalLines, lang)}
                  </div>
                  <div className="mt-1 text-xs text-slate-400 tabular-nums">
                    {formatMessage(t.kpiCodeLinesSub, {
                      code: formatNumber(result.summary.codeLines, lang),
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800/80 bg-[#111827] p-5">
                  <div className="text-xs font-medium text-slate-400">
                    {t.kpiLanguages}
                  </div>
                  <div className="mt-1.5 font-mono text-2xl font-bold text-slate-50 tabular-nums">
                    {formatNumber(result.summary.languageCount, lang)}
                  </div>
                  <div className="mt-1 text-xs text-slate-400 truncate">
                    {formatMessage(t.kpiPrimaryLangSub, {
                      lang: result.languages[0]?.name ?? '-',
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800/80 bg-[#111827] p-5">
                  <div className="text-xs font-medium text-slate-400">
                    {t.kpiAnalyzedFiles}
                  </div>
                  <div className="mt-1.5 font-mono text-2xl font-bold text-slate-50 tabular-nums">
                    {formatNumber(result.summary.analyzedFiles, lang)}
                  </div>
                  <div className="mt-1 text-xs text-slate-400 tabular-nums">
                    {formatMessage(t.kpiSkippedBinarySub, {
                      skipped: formatNumber(
                        result.summary.skippedBinaryFiles +
                          result.summary.skippedLargeFiles,
                        lang
                      ),
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800/80 bg-[#111827] p-5">
                  <div className="text-xs font-medium text-slate-400">
                    {t.kpiTotalSize}
                  </div>
                  <div className="mt-1.5 font-mono text-2xl font-bold text-slate-50 tabular-nums">
                    {formatBytes(result.summary.totalSizeBytes)}
                  </div>
                  <div className="mt-1 text-xs text-slate-400 tabular-nums">
                    {formatMessage(t.kpiDurationSub, {
                      seconds: (
                        result.summary.analysisDurationMs / 1000
                      ).toFixed(1),
                    })}
                  </div>
                </div>
              </div>

              {/* Repository Activity History & Commit Frequency */}
              <ActivityHistory
                t={t}
                lang={lang}
                repository={result.repository}
              />
            </section>

            {/* Side-by-Side Comparison Section when 2nd repository is loaded */}
            {compareResult && (
              <RepoComparison
                t={t}
                lang={lang}
                repoA={result}
                repoB={compareResult}
                onClearComparison={handleClearComparison}
              />
            )}

            {/* Segmented Repository Switcher for Detailed Language & File Breakdown when comparing */}
            {compareResult && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-6">
                <span className="text-sm font-medium text-slate-300">
                  {t.comparingFileExplorerLabel}:
                </span>
                <div className="inline-flex items-center rounded-lg border border-slate-800 bg-[#111827] p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRepoTab('A');
                      setFilters(INITIAL_FILTERS);
                    }}
                    className={`rounded-md px-3.5 py-1.5 font-mono text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      activeRepoTab === 'A'
                        ? 'bg-sky-500/20 text-sky-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {result.repository.fullName}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRepoTab('B');
                      setFilters(INITIAL_FILTERS);
                    }}
                    className={`rounded-md px-3.5 py-1.5 font-mono text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      activeRepoTab === 'B'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {compareResult.repository.fullName}
                  </button>
                </div>
              </div>
            )}

            {/* Language Breakdown Section (with Recharts BarChart + Growth + Donut + Table) */}
            {inspectedResult && (
              <LanguageBreakdown
                t={t}
                lang={lang}
                languages={inspectedResult.languages}
                totalLines={inspectedResult.summary.totalLines}
                selectedLanguage={filters.language}
                languageHistory={inspectedResult.languageHistory}
                onSelectLanguage={(selectedLang) =>
                  setFilters((prev) => ({
                    ...prev,
                    language: selectedLang,
                  }))
                }
              />
            )}

            {/* File Explorer with Search, File Type & Size Filters */}
            {inspectedResult && (
              <FileExplorer
                t={t}
                lang={lang}
                files={inspectedResult.files}
                languages={inspectedResult.languages}
                filesTruncated={inspectedResult.summary.filesTruncated}
                filters={filters}
                onFiltersChange={setFilters}
                filteredFiles={filteredFiles}
              />
            )}
          </div>
        )}

        {/* Initial Empty State */}
        {!result && !isLoading && (
          <section id="capabilities" className="border-t border-slate-800/80 pt-8">
            <h2 className="text-base font-semibold text-slate-100">
              {t.emptyStateTitle}
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-400 leading-relaxed">
              {t.emptyStateDesc}
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-slate-800/80 bg-[#111827] p-5">
                <h3 className="text-sm font-semibold text-slate-100">
                  01. {t.featureAplTitle}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                  {t.featureAplDesc}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-[#111827] p-5">
                <h3 className="text-sm font-semibold text-slate-100">
                  02. {t.featureFilterTitle}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                  {t.featureFilterDesc}
                </p>
              </div>

              <div className="rounded-xl border border-slate-800/80 bg-[#111827] p-5">
                <h3 className="text-sm font-semibold text-slate-100">
                  03. {t.featurePdfTitle}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                  {t.featurePdfDesc}
                </p>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="border-t border-slate-800/80 py-5 text-center text-xs text-slate-500">
        {t.footerNote}
      </footer>

      <OfflineIndicator t={t} />

      {/* Off-screen PDF report container mounted only during export */}
      {inspectedResult && isExportingPdf && (
        <PdfReportSheet
          t={t}
          lang={lang}
          result={inspectedResult}
          compareResult={
            activeRepoTab === 'A' ? compareResult : result
          }
          filteredFiles={filteredFiles}
          filters={filters}
          includeDetailedBreakdown={includeDetailedBreakdown}
        />
      )}
    </div>
  );
}
