import {
  ArrowUp,
  ChevronRight,
  ExternalLink,
  Folder,
  FileCode2,
} from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, Tooltip, Treemap } from 'recharts';
import { formatMessage, formatNumber, type Translations } from '../lib/i18n.ts';
import { formatBytes } from '../lib/languageMap.ts';
import type { AnalyzedFile, AppLanguage } from '../lib/types.ts';

interface CodeHotspotTreemapProps {
  t: Translations;
  lang: AppLanguage;
  repoName: string;
  files: AnalyzedFile[];
  onInspectInExplorer?: (filePath: string) => void;
}

interface TreeNode {
  name: string;
  path: string;
  isFolder: boolean;
  lines: number;
  codeLines: number;
  sizeBytes: number;
  fileCount: number;
  complexitySum: number;
  logicFileCount: number;
  maxComplexity: number;
  maxNesting: number;
  functionCount: number;
  language?: string;
  fileColor?: string;
  childrenMap: Map<string, TreeNode>;
}

interface FlatTreemapItem {
  name: string;
  path: string;
  isFolder: boolean;
  isAggregated?: boolean;
  sizeValue: number;
  lines: number;
  codeLines: number;
  sizeBytes: number;
  fileCount: number;
  avgComplexity: number;
  maxComplexity: number;
  maxNesting: number;
  functionCount: number;
  hasLogic: boolean;
  language?: string;
  fillColor: string;
  [key: string]: unknown;
}

const NON_LOGIC_LANGUAGES = new Set([
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

function formatCompactCount(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}k`;
  return String(val);
}

function resolveHotspotFill(
  hasLogic: boolean,
  avgComplexity: number,
  maxComplexity: number
): string {
  if (!hasLogic) return '#334155';
  if (avgComplexity >= 35 || maxComplexity >= 50) return '#B91C1C';
  if (avgComplexity >= 20 || maxComplexity >= 30) return '#B45309';
  if (avgComplexity >= 10 || maxComplexity >= 18) return '#0369A1';
  return '#0F766E';
}

function estimateFileComplexity(file: AnalyzedFile): {
  hasLogic: boolean;
  complexity: number;
  maxNesting: number;
  functionCount: number;
} {
  if (typeof file.complexity === 'number') {
    return {
      hasLogic: true,
      complexity: file.complexity,
      maxNesting: file.maxNesting ?? 0,
      functionCount: file.functionCount ?? 1,
    };
  }
  if (NON_LOGIC_LANGUAGES.has(file.language)) {
    return { hasLogic: false, complexity: 0, maxNesting: 0, functionCount: 0 };
  }
  return {
    hasLogic: true,
    complexity: Math.max(1, Math.round(1 + file.codeLines / 14)),
    maxNesting: Math.min(
      10,
      Math.max(1, Math.round(Math.log2(Math.max(2, file.codeLines / 12))))
    ),
    functionCount: Math.max(1, Math.round(file.codeLines / 28)),
  };
}

interface CustomCellProps {
  depth?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  path?: string;
  isFolder?: boolean;
  isAggregated?: boolean;
  sizeValue?: number;
  avgComplexity?: number;
  maxComplexity?: number;
  hasLogic?: boolean;
  fillColor?: string;
  selectedFilePath: string | null;
  onSelectFolder: (path: string) => void;
  onSelectFile: (path: string) => void;
}

function HotspotTreemapCell(props: CustomCellProps) {
  const {
    depth = 0,
    x = 0,
    y = 0,
    width = 0,
    height = 0,
    name = '',
    path = '',
    isFolder = false,
    isAggregated = false,
    sizeValue = 0,
    avgComplexity = 0,
    hasLogic = false,
    fillColor = '#334155',
    selectedFilePath,
    onSelectFolder,
    onSelectFile,
  } = props;

  if (depth !== 1 || width <= 2 || height <= 2) {
    return <g />;
  }

  const isSelected = !isFolder && !isAggregated && selectedFilePath === path;
  const isInteractive = !isAggregated;
  const displayTitle = isFolder ? `${name}/` : name;
  const showTitle = width >= 44 && height >= 22;
  const showMeta = width >= 76 && height >= 42;
  const maxChars = Math.max(4, Math.floor((width - 12) / 6.5));
  const truncatedTitle =
    displayTitle.length > maxChars
      ? `${displayTitle.slice(0, maxChars - 1)}…`
      : displayTitle;

  const handleActivate = () => {
    if (isAggregated) return;
    if (isFolder) {
      onSelectFolder(path);
    } else {
      onSelectFile(path);
    }
  };

  return (
    <g>
      <rect
        x={x + 1}
        y={y + 1}
        width={Math.max(0, width - 2)}
        height={Math.max(0, height - 2)}
        rx={4}
        fill={fillColor}
        fillOpacity={isSelected ? 1 : 0.88}
        stroke={isSelected ? '#38BDF8' : isFolder ? '#CBD5E1' : '#0B0F17'}
        strokeOpacity={isSelected ? 1 : isFolder ? 0.35 : 0.85}
        strokeWidth={isSelected ? 2 : 1.25}
        role={isInteractive ? 'button' : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        aria-label={displayTitle}
        onClick={handleActivate}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleActivate();
          }
        }}
        style={{ cursor: isInteractive ? 'pointer' : 'default' }}
      />
      {showTitle && (
        <text
          x={x + 7}
          y={y + 16}
          fill="#F8FAFC"
          fontSize={11}
          fontWeight={isFolder ? 700 : 500}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          pointerEvents="none"
        >
          {truncatedTitle}
        </text>
      )}
      {showMeta && (
        <text
          x={x + 7}
          y={y + 32}
          fill="#E2E8F0"
          fillOpacity={0.9}
          fontSize={10}
          fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          pointerEvents="none"
        >
          {hasLogic
            ? `${formatCompactCount(sizeValue)}L · M ${avgComplexity}`
            : `${formatCompactCount(sizeValue)}L`}
        </text>
      )}
    </g>
  );
}

export function CodeHotspotTreemap({
  t,
  lang,
  repoName,
  files,
  onInspectInExplorer,
}: CodeHotspotTreemapProps) {
  const [zoomPath, setZoomPath] = useState('');
  const [sizeMetric, setSizeMetric] = useState<'lines' | 'codeLines'>('lines');
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);

  useEffect(() => {
    setZoomPath('');
    setSelectedFilePath(null);
  }, [files]);

  const { rootNode, folderIndex, fileLookup } = useMemo(() => {
    const createFolder = (name: string, path: string): TreeNode => ({
      name,
      path,
      isFolder: true,
      lines: 0,
      codeLines: 0,
      sizeBytes: 0,
      fileCount: 0,
      complexitySum: 0,
      logicFileCount: 0,
      maxComplexity: 0,
      maxNesting: 0,
      functionCount: 0,
      childrenMap: new Map(),
    });

    const root = createFolder(repoName || t.hotspotRootLabel, '');
    const index = new Map<string, TreeNode>([['', root]]);
    const fMap = new Map<string, AnalyzedFile>();

    for (const file of files) {
      fMap.set(file.path, file);
      const parts = file.path.split('/').filter(Boolean);
      if (parts.length === 0) continue;

      const est = estimateFileComplexity(file);
      let cursor = root;
      const ancestors: TreeNode[] = [root];

      for (let i = 0; i < parts.length - 1; i++) {
        const segment = parts[i];
        const nextPath = cursor.path ? `${cursor.path}/${segment}` : segment;
        let childFolder = cursor.childrenMap.get(`dir:${segment}`);
        if (!childFolder) {
          childFolder = createFolder(segment, nextPath);
          cursor.childrenMap.set(`dir:${segment}`, childFolder);
          index.set(nextPath, childFolder);
        }
        cursor = childFolder;
        ancestors.push(cursor);
      }

      const fileName = parts[parts.length - 1];
      const fileNode: TreeNode = {
        name: fileName,
        path: file.path,
        isFolder: false,
        lines: file.lines,
        codeLines: file.codeLines,
        sizeBytes: file.sizeBytes,
        fileCount: 1,
        complexitySum: est.complexity,
        logicFileCount: est.hasLogic ? 1 : 0,
        maxComplexity: est.complexity,
        maxNesting: est.maxNesting,
        functionCount: est.functionCount,
        language: file.language,
        fileColor: file.color,
        childrenMap: new Map(),
      };
      cursor.childrenMap.set(`file:${file.path}`, fileNode);

      for (const anc of ancestors) {
        anc.lines += file.lines;
        anc.codeLines += file.codeLines;
        anc.sizeBytes += file.sizeBytes;
        anc.fileCount += 1;
        if (est.hasLogic) {
          anc.complexitySum += est.complexity;
          anc.logicFileCount += 1;
          if (est.complexity > anc.maxComplexity) {
            anc.maxComplexity = est.complexity;
          }
          if (est.maxNesting > anc.maxNesting) {
            anc.maxNesting = est.maxNesting;
          }
          anc.functionCount += est.functionCount;
        }
      }
    }

    return { rootNode: root, folderIndex: index, fileLookup: fMap };
  }, [files, repoName, t.hotspotRootLabel]);

  const currentFolder = folderIndex.get(zoomPath) ?? rootNode;

  const treemapNodes = useMemo<FlatTreemapItem[]>(() => {
    const entries: FlatTreemapItem[] = [];
    for (const node of currentFolder.childrenMap.values()) {
      const sizeValue = sizeMetric === 'codeLines' ? node.codeLines : node.lines;
      if (sizeValue <= 0) continue;

      const hasLogic = node.logicFileCount > 0;
      const avgComplexity = hasLogic
        ? Number((node.complexitySum / node.logicFileCount).toFixed(1))
        : 0;

      entries.push({
        name: node.name,
        path: node.path,
        isFolder: node.isFolder,
        sizeValue,
        lines: node.lines,
        codeLines: node.codeLines,
        sizeBytes: node.sizeBytes,
        fileCount: node.fileCount,
        avgComplexity,
        maxComplexity: node.maxComplexity,
        maxNesting: node.maxNesting,
        functionCount: node.functionCount,
        hasLogic,
        language: node.language,
        fillColor: resolveHotspotFill(
          hasLogic,
          avgComplexity,
          node.maxComplexity
        ),
      });
    }

    entries.sort((a, b) => b.sizeValue - a.sizeValue);

    const MAX_TILES = 36;
    if (entries.length <= MAX_TILES) {
      return entries;
    }

    const visible = entries.slice(0, MAX_TILES - 1);
    const tail = entries.slice(MAX_TILES - 1);
    const tailLines = tail.reduce((s, item) => s + item.lines, 0);
    const tailCodeLines = tail.reduce((s, item) => s + item.codeLines, 0);
    const tailBytes = tail.reduce((s, item) => s + item.sizeBytes, 0);
    const tailFiles = tail.reduce((s, item) => s + item.fileCount, 0);
    const tailSize = tail.reduce((s, item) => s + item.sizeValue, 0);
    const tailLogic = tail.filter((item) => item.hasLogic);
    const tailAvg =
      tailLogic.length > 0
        ? Number(
            (
              tailLogic.reduce((s, item) => s + item.avgComplexity, 0) /
              tailLogic.length
            ).toFixed(1)
          )
        : 0;
    const tailPeak = tailLogic.reduce(
      (m, item) => Math.max(m, item.maxComplexity),
      0
    );

    visible.push({
      name: formatMessage(t.hotspotOtherSmallItems, {
        count: formatNumber(tail.length, lang),
      }),
      path: `${currentFolder.path || 'root'}/__other__`,
      isFolder: false,
      isAggregated: true,
      sizeValue: tailSize,
      lines: tailLines,
      codeLines: tailCodeLines,
      sizeBytes: tailBytes,
      fileCount: tailFiles,
      avgComplexity: tailAvg,
      maxComplexity: tailPeak,
      maxNesting: 0,
      functionCount: 0,
      hasLogic: tailLogic.length > 0,
      fillColor: resolveHotspotFill(tailLogic.length > 0, tailAvg, tailPeak),
    });

    return visible;
  }, [currentFolder, sizeMetric, t.hotspotOtherSmallItems, lang]);

  const breadcrumbs = useMemo(() => {
    const crumbs: Array<{ label: string; path: string }> = [
      { label: t.hotspotRootLabel, path: '' },
    ];
    if (!zoomPath) return crumbs;
    const parts = zoomPath.split('/').filter(Boolean);
    let acc = '';
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      crumbs.push({ label: part, path: acc });
    }
    return crumbs;
  }, [zoomPath, t.hotspotRootLabel]);

  const parentPath = useMemo(() => {
    if (!zoomPath) return null;
    const parts = zoomPath.split('/').filter(Boolean);
    parts.pop();
    return parts.join('/');
  }, [zoomPath]);

  const selectedFile = selectedFilePath
    ? fileLookup.get(selectedFilePath) ?? null
    : null;
  const selectedFileEst = selectedFile
    ? estimateFileComplexity(selectedFile)
    : null;

  const currentFolderAvg =
    currentFolder.logicFileCount > 0
      ? Number(
          (currentFolder.complexitySum / currentFolder.logicFileCount).toFixed(1)
        )
      : 0;

  if (files.length === 0) return null;

  return (
    <div className="mt-6 rounded-xl border border-slate-800/80 bg-[#111827] p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            {t.hotspotTreemapTitle}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {t.hotspotTreemapSubtitle}
          </p>
        </div>

        <div
          role="group"
          aria-label={t.hotspotTreemapTitle}
          className="inline-flex self-start sm:self-auto items-center rounded-lg border border-slate-800 bg-[#0B0F17] p-1 shrink-0"
        >
          <button
            type="button"
            onClick={() => setSizeMetric('lines')}
            aria-pressed={sizeMetric === 'lines'}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              sizeMetric === 'lines'
                ? 'bg-sky-500/20 text-sky-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.colLines}
          </button>
          <button
            type="button"
            onClick={() => setSizeMetric('codeLines')}
            aria-pressed={sizeMetric === 'codeLines'}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              sizeMetric === 'codeLines'
                ? 'bg-sky-500/20 text-sky-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.colCodeLines}
          </button>
        </div>
      </div>

      {/* Breadcrumb Navigation + Complexity Thermal Legend */}
      <div className="mt-4 flex flex-col gap-3 border-y border-slate-800/80 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {parentPath !== null && (
            <button
              type="button"
              onClick={() => {
                setZoomPath(parentPath);
                setSelectedFilePath(null);
              }}
              className="me-1 inline-flex items-center gap-1 rounded-md border border-slate-700/80 bg-[#0B0F17] px-2.5 py-1 text-xs font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowUp className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
              <span>{t.hotspotZoomOutButton}</span>
            </button>
          )}

          <nav aria-label="Directory breadcrumb" className="flex flex-wrap items-center gap-1">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <Fragment key={crumb.path || 'root'}>
                  {idx > 0 && (
                    <ChevronRight
                      className="h-3.5 w-3.5 text-slate-600 shrink-0 rtl:rotate-180"
                      aria-hidden="true"
                    />
                  )}
                  <button
                    type="button"
                    disabled={isLast}
                    onClick={() => {
                      setZoomPath(crumb.path);
                      setSelectedFilePath(null);
                    }}
                    className={`rounded px-1.5 py-0.5 font-mono text-xs transition-colors ${
                      isLast
                        ? 'font-semibold text-sky-300 cursor-default'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100 cursor-pointer'
                    }`}
                  >
                    {crumb.label}
                  </button>
                </Fragment>
              );
            })}
          </nav>

          <span className="ms-1 text-slate-500" aria-hidden="true">
            ·
          </span>
          <span className="font-mono text-[11px] text-slate-400 tabular-nums">
            {formatMessage(t.hotspotFolderSummary, {
              files: formatNumber(currentFolder.fileCount, lang),
              avg: formatNumber(currentFolderAvg, lang),
              peak: formatNumber(currentFolder.maxComplexity, lang),
            })}
          </span>
        </div>

        {/* Thermal Scale Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slate-300 shrink-0">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-xs bg-[#0F766E]" />
            <span>{t.hotspotLegendLow}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-xs bg-[#0369A1]" />
            <span>{t.hotspotLegendModerate}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-xs bg-[#B45309]" />
            <span>{t.hotspotLegendElevated}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-xs bg-[#B91C1C]" />
            <span>{t.hotspotLegendCritical}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-3.5 rounded-xs bg-[#334155]" />
            <span>{t.hotspotLegendData}</span>
          </span>
        </div>
      </div>

      {/* Treemap Canvas */}
      {treemapNodes.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-400">
          {t.hotspotEmptyDir}
        </div>
      ) : (
        <div dir="ltr" className="mt-4 h-80 sm:h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={treemapNodes}
              dataKey="sizeValue"
              nameKey="name"
              aspectRatio={4 / 3}
              isAnimationActive={false}
              content={
                <HotspotTreemapCell
                  selectedFilePath={selectedFilePath}
                  onSelectFolder={(nextPath) => {
                    setZoomPath(nextPath);
                    setSelectedFilePath(null);
                  }}
                  onSelectFile={(filePath) => setSelectedFilePath(filePath)}
                />
              }
            >
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const item = payload[0].payload as FlatTreemapItem;
                  return (
                    <div
                      dir={lang === 'ar' ? 'rtl' : 'ltr'}
                      className="rounded-lg border border-slate-700 bg-[#0B0F17] px-3.5 py-2.5 text-xs shadow-xl max-w-xs"
                    >
                      <div className="flex items-center gap-2 font-mono font-semibold text-slate-100">
                        {item.isFolder ? (
                          <Folder
                            className="h-3.5 w-3.5 shrink-0 text-sky-400"
                            aria-hidden="true"
                          />
                        ) : (
                          <FileCode2
                            className="h-3.5 w-3.5 shrink-0 text-slate-400"
                            aria-hidden="true"
                          />
                        )}
                        <span dir="ltr" className="truncate">
                          {item.isFolder ? `${item.path || item.name}/` : item.path}
                        </span>
                      </div>

                      <div className="mt-2 space-y-1 text-slate-300 tabular-nums">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-400">{t.colLines}:</span>
                          <span className="font-mono font-semibold text-slate-100">
                            {formatNumber(item.lines, lang)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-400">{t.colCodeLines}:</span>
                          <span className="font-mono text-slate-200">
                            {formatNumber(item.codeLines, lang)}
                          </span>
                        </div>
                        {item.isFolder && (
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-400">{t.colFiles}:</span>
                            <span className="font-mono text-slate-200">
                              {formatNumber(item.fileCount, lang)}
                            </span>
                          </div>
                        )}
                        {item.hasLogic && (
                          <>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-slate-400">
                                {item.isFolder
                                  ? t.complexityAvgLabel
                                  : t.healthComplexityScoreLabel}
                                :
                              </span>
                              <span
                                dir="ltr"
                                className="font-mono font-semibold text-amber-300"
                              >
                                M = {formatNumber(item.avgComplexity, lang)}
                              </span>
                            </div>
                            {item.isFolder && (
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-slate-400">
                                  {t.complexityPeakLabel}:
                                </span>
                                <span dir="ltr" className="font-mono text-slate-200">
                                  M = {formatNumber(item.maxComplexity, lang)}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-400">{t.colSize}:</span>
                          <span className="font-mono text-slate-300">
                            {formatBytes(item.sizeBytes)}
                          </span>
                        </div>
                      </div>

                      {!item.isAggregated && (
                        <div className="mt-2 border-t border-slate-800 pt-1.5 text-[11px] text-sky-400">
                          {item.isFolder
                            ? t.hotspotClickFolderHint
                            : t.hotspotClickFileHint}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
            </Treemap>
          </ResponsiveContainer>
        </div>
      )}

      {/* Selected File Inspection Strip (no nested cards) */}
      {selectedFile && selectedFileEst && (
        <div className="mt-4 flex flex-col gap-3 border-t border-slate-800/80 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-slate-400">
              {t.hotspotSelectedFileTitle}
            </div>
            <div className="mt-1 flex items-center gap-2 min-w-0">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-xs"
                style={{ backgroundColor: selectedFile.color }}
              />
              <span
                dir="ltr"
                className="truncate font-mono text-sm font-semibold text-slate-100"
              >
                {selectedFile.path}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-400 tabular-nums">
              <span>{selectedFile.language}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-200">
                {formatNumber(selectedFile.lines, lang)} {t.colLines}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">
                {formatBytes(selectedFile.sizeBytes)}
              </span>
              {selectedFileEst.hasLogic && (
                <>
                  <span aria-hidden="true">·</span>
                  <span
                    dir="ltr"
                    className="font-mono font-semibold text-amber-300"
                  >
                    M = {formatNumber(selectedFileEst.complexity, lang)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono text-slate-300">
                    {formatMessage(t.complexityDepthLabel, {
                      depth: formatNumber(selectedFileEst.maxNesting, lang),
                    })}
                  </span>
                </>
              )}
            </div>
          </div>

          {onInspectInExplorer && (
            <button
              type="button"
              onClick={() => onInspectInExplorer(selectedFile.path)}
              className="inline-flex min-h-[38px] items-center gap-1.5 self-start sm:self-auto rounded-lg border border-slate-700 bg-[#0B0F17] px-3.5 py-1.5 text-xs font-medium text-sky-300 hover:border-sky-500/60 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{t.hotspotOpenInExplorer}</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
