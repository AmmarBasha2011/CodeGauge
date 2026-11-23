import { ExternalLink, GitBranch, Star, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  computeCodeDensity,
  computeCodeSimplicity,
  resolveCodeHealth,
} from '../lib/health.ts';
import { formatMessage, formatNumber, type Translations } from '../lib/i18n.ts';
import { formatBytes } from '../lib/languageMap.ts';
import type { AnalysisResult, AnalyzedFile, AppLanguage } from '../lib/types.ts';
import { formatRelativeDate } from './ActivityHistory.tsx';

interface RepoComparisonProps {
  t: Translations;
  lang: AppLanguage;
  repoA: AnalysisResult;
  repoB: AnalysisResult;
  onClearComparison: () => void;
}

interface MergedLanguageRow {
  name: string;
  color: string;
  aLines: number;
  aCodeLines: number;
  aPct: number;
  bLines: number;
  bCodeLines: number;
  bPct: number;
  diffLines: number;
}

interface HealthRadarPoint {
  axis: string;
  scoreA: number;
  scoreB: number;
  rawA: string;
  rawB: string;
}

type RadarMode = 'percentage' | 'raw';
type HeatmapFocus = 'all' | 'size' | 'complexity';
type FileTypeMetric = 'percentage' | 'codeLines' | 'files';
type FileCategoryKey = 'source' | 'tests' | 'docs' | 'config' | 'other';

interface FileCategoryBucket {
  files: number;
  codeLines: number;
  lines: number;
}

const FILE_CATEGORY_COLORS: Record<FileCategoryKey, string> = {
  source: '#38BDF8',
  tests: '#10B981',
  docs: '#F59E0B',
  config: '#A78BFA',
  other: '#64748B',
};

const TEST_DIR_RE =
  /(?:^|\/)(?:test|tests|__tests__|spec|specs|e2e|integration|unit|cypress|playwright|__mocks__|fixtures|testdata)\//i;
const TEST_FILE_RE =
  /(?:\.(?:test|spec|e2e|cy|stories)\.[^.]+$|_test\.(?:go|py|rs|rb|c|cpp|ts|js|tsx|jsx)$|^test_.*\.(?:py|rb|sh|c|cpp)$|tests?\.(?:java|kt|cs|scala|swift)$)/i;
const DOC_DIR_RE = /(?:^|\/)(?:docs?|documentation|wiki|guides?)\//i;
const DOC_FILE_RE =
  /^(?:readme|license|licence|changelog|changes|history|contributing|code_of_conduct|security|authors|contributors|notice|copying|maintainers)(?:\..*)?$/i;
const DOC_LANGUAGES = new Set([
  'Markdown',
  'MDX',
  'reStructuredText',
]);
const CONFIG_DIR_RE =
  /(?:^|\/)(?:\.github|\.gitlab|\.circleci|\.vscode|\.husky|configs?)\//i;
const CONFIG_FILE_RE =
  /^(?:package\.json|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|tsconfig(?:\.[^.]+)?\.json|jsconfig\.json|vite\.config\.[^.]+|webpack\.config\.[^.]+|rollup\.config\.[^.]+|eslint.*|\.eslintrc.*|prettier.*|\.prettierrc.*|babel\.config\.[^.]+|\.babelrc.*|cargo\.toml|cargo\.lock|go\.mod|go\.sum|pyproject\.toml|setup\.py|setup\.cfg|requirements[^/]*\.txt|gemfile(?:\.lock)?|pom\.xml|build\.gradle(?:\.kts)?|makefile|dockerfile(?:\.[^/]+)?|docker-compose[^/]*\.ya?ml|\.env(?:\.[^/]+)?)$/i;
const CONFIG_LANGUAGES = new Set([
  'JSON',
  'YAML',
  'TOML',
  'INI',
  'Config',
  'EditorConfig',
  'Git Config',
  'Ignore List',
  'Dockerfile',
  'Makefile',
  'CMake',
  'Just',
  'Nix',
  'HCL',
  'XML',
  'Properties',
]);
const MARKUP_OTHER_LANGUAGES = new Set([
  'CSS',
  'SCSS',
  'Sass',
  'Less',
  'HTML',
  'SVG',
  'CSV',
  'Text',
  'Other',
]);

function classifyRepoFile(file: AnalyzedFile): FileCategoryKey {
  const normalizedPath = file.path.replace(/\\/g, '/');
  const fileName = file.name;

  if (TEST_DIR_RE.test(normalizedPath) || TEST_FILE_RE.test(fileName)) {
    return 'tests';
  }

  if (
    DOC_LANGUAGES.has(file.language) ||
    DOC_FILE_RE.test(fileName) ||
    (DOC_DIR_RE.test(normalizedPath) &&
      (file.language === 'Text' || file.language === 'HTML' || file.language === 'Other'))
  ) {
    return 'docs';
  }

  if (
    CONFIG_LANGUAGES.has(file.language) ||
    CONFIG_FILE_RE.test(fileName) ||
    CONFIG_DIR_RE.test(normalizedPath)
  ) {
    return 'config';
  }

  if (MARKUP_OTHER_LANGUAGES.has(file.language)) {
    return 'other';
  }

  return 'source';
}

function summarizeFileCategories(
  files: AnalyzedFile[]
): Record<FileCategoryKey, FileCategoryBucket> {
  const totals: Record<FileCategoryKey, FileCategoryBucket> = {
    source: { files: 0, codeLines: 0, lines: 0 },
    tests: { files: 0, codeLines: 0, lines: 0 },
    docs: { files: 0, codeLines: 0, lines: 0 },
    config: { files: 0, codeLines: 0, lines: 0 },
    other: { files: 0, codeLines: 0, lines: 0 },
  };

  for (const file of files) {
    const key = classifyRepoFile(file);
    totals[key].files += 1;
    totals[key].codeLines += file.codeLines;
    totals[key].lines += file.lines;
  }

  return totals;
}

interface HeatmapCellInfo {
  file: AnalyzedFile;
  intensity: number;
  isSizeHotspot: boolean;
  isComplexHotspot: boolean;
  sizeRatio: number;
  linesRatio: number;
}

interface HeatmapRow {
  rank: number;
  cellA: HeatmapCellInfo | null;
  cellB: HeatmapCellInfo | null;
}

function getHeatmapCellStyle(
  intensity: number,
  isHotspot: boolean
): string {
  if (isHotspot) {
    return 'bg-amber-500/20 ring-1 ring-inset ring-amber-400/50';
  }
  if (intensity >= 0.55) {
    return 'bg-indigo-500/25';
  }
  if (intensity >= 0.25) {
    return 'bg-sky-500/15';
  }
  return 'bg-slate-800/35';
}

function formatCompactAxis(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

function formatSignedDiff(diff: number, lang: AppLanguage): string {
  if (diff === 0) return '0';
  const sign = diff > 0 ? '+' : '-';
  return `${sign}${formatNumber(Math.abs(diff), lang)}`;
}

export function RepoComparison({
  t,
  lang,
  repoA,
  repoB,
  onClearComparison,
}: RepoComparisonProps) {
  const mergedLanguages = useMemo<MergedLanguageRow[]>(() => {
    const map = new Map<string, MergedLanguageRow>();

    for (const item of repoA.languages) {
      map.set(item.name, {
        name: item.name,
        color: item.color,
        aLines: item.lines,
        aCodeLines: item.codeLines,
        aPct: item.percentage,
        bLines: 0,
        bCodeLines: 0,
        bPct: 0,
        diffLines: item.lines,
      });
    }

    for (const item of repoB.languages) {
      const existing = map.get(item.name);
      if (existing) {
        existing.bLines = item.lines;
        existing.bCodeLines = item.codeLines;
        existing.bPct = item.percentage;
        existing.diffLines = existing.aLines - item.lines;
      } else {
        map.set(item.name, {
          name: item.name,
          color: item.color,
          aLines: 0,
          aCodeLines: 0,
          aPct: 0,
          bLines: item.lines,
          bCodeLines: item.codeLines,
          bPct: item.percentage,
          diffLines: -item.lines,
        });
      }
    }

    return Array.from(map.values()).sort(
      (x, y) => Math.max(y.aLines, y.bLines) - Math.max(x.aLines, x.bLines)
    );
  }, [repoA.languages, repoB.languages]);

  const topChartLanguages = useMemo(
    () => mergedLanguages.slice(0, 10),
    [mergedLanguages]
  );

  const healthA = useMemo(() => resolveCodeHealth(repoA), [repoA]);
  const healthB = useMemo(() => resolveCodeHealth(repoB), [repoB]);
  const [radarMode, setRadarMode] = useState<RadarMode>('percentage');

  const percentageRadarData = useMemo<HealthRadarPoint[]>(() => {
    const simplicityA = computeCodeSimplicity(repoA);
    const simplicityB = computeCodeSimplicity(repoB);
    const densityA = computeCodeDensity(repoA);
    const densityB = computeCodeDensity(repoB);
    const compScoreA = healthA.complexity?.score ?? simplicityA.score;
    const compScoreB = healthB.complexity?.score ?? simplicityB.score;

    return [
      {
        axis: t.radarAxisOverall,
        scoreA: healthA.score,
        scoreB: healthB.score,
        rawA: `${formatNumber(healthA.score, lang)} / 100`,
        rawB: `${formatNumber(healthB.score, lang)} / 100`,
      },
      {
        axis: t.radarAxisComments,
        scoreA: Math.round((healthA.commentScore / 35) * 100),
        scoreB: Math.round((healthB.commentScore / 35) * 100),
        rawA: healthA.commentDataAvailable
          ? `${healthA.commentRatioPct}%`
          : t.unavailableLabel,
        rawB: healthB.commentDataAvailable
          ? `${healthB.commentRatioPct}%`
          : t.unavailableLabel,
      },
      {
        axis: t.radarAxisFileSize,
        scoreA: Math.round((healthA.fileSizeScore / 35) * 100),
        scoreB: Math.round((healthB.fileSizeScore / 35) * 100),
        rawA: `${healthA.healthySizeFilesPct}% ≤ 50 KB`,
        rawB: `${healthB.healthySizeFilesPct}% ≤ 50 KB`,
      },
      {
        axis: t.healthComplexityScoreLabel,
        scoreA: compScoreA,
        scoreB: compScoreB,
        rawA: healthA.complexity
          ? `M = ${formatNumber(healthA.complexity.avgComplexity, lang)}`
          : formatMessage(t.radarLinesPerFileUnit, {
              lines: formatNumber(simplicityA.avgLinesPerFile, lang),
            }),
        rawB: healthB.complexity
          ? `M = ${formatNumber(healthB.complexity.avgComplexity, lang)}`
          : formatMessage(t.radarLinesPerFileUnit, {
              lines: formatNumber(simplicityB.avgLinesPerFile, lang),
            }),
      },
      {
        axis: t.radarAxisDensity,
        scoreA: densityA,
        scoreB: densityB,
        rawA: `${densityA}%`,
        rawB: `${densityB}%`,
      },
    ];
  }, [repoA, repoB, healthA, healthB, t, lang]);

  const rawRadarData = useMemo<HealthRadarPoint[]>(() => {
    const primaryA = repoA.languages[0];
    const primaryB = repoB.languages[0];
    const primaryLinesA = primaryA?.lines ?? 0;
    const primaryLinesB = primaryB?.lines ?? 0;

    return [
      {
        axis: t.kpiTotalLines,
        scoreA: repoA.summary.totalLines,
        scoreB: repoB.summary.totalLines,
        rawA: formatNumber(repoA.summary.totalLines, lang),
        rawB: formatNumber(repoB.summary.totalLines, lang),
      },
      {
        axis: t.colCodeLines,
        scoreA: repoA.summary.codeLines,
        scoreB: repoB.summary.codeLines,
        rawA: formatNumber(repoA.summary.codeLines, lang),
        rawB: formatNumber(repoB.summary.codeLines, lang),
      },
      {
        axis: t.radarAxisPrimaryLangLines,
        scoreA: primaryLinesA,
        scoreB: primaryLinesB,
        rawA: primaryA
          ? `${primaryA.name} (${formatNumber(primaryLinesA, lang)})`
          : formatNumber(0, lang),
        rawB: primaryB
          ? `${primaryB.name} (${formatNumber(primaryLinesB, lang)})`
          : formatNumber(0, lang),
      },
      {
        axis: t.radarAxisCommentLines,
        scoreA: healthA.commentLines,
        scoreB: healthB.commentLines,
        rawA: formatNumber(healthA.commentLines, lang),
        rawB: formatNumber(healthB.commentLines, lang),
      },
      {
        axis: t.radarAxisBlankLines,
        scoreA: repoA.summary.blankLines,
        scoreB: repoB.summary.blankLines,
        rawA: formatNumber(repoA.summary.blankLines, lang),
        rawB: formatNumber(repoB.summary.blankLines, lang),
      },
    ];
  }, [repoA, repoB, healthA, healthB, t, lang]);

  const activeRadarData =
    radarMode === 'percentage' ? percentageRadarData : rawRadarData;

  const radarMaxDomain = useMemo(() => {
    if (radarMode === 'percentage') return 100;
    let max = 10;
    for (const point of rawRadarData) {
      if (point.scoreA > max) max = point.scoreA;
      if (point.scoreB > max) max = point.scoreB;
    }
    return max;
  }, [radarMode, rawRadarData]);

  const [heatmapFocus, setHeatmapFocus] = useState<HeatmapFocus>('all');
  const [fileTypeMetric, setFileTypeMetric] =
    useState<FileTypeMetric>('percentage');

  const fileTypeSummary = useMemo(() => {
    const catsA = summarizeFileCategories(repoA.files);
    const catsB = summarizeFileCategories(repoB.files);

    const categories: Array<{
      key: FileCategoryKey;
      label: string;
      color: string;
    }> = [
      { key: 'source', label: t.fileCategorySource, color: FILE_CATEGORY_COLORS.source },
      { key: 'tests', label: t.fileCategoryTests, color: FILE_CATEGORY_COLORS.tests },
      { key: 'docs', label: t.fileCategoryDocs, color: FILE_CATEGORY_COLORS.docs },
      { key: 'config', label: t.fileCategoryConfig, color: FILE_CATEGORY_COLORS.config },
      { key: 'other', label: t.fileCategoryOther, color: FILE_CATEGORY_COLORS.other },
    ];

    const sumMetric = (
      cats: Record<FileCategoryKey, FileCategoryBucket>,
      metric: 'codeLines' | 'files'
    ) =>
      categories.reduce((acc, c) => acc + cats[c.key][metric], 0);

    const totalCodeA = Math.max(1, sumMetric(catsA, 'codeLines'));
    const totalCodeB = Math.max(1, sumMetric(catsB, 'codeLines'));
    const totalFilesA = Math.max(1, sumMetric(catsA, 'files'));
    const totalFilesB = Math.max(1, sumMetric(catsB, 'files'));

    const buildRepoRow = (
      repoName: string,
      cats: Record<FileCategoryKey, FileCategoryBucket>,
      totalCode: number,
      totalFiles: number
    ) => {
      const row: Record<string, string | number> = { repoName };
      for (const cat of categories) {
        if (fileTypeMetric === 'files') {
          row[cat.key] = cats[cat.key].files;
        } else if (fileTypeMetric === 'codeLines') {
          row[cat.key] = cats[cat.key].codeLines;
        } else {
          const pct = (cats[cat.key].codeLines / totalCode) * 100;
          row[cat.key] = Number(pct.toFixed(2));
        }
        row[`${cat.key}_files`] = cats[cat.key].files;
        row[`${cat.key}_codeLines`] = cats[cat.key].codeLines;
        row[`${cat.key}_pct`] = Number(
          ((cats[cat.key].codeLines / totalCode) * 100).toFixed(1)
        );
        row[`${cat.key}_filesPct`] = Number(
          ((cats[cat.key].files / totalFiles) * 100).toFixed(1)
        );
      }
      return row;
    };

    const chartRows = [
      buildRepoRow(repoA.repository.fullName, catsA, totalCodeA, totalFilesA),
      buildRepoRow(repoB.repository.fullName, catsB, totalCodeB, totalFilesB),
    ];

    const tableRows = categories.map((cat) => {
      const a = catsA[cat.key];
      const b = catsB[cat.key];
      const pctA = Number(((a.codeLines / totalCodeA) * 100).toFixed(1));
      const pctB = Number(((b.codeLines / totalCodeB) * 100).toFixed(1));
      const filesPctA = Number(((a.files / totalFilesA) * 100).toFixed(1));
      const filesPctB = Number(((b.files / totalFilesB) * 100).toFixed(1));
      return {
        ...cat,
        aFiles: a.files,
        aCodeLines: a.codeLines,
        aPct: pctA,
        aFilesPct: filesPctA,
        bFiles: b.files,
        bCodeLines: b.codeLines,
        bPct: pctB,
        bFilesPct: filesPctB,
        diffPct: Number((pctA - pctB).toFixed(1)),
      };
    });

    return { categories, chartRows, tableRows };
  }, [
    repoA.files,
    repoA.repository.fullName,
    repoB.files,
    repoB.repository.fullName,
    fileTypeMetric,
    t,
  ]);

  const heatmapRows = useMemo<HeatmapRow[]>(() => {
    let maxBytes = 1;
    let maxLines = 1;
    for (const f of repoA.files) {
      if (f.sizeBytes > maxBytes) maxBytes = f.sizeBytes;
      if (f.lines > maxLines) maxLines = f.lines;
    }
    for (const f of repoB.files) {
      if (f.sizeBytes > maxBytes) maxBytes = f.sizeBytes;
      if (f.lines > maxLines) maxLines = f.lines;
    }

    const scoreFile = (f: AnalyzedFile): number => {
      if (heatmapFocus === 'size') return f.sizeBytes;
      if (heatmapFocus === 'complexity') return f.lines;
      return f.sizeBytes / maxBytes + f.lines / maxLines;
    };

    const topA = [...repoA.files]
      .sort((a, b) => scoreFile(b) - scoreFile(a))
      .slice(0, 12);
    const topB = [...repoB.files]
      .sort((a, b) => scoreFile(b) - scoreFile(a))
      .slice(0, 12);

    const count = Math.max(topA.length, topB.length);
    const rows: HeatmapRow[] = [];

    for (let i = 0; i < count; i++) {
      const fileA = topA[i] ?? null;
      const fileB = topB[i] ?? null;

      const calcIntensity = (f: AnalyzedFile): number => {
        const sizeInt = f.sizeBytes / maxBytes;
        const linesInt = f.lines / maxLines;
        if (heatmapFocus === 'size') return sizeInt;
        if (heatmapFocus === 'complexity') return linesInt;
        return (sizeInt + linesInt) / 2;
      };

      const sizeRatioA =
        fileA && fileB && fileB.sizeBytes > 0
          ? fileA.sizeBytes / fileB.sizeBytes
          : 1;
      const sizeRatioB =
        fileB && fileA && fileA.sizeBytes > 0
          ? fileB.sizeBytes / fileA.sizeBytes
          : 1;
      const linesRatioA =
        fileA && fileB && fileB.lines > 0 ? fileA.lines / fileB.lines : 1;
      const linesRatioB =
        fileB && fileA && fileA.lines > 0 ? fileB.lines / fileA.lines : 1;

      const cellA: HeatmapCellInfo | null = fileA
        ? {
            file: fileA,
            intensity: calcIntensity(fileA),
            isSizeHotspot: heatmapFocus !== 'complexity' && sizeRatioA >= 1.5,
            isComplexHotspot: heatmapFocus !== 'size' && linesRatioA >= 1.5,
            sizeRatio: sizeRatioA,
            linesRatio: linesRatioA,
          }
        : null;

      const cellB: HeatmapCellInfo | null = fileB
        ? {
            file: fileB,
            intensity: calcIntensity(fileB),
            isSizeHotspot: heatmapFocus !== 'complexity' && sizeRatioB >= 1.5,
            isComplexHotspot: heatmapFocus !== 'size' && linesRatioB >= 1.5,
            sizeRatio: sizeRatioB,
            linesRatio: linesRatioB,
          }
        : null;

      rows.push({ rank: i + 1, cellA, cellB });
    }

    return rows;
  }, [repoA.files, repoB.files, heatmapFocus]);

  const safeHrefA = repoA.repository.htmlUrl.startsWith('https://github.com/')
    ? repoA.repository.htmlUrl
    : '#';
  const safeHrefB = repoB.repository.htmlUrl.startsWith('https://github.com/')
    ? repoB.repository.htmlUrl
    : '#';

  const summaryRows = [
    {
      label: t.healthGaugeLabel,
      valA: `${formatNumber(healthA.score, lang)} / 100`,
      valB: `${formatNumber(healthB.score, lang)} / 100`,
      diff: formatSignedDiff(healthA.score - healthB.score, lang),
      diffRaw: healthA.score - healthB.score,
    },
    {
      label: t.kpiTotalLines,
      valA: formatNumber(repoA.summary.totalLines, lang),
      valB: formatNumber(repoB.summary.totalLines, lang),
      diff: formatSignedDiff(
        repoA.summary.totalLines - repoB.summary.totalLines,
        lang
      ),
      diffRaw: repoA.summary.totalLines - repoB.summary.totalLines,
    },
    {
      label: t.colCodeLines,
      valA: formatNumber(repoA.summary.codeLines, lang),
      valB: formatNumber(repoB.summary.codeLines, lang),
      diff: formatSignedDiff(
        repoA.summary.codeLines - repoB.summary.codeLines,
        lang
      ),
      diffRaw: repoA.summary.codeLines - repoB.summary.codeLines,
    },
    {
      label: t.kpiLanguages,
      valA: formatNumber(repoA.summary.languageCount, lang),
      valB: formatNumber(repoB.summary.languageCount, lang),
      diff: formatSignedDiff(
        repoA.summary.languageCount - repoB.summary.languageCount,
        lang
      ),
      diffRaw: repoA.summary.languageCount - repoB.summary.languageCount,
    },
    {
      label: t.kpiAnalyzedFiles,
      valA: formatNumber(repoA.summary.analyzedFiles, lang),
      valB: formatNumber(repoB.summary.analyzedFiles, lang),
      diff: formatSignedDiff(
        repoA.summary.analyzedFiles - repoB.summary.analyzedFiles,
        lang
      ),
      diffRaw: repoA.summary.analyzedFiles - repoB.summary.analyzedFiles,
    },
    {
      label: t.kpiTotalSize,
      valA: formatBytes(repoA.summary.totalSizeBytes),
      valB: formatBytes(repoB.summary.totalSizeBytes),
      diff: `${
        repoA.summary.totalSizeBytes >= repoB.summary.totalSizeBytes ? '+' : '-'
      }${formatBytes(
        Math.abs(repoA.summary.totalSizeBytes - repoB.summary.totalSizeBytes)
      )}`,
      diffRaw: repoA.summary.totalSizeBytes - repoB.summary.totalSizeBytes,
    },
    {
      label: t.openPrsLabel,
      valA:
        typeof repoA.repository.openPullRequests === 'number'
          ? formatNumber(repoA.repository.openPullRequests, lang)
          : t.unavailableLabel,
      valB:
        typeof repoB.repository.openPullRequests === 'number'
          ? formatNumber(repoB.repository.openPullRequests, lang)
          : t.unavailableLabel,
      diff:
        typeof repoA.repository.openPullRequests === 'number' &&
        typeof repoB.repository.openPullRequests === 'number'
          ? formatSignedDiff(
              repoA.repository.openPullRequests -
                repoB.repository.openPullRequests,
              lang
            )
          : '-',
      diffRaw:
        typeof repoA.repository.openPullRequests === 'number' &&
        typeof repoB.repository.openPullRequests === 'number'
          ? repoA.repository.openPullRequests - repoB.repository.openPullRequests
          : 0,
    },
    {
      label: t.lastUpdatedLabel,
      valA:
        formatRelativeDate(
          repoA.repository.pushedAt ?? repoA.repository.updatedAt,
          lang
        )?.relative ?? t.unavailableLabel,
      valB:
        formatRelativeDate(
          repoB.repository.pushedAt ?? repoB.repository.updatedAt,
          lang
        )?.relative ?? t.unavailableLabel,
      diff: '-',
      diffRaw: 0,
    },
  ];

  return (
    <section id="comparison" className="border-t border-slate-800/80 pt-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            {t.comparisonSectionTitle}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {t.comparisonSectionSubtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={onClearComparison}
          className="inline-flex min-h-[38px] items-center gap-1.5 self-start sm:self-auto rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <X className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <span>{t.removeSecondRepo}</span>
        </button>
      </div>

      {/* Side-by-Side Identity Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[
          {
            label: t.repoALabel,
            dotColor: '#38BDF8',
            data: repoA,
            href: safeHrefA,
          },
          {
            label: t.repoBLabel,
            dotColor: '#10B981',
            data: repoB,
            href: safeHrefB,
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-800/80 bg-[#111827] p-5"
          >
            <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
              <span className="inline-flex items-center gap-2 font-medium text-slate-200">
                <span
                  className="h-2.5 w-2.5 rounded-xs shrink-0"
                  style={{ backgroundColor: card.dotColor }}
                />
                <span>{card.label}</span>
              </span>
              <span className="inline-flex items-center gap-2 tabular-nums">
                <GitBranch className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                <span dir="ltr" className="font-mono">
                  {card.data.repository.defaultBranch}
                </span>
                <span aria-hidden="true">·</span>
                <Star className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                <span>{formatNumber(card.data.repository.stars, lang)}</span>
              </span>
            </div>

            <a
              href={card.href}
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
              className="mt-2 inline-flex items-center gap-1.5 font-mono text-base font-bold text-slate-50 hover:text-sky-400 transition-colors"
            >
              <span className="truncate">{card.data.repository.fullName}</span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            </a>

            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-slate-800/80 pt-3.5">
              <div>
                <div className="text-[11px] text-slate-400">{t.kpiTotalLines}</div>
                <div className="mt-0.5 font-mono text-base font-bold text-slate-100 tabular-nums">
                  {formatNumber(card.data.summary.totalLines, lang)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">{t.kpiLanguages}</div>
                <div className="mt-0.5 font-mono text-base font-bold text-slate-100 tabular-nums">
                  {formatNumber(card.data.summary.languageCount, lang)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">{t.colFiles}</div>
                <div className="mt-0.5 font-mono text-base font-bold text-slate-100 tabular-nums">
                  {formatNumber(card.data.summary.analyzedFiles, lang)}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Metrics Comparison Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-[#111827]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs font-medium text-slate-400">
              <th className="py-3 px-4 text-start font-medium">
                {t.comparisonMetricCol}
              </th>
              <th className="py-3 px-4 text-end font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-xs bg-sky-400 shrink-0" />
                  <span dir="ltr" className="font-mono text-slate-200">
                    {repoA.repository.name}
                  </span>
                </span>
              </th>
              <th className="py-3 px-4 text-end font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-xs bg-emerald-500 shrink-0" />
                  <span dir="ltr" className="font-mono text-slate-200">
                    {repoB.repository.name}
                  </span>
                </span>
              </th>
              <th className="py-3 px-4 text-end font-medium">
                {t.comparisonDiffCol}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {summaryRows.map((row) => (
              <tr key={row.label} className="hover:bg-slate-800/35">
                <td className="h-10 px-4 text-xs font-medium text-slate-300">
                  {row.label}
                </td>
                <td className="h-10 px-4 text-end font-mono text-xs font-semibold text-slate-100 tabular-nums">
                  {row.valA}
                </td>
                <td className="h-10 px-4 text-end font-mono text-xs font-semibold text-slate-100 tabular-nums">
                  {row.valB}
                </td>
                <td
                  dir="ltr"
                  className={`h-10 px-4 text-end font-mono text-xs tabular-nums ${
                    row.diffRaw > 0
                      ? 'text-sky-400'
                      : row.diffRaw < 0
                        ? 'text-emerald-400'
                        : 'text-slate-400'
                  }`}
                >
                  {row.diff}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* File Type Distribution Summary (Stacked Bar Chart) */}
      {(repoA.files.length > 0 || repoB.files.length > 0) && (
        <div className="rounded-xl border border-slate-800/80 bg-[#111827] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                {t.fileTypeSummaryTitle}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {t.fileTypeSummarySubtitle}
              </p>
            </div>

            <div
              role="group"
              aria-label={t.fileTypeSummaryTitle}
              className="inline-flex self-start sm:self-auto items-center rounded-lg border border-slate-800 bg-[#0B0F17] p-1 shrink-0"
            >
              {(
                [
                  { id: 'percentage', label: t.fileTypeMetricShare },
                  { id: 'codeLines', label: t.fileTypeMetricLines },
                  { id: 'files', label: t.fileTypeMetricFiles },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFileTypeMetric(tab.id)}
                  aria-pressed={fileTypeMetric === tab.id}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    fileTypeMetric === tab.id
                      ? 'bg-sky-500/20 text-sky-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div dir="ltr" className="mt-4 h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={fileTypeSummary.chartRows}
                layout="vertical"
                margin={{ top: 8, right: 18, left: 8, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1E293B"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  domain={fileTypeMetric === 'percentage' ? [0, 100] : [0, 'auto']}
                  allowDataOverflow={fileTypeMetric === 'percentage'}
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={false}
                  tickFormatter={(val: number) =>
                    fileTypeMetric === 'percentage'
                      ? `${Math.round(val)}%`
                      : formatCompactAxis(val)
                  }
                />
                <YAxis
                  type="category"
                  dataKey="repoName"
                  width={136}
                  tick={{ fill: '#E2E8F0', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val: string) =>
                    val.length > 18 ? `${val.slice(0, 17)}…` : val
                  }
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const row = payload[0].payload as Record<string, string | number>;
                    return (
                      <div
                        dir={lang === 'ar' ? 'rtl' : 'ltr'}
                        className="rounded-lg border border-slate-700 bg-[#0B0F17] px-3.5 py-2.5 text-xs shadow-lg"
                      >
                        <div className="mb-2 font-mono font-semibold text-slate-100">
                          {String(row.repoName)}
                        </div>
                        <div className="space-y-1.5 tabular-nums">
                          {fileTypeSummary.categories.map((cat) => {
                            const codeVal = Number(row[`${cat.key}_codeLines`] ?? 0);
                            const filesVal = Number(row[`${cat.key}_files`] ?? 0);
                            const pctVal = Number(
                              (fileTypeMetric === 'files'
                                ? row[`${cat.key}_filesPct`]
                                : row[`${cat.key}_pct`]) ?? 0
                            );
                            return (
                              <div
                                key={cat.key}
                                className="flex items-center justify-between gap-4"
                              >
                                <span className="flex items-center gap-2 text-slate-300">
                                  <span
                                    className="h-2.5 w-2.5 rounded-xs shrink-0"
                                    style={{ backgroundColor: cat.color }}
                                  />
                                  <span>{cat.label}</span>
                                </span>
                                <span className="font-mono text-slate-100">
                                  {pctVal.toFixed(1)}% · {formatNumber(codeVal, lang)} {t.colCodeLines} · {formatNumber(filesVal, lang)} {t.colFiles}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }} />
                {fileTypeSummary.categories.map((cat) => (
                  <Bar
                    key={cat.key}
                    dataKey={cat.key}
                    name={cat.label}
                    stackId="fileTypes"
                    fill={cat.color}
                    stroke="#111827"
                    strokeWidth={1}
                    maxBarSize={42}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category Breakdown Summary Table (single-elevation divider layout) */}
          <div className="mt-4 overflow-x-auto border-t border-slate-800/80 pt-3">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800/80 text-slate-400">
                  <th className="py-2 pe-3 text-start font-medium">
                    {t.fileCategoryCol}
                  </th>
                  <th className="py-2 px-3 text-end font-medium">
                    <span dir="ltr" className="font-mono text-sky-400">
                      {repoA.repository.name}
                    </span>
                  </th>
                  <th className="py-2 px-3 text-end font-medium">
                    <span dir="ltr" className="font-mono text-emerald-400">
                      {repoB.repository.name}
                    </span>
                  </th>
                  <th className="py-2 ps-3 text-end font-medium">
                    {t.comparisonDiffCol}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {fileTypeSummary.tableRows.map((row) => {
                  const displayA =
                    fileTypeMetric === 'files'
                      ? `${formatNumber(row.aFiles, lang)} (${row.aFilesPct.toFixed(1)}%)`
                      : `${formatNumber(row.aCodeLines, lang)} (${row.aPct.toFixed(1)}%)`;
                  const displayB =
                    fileTypeMetric === 'files'
                      ? `${formatNumber(row.bFiles, lang)} (${row.bFilesPct.toFixed(1)}%)`
                      : `${formatNumber(row.bCodeLines, lang)} (${row.bPct.toFixed(1)}%)`;
                  const diffValue =
                    fileTypeMetric === 'files'
                      ? row.aFiles - row.bFiles
                      : Number((row.aPct - row.bPct).toFixed(1));
                  const diffLabel =
                    fileTypeMetric === 'files'
                      ? formatSignedDiff(diffValue, lang)
                      : diffValue === 0
                        ? '0.0%'
                        : `${diffValue > 0 ? '+' : ''}${diffValue.toFixed(1)}%`;

                  return (
                    <tr key={row.key} className="hover:bg-slate-800/30">
                      <td className="h-9 pe-3">
                        <span className="inline-flex items-center gap-2 font-medium text-slate-200 whitespace-nowrap">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-xs"
                            style={{ backgroundColor: row.color }}
                          />
                          <span>{row.label}</span>
                        </span>
                      </td>
                      <td className="h-9 px-3 text-end font-mono text-slate-200 tabular-nums whitespace-nowrap">
                        {displayA}
                      </td>
                      <td className="h-9 px-3 text-end font-mono text-slate-200 tabular-nums whitespace-nowrap">
                        {displayB}
                      </td>
                      <td
                        dir="ltr"
                        className={`h-9 ps-3 text-end font-mono tabular-nums whitespace-nowrap ${
                          diffValue > 0
                            ? 'text-sky-400'
                            : diffValue < 0
                              ? 'text-emerald-400'
                              : 'text-slate-500'
                        }`}
                      >
                        {diffLabel}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recharts Grouped Comparison Bar Chart */}
      {topChartLanguages.length > 0 && (
        <div className="rounded-xl border border-slate-800/80 bg-[#111827] p-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              {t.languageComparisonTitle}
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {t.languageComparisonSubtitle}
            </p>
          </div>

          <div dir="ltr" className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={topChartLanguages}
                margin={{ top: 12, right: 12, left: 4, bottom: 16 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#1E293B"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={false}
                  interval={0}
                  angle={topChartLanguages.length > 6 ? -22 : 0}
                  textAnchor={topChartLanguages.length > 6 ? 'end' : 'middle'}
                  height={topChartLanguages.length > 6 ? 52 : 30}
                  tickFormatter={(val: string) =>
                    val.length > 12 ? `${val.slice(0, 11)}…` : val
                  }
                />
                <YAxis
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={formatCompactAxis}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const row = payload[0].payload as MergedLanguageRow;
                    return (
                      <div
                        dir={lang === 'ar' ? 'rtl' : 'ltr'}
                        className="rounded-lg border border-slate-700 bg-[#0B0F17] px-3.5 py-2.5 text-xs shadow-lg"
                      >
                        <div className="flex items-center gap-2 font-semibold text-slate-100">
                          <span
                            className="h-2.5 w-2.5 rounded-xs shrink-0"
                            style={{ backgroundColor: row.color }}
                          />
                          <span>{row.name}</span>
                        </div>
                        <div className="mt-2 space-y-1 tabular-nums">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sky-400 font-mono">
                              {repoA.repository.name}:
                            </span>
                            <span className="font-mono font-semibold text-slate-100">
                              {formatNumber(row.aCodeLines, lang)} ({row.aPct.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-emerald-400 font-mono">
                              {repoB.repository.name}:
                            </span>
                            <span className="font-mono font-semibold text-slate-100">
                              {formatNumber(row.bCodeLines, lang)} ({row.bPct.toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }}
                />
                <Bar
                  dataKey="aCodeLines"
                  name={repoA.repository.fullName}
                  fill="#38BDF8"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="bCodeLines"
                  name={repoB.repository.fullName}
                  fill="#10B981"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Comparative Code Health Radar Chart */}
      <div className="rounded-xl border border-slate-800/80 bg-[#111827] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">
              {t.healthRadarTitle}
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {t.healthRadarSubtitle}
            </p>
          </div>

          {/* Toggle between Percentage-Based Distribution and Raw Line Counts */}
          <div
            role="group"
            aria-label={t.healthRadarTitle}
            className="inline-flex self-start sm:self-auto items-center rounded-lg border border-slate-800 bg-[#0B0F17] p-1 shrink-0"
          >
            <button
              type="button"
              onClick={() => setRadarMode('percentage')}
              aria-pressed={radarMode === 'percentage'}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                radarMode === 'percentage'
                  ? 'bg-sky-500/20 text-sky-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.radarModePercentage}
            </button>
            <button
              type="button"
              onClick={() => setRadarMode('raw')}
              aria-pressed={radarMode === 'raw'}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                radarMode === 'raw'
                  ? 'bg-sky-500/20 text-sky-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {t.radarModeRawLines}
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-center">
          <div dir="ltr" className="h-80 w-full lg:col-span-7">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                cx="50%"
                cy="50%"
                outerRadius="72%"
                data={activeRadarData}
              >
                <PolarGrid stroke="#1E293B" />
                <PolarAngleAxis
                  dataKey="axis"
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, radarMaxDomain]}
                  tickCount={5}
                  tick={{ fill: '#64748B', fontSize: 10 }}
                  axisLine={false}
                  tickFormatter={(val: number) =>
                    radarMode === 'percentage'
                      ? `${Math.round(val)}%`
                      : formatCompactAxis(Math.round(val))
                  }
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const point = payload[0].payload as HealthRadarPoint;
                    return (
                      <div
                        dir={lang === 'ar' ? 'rtl' : 'ltr'}
                        className="rounded-lg border border-slate-700 bg-[#0B0F17] px-3.5 py-2.5 text-xs shadow-lg"
                      >
                        <div className="font-semibold text-slate-100">
                          {point.axis}
                        </div>
                        <div className="mt-2 space-y-1 tabular-nums">
                          <div className="flex items-center justify-between gap-4">
                            <span className="font-mono text-sky-400">
                              {repoA.repository.name}:
                            </span>
                            <span className="font-mono font-semibold text-slate-100">
                              {radarMode === 'percentage'
                                ? `${formatNumber(point.scoreA, lang)}% (${point.rawA})`
                                : point.rawA}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="font-mono text-emerald-400">
                              {repoB.repository.name}:
                            </span>
                            <span className="font-mono font-semibold text-slate-100">
                              {radarMode === 'percentage'
                                ? `${formatNumber(point.scoreB, lang)}% (${point.rawB})`
                                : point.rawB}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '4px' }} />
                <Radar
                  name={repoA.repository.fullName}
                  dataKey="scoreA"
                  stroke="#38BDF8"
                  strokeWidth={2}
                  fill="#38BDF8"
                  fillOpacity={0.28}
                />
                <Radar
                  name={repoB.repository.fullName}
                  dataKey="scoreB"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="#10B981"
                  fillOpacity={0.24}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Side-by-side Axis Breakdown (no nested cards) */}
          <div className="divide-y divide-slate-800/80 border-t border-slate-800/80 pt-3 lg:col-span-5 lg:border-t-0 lg:border-s lg:ps-6 lg:pt-0">
            {activeRadarData.map((point) => {
              const barPctA = Math.min(
                100,
                Math.max(0, (point.scoreA / radarMaxDomain) * 100)
              );
              const barPctB = Math.min(
                100,
                Math.max(0, (point.scoreB / radarMaxDomain) * 100)
              );
              return (
                <div key={point.axis} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-slate-200">{point.axis}</span>
                    {radarMode === 'percentage' && (
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                        <span className="text-sky-400">{point.rawA}</span>
                        {' · '}
                        <span className="text-emerald-400">{point.rawB}</span>
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 grid grid-cols-2 gap-3 text-[11px] font-mono tabular-nums">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-sky-400"
                          style={{ width: `${barPctA}%` }}
                        />
                      </div>
                      <span
                        className={`${
                          radarMode === 'percentage' ? 'w-10' : 'w-16'
                        } text-end text-slate-200`}
                      >
                        {radarMode === 'percentage'
                          ? `${formatNumber(point.scoreA, lang)}%`
                          : formatCompactAxis(point.scoreA)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${barPctB}%` }}
                        />
                      </div>
                      <span
                        className={`${
                          radarMode === 'percentage' ? 'w-10' : 'w-16'
                        } text-end text-slate-200`}
                      >
                        {radarMode === 'percentage'
                          ? `${formatNumber(point.scoreB, lang)}%`
                          : formatCompactAxis(point.scoreB)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* File Size & Complexity Heatmap */}
      {heatmapRows.length > 0 && (
        <div className="rounded-xl border border-slate-800/80 bg-[#111827] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                {t.heatmapSectionTitle}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {t.heatmapSectionSubtitle}
              </p>
            </div>

            <div
              role="group"
              aria-label={t.heatmapSectionTitle}
              className="inline-flex self-start sm:self-auto items-center rounded-lg border border-slate-800 bg-[#0B0F17] p-1 shrink-0"
            >
              {(
                [
                  { id: 'all', label: t.heatmapModeAll },
                  { id: 'size', label: t.heatmapModeSize },
                  { id: 'complexity', label: t.heatmapModeComplexity },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setHeatmapFocus(tab.id)}
                  aria-pressed={heatmapFocus === tab.id}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    heatmapFocus === tab.id
                      ? 'bg-sky-500/20 text-sky-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Thermal Scale Legend */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-slate-800/80 py-2.5 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-4 rounded-xs bg-slate-800/80 border border-slate-700" />
              <span>{t.heatmapLegendLow}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-4 rounded-xs bg-sky-500/25 border border-sky-400/30" />
              <span>{t.heatmapLegendModerate}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-4 rounded-xs bg-indigo-500/35 border border-indigo-400/40" />
              <span>{t.heatmapLegendHigh}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium text-amber-300">
              <span className="h-3 w-4 rounded-xs bg-amber-500/25 ring-1 ring-amber-400/70" />
              <span>{t.heatmapLegendHotspot}</span>
            </span>
          </div>

          {/* Heatmap Grid Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-y-1.5 text-xs">
              <thead>
                <tr className="text-slate-400">
                  <th className="w-10 px-2 pb-1 text-center font-medium">
                    {t.heatmapRankCol}
                  </th>
                  <th className="w-1/2 px-2 pb-1 text-start font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-xs bg-sky-400 shrink-0" />
                      <span dir="ltr" className="font-mono text-slate-200">
                        {repoA.repository.fullName}
                      </span>
                    </span>
                  </th>
                  <th className="w-1/2 px-2 pb-1 text-start font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-xs bg-emerald-500 shrink-0" />
                      <span dir="ltr" className="font-mono text-slate-200">
                        {repoB.repository.fullName}
                      </span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {heatmapRows.map((row) => (
                  <tr key={row.rank}>
                    <td className="px-2 py-2 text-center font-mono text-slate-500 tabular-nums align-middle">
                      #{formatNumber(row.rank, lang)}
                    </td>
                    {[row.cellA, row.cellB].map((cell, idx) => {
                      const cellKey = idx === 0 ? `A-${row.rank}` : `B-${row.rank}`;
                      if (!cell) {
                        return (
                          <td key={cellKey} className="px-1.5 align-top">
                            <div className="flex h-full min-h-[54px] items-center justify-center rounded-lg bg-[#0B0F17]/60 px-3 py-2 text-slate-600">
                              —
                            </div>
                          </td>
                        );
                      }

                      const isHotspot =
                        cell.isSizeHotspot || cell.isComplexHotspot;
                      const heatCls = getHeatmapCellStyle(
                        cell.intensity,
                        isHotspot
                      );

                      return (
                        <td key={cellKey} className="px-1.5 align-top">
                          <div
                            className={`rounded-lg px-3 py-2.5 transition-colors ${heatCls}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="h-2 w-2 shrink-0 rounded-xs"
                                  style={{ backgroundColor: cell.file.color }}
                                />
                                <span
                                  dir="ltr"
                                  title={cell.file.path}
                                  className="truncate font-mono text-xs font-medium text-slate-100"
                                >
                                  {cell.file.path}
                                </span>
                              </div>
                            </div>

                            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] tabular-nums">
                              <span className="text-slate-300">
                                {formatBytes(cell.file.sizeBytes)} ·{' '}
                                {formatNumber(cell.file.lines, lang)}{' '}
                                {t.colLines}
                              </span>

                              {isHotspot && (
                                <span className="inline-flex flex-wrap items-center gap-2 font-semibold text-amber-300">
                                  {cell.isSizeHotspot && (
                                    <span dir="ltr">
                                      {formatMessage(t.heatmapLargerTag, {
                                        ratio: cell.sizeRatio.toFixed(1),
                                      })}
                                    </span>
                                  )}
                                  {cell.isComplexHotspot && (
                                    <span dir="ltr">
                                      {formatMessage(t.heatmapComplexTag, {
                                        ratio: cell.linesRatio.toFixed(1),
                                      })}
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Side-by-Side Language Breakdown Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-[#111827]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs font-medium text-slate-400">
              <th className="py-2.5 px-4 text-start font-medium">
                {t.colLanguage}
              </th>
              <th className="py-2.5 px-3 text-end font-medium">
                <span dir="ltr" className="font-mono text-sky-400">
                  {repoA.repository.name}
                </span>
              </th>
              <th className="hidden sm:table-cell py-2.5 px-3 text-end font-medium">
                {t.colShare}
              </th>
              <th className="py-2.5 px-3 text-end font-medium">
                <span dir="ltr" className="font-mono text-emerald-400">
                  {repoB.repository.name}
                </span>
              </th>
              <th className="hidden sm:table-cell py-2.5 px-3 text-end font-medium">
                {t.colShare}
              </th>
              <th className="py-2.5 px-4 text-end font-medium">
                {t.comparisonDiffCol}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {mergedLanguages.map((row) => (
              <tr key={row.name} className="hover:bg-slate-800/35">
                <td className="h-10 px-4">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-xs"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="font-medium text-slate-200 whitespace-nowrap">
                      {row.name}
                    </span>
                  </div>
                </td>
                <td className="h-10 px-3 text-end font-mono text-xs text-slate-100 tabular-nums">
                  {formatNumber(row.aLines, lang)}
                </td>
                <td className="hidden sm:table-cell h-10 px-3 text-end font-mono text-xs text-slate-400 tabular-nums">
                  {row.aPct.toFixed(1)}%
                </td>
                <td className="h-10 px-3 text-end font-mono text-xs text-slate-100 tabular-nums">
                  {formatNumber(row.bLines, lang)}
                </td>
                <td className="hidden sm:table-cell h-10 px-3 text-end font-mono text-xs text-slate-400 tabular-nums">
                  {row.bPct.toFixed(1)}%
                </td>
                <td
                  dir="ltr"
                  className={`h-10 px-4 text-end font-mono text-xs tabular-nums ${
                    row.diffLines > 0
                      ? 'text-sky-400'
                      : row.diffLines < 0
                        ? 'text-emerald-400'
                        : 'text-slate-500'
                  }`}
                >
                  {formatSignedDiff(row.diffLines, lang)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
