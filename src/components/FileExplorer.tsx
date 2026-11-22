import { RotateCcw, Search, X } from 'lucide-react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { formatMessage, formatNumber, type Translations } from '../lib/i18n.ts';
import { formatBytes } from '../lib/languageMap.ts';
import type { AnalyzedFile, AppLanguage, LanguageStat } from '../lib/types.ts';

export type SizePreset = 'all' | 'tiny' | 'small' | 'medium' | 'large';
export type SortOption =
  | 'lines-desc'
  | 'lines-asc'
  | 'size-desc'
  | 'size-asc'
  | 'path-asc';
export type SearchScope = 'filename' | 'path';

export interface FileFilterState {
  query: string;
  searchScope: SearchScope;
  language: string;
  extension: string;
  sizePreset: SizePreset;
  minKb: string;
  maxKb: string;
  sort: SortOption;
}

function HighlightedMatch({ text, query }: { text: string; query: string }) {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return <>{text}</>;

  const firstToken = tokens[0];
  const lower = text.toLowerCase();
  const idx = lower.indexOf(firstToken);
  if (idx === -1) return <>{text}</>;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + firstToken.length);
  const after = text.slice(idx + firstToken.length);

  return (
    <Fragment>
      {before}
      <mark className="rounded-xs bg-sky-500/25 px-0.5 text-sky-200">
        {match}
      </mark>
      {after}
    </Fragment>
  );
}

interface FileExplorerProps {
  t: Translations;
  lang: AppLanguage;
  files: AnalyzedFile[];
  languages: LanguageStat[];
  filesTruncated: boolean;
  filters: FileFilterState;
  onFiltersChange: (next: FileFilterState) => void;
  filteredFiles: AnalyzedFile[];
}

const PAGE_SIZE = 50;

export function FileExplorer({
  t,
  lang,
  files,
  languages,
  filesTruncated,
  filters,
  onFiltersChange,
  filteredFiles,
}: FileExplorerProps) {
  const [page, setPage] = useState(1);

  // Reset pagination whenever filters change
  useEffect(() => {
    setPage(1);
  }, [
    filters.query,
    filters.language,
    filters.extension,
    filters.sizePreset,
    filters.minKb,
    filters.maxKb,
    filters.sort,
  ]);

  const extensions = useMemo(() => {
    const extCounts = new Map<string, number>();
    for (const f of files) {
      extCounts.set(f.extension, (extCounts.get(f.extension) ?? 0) + 1);
    }
    return Array.from(extCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([ext, count]) => ({ ext, count }));
  }, [files]);

  const filteredTotals = useMemo(() => {
    let lines = 0;
    let size = 0;
    for (const f of filteredFiles) {
      lines += f.lines;
      size += f.sizeBytes;
    }
    return { lines, size };
  }, [filteredFiles]);

  const totalPages = Math.max(1, Math.ceil(filteredFiles.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedFiles = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredFiles.slice(start, start + PAGE_SIZE);
  }, [filteredFiles, safePage]);

  const hasActiveFilters =
    filters.query !== '' ||
    filters.language !== 'ALL' ||
    filters.extension !== 'ALL' ||
    filters.sizePreset !== 'all' ||
    filters.minKb !== '' ||
    filters.maxKb !== '';

  const resetAll = () => {
    onFiltersChange({
      query: '',
      searchScope: 'filename',
      language: 'ALL',
      extension: 'ALL',
      sizePreset: 'all',
      minKb: '',
      maxKb: '',
      sort: 'lines-desc',
    });
  };

  return (
    <section id="files" className="border-t border-slate-800/80 pt-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            {t.sectionFilesTitle}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {t.sectionFilesSubtitle}
          </p>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex min-h-[36px] items-center gap-1.5 self-start sm:self-auto rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
            <span>{t.resetFilters}</span>
          </button>
        )}
      </div>

      {/* Dedicated File Search Bar with Filename / Full Path Scope Toggle */}
      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <label htmlFor="file-search-input" className="sr-only">
            {filters.searchScope === 'filename'
              ? t.searchFilenamePlaceholder
              : t.searchFilesPlaceholder}
          </label>
          <Search
            className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="file-search-input"
            type="text"
            value={filters.query}
            onChange={(e) =>
              onFiltersChange({ ...filters, query: e.target.value })
            }
            placeholder={
              filters.searchScope === 'filename'
                ? t.searchFilenamePlaceholder
                : t.searchFilesPlaceholder
            }
            className="h-11 w-full rounded-lg border border-slate-700/80 bg-[#111827] ps-10 pe-10 text-sm text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
          {filters.query && (
            <button
              type="button"
              onClick={() => onFiltersChange({ ...filters, query: '' })}
              aria-label={t.clearSearchLabel}
              className="absolute top-1/2 end-2.5 -translate-y-1/2 rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="inline-flex items-center self-start sm:self-auto rounded-lg border border-slate-800 bg-[#111827] p-1 shrink-0">
          <button
            type="button"
            onClick={() =>
              onFiltersChange({ ...filters, searchScope: 'filename' })
            }
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              filters.searchScope === 'filename'
                ? 'bg-sky-500/20 text-sky-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.searchScopeFilename}
          </button>
          <button
            type="button"
            onClick={() => onFiltersChange({ ...filters, searchScope: 'path' })}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              filters.searchScope === 'path'
                ? 'bg-sky-500/20 text-sky-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.searchScopePath}
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-8">
        {/* Language select */}
        <div className="lg:col-span-2">
          <label htmlFor="filter-language" className="sr-only">
            {t.filterLanguageLabel}
          </label>
          <select
            id="filter-language"
            value={filters.language}
            onChange={(e) =>
              onFiltersChange({ ...filters, language: e.target.value })
            }
            className="h-10 w-full rounded-lg border border-slate-700/80 bg-[#111827] px-3 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer"
          >
            <option value="ALL">{t.allLanguagesOption}</option>
            {languages.map((l) => (
              <option key={l.name} value={l.name}>
                {l.name} ({l.files})
              </option>
            ))}
          </select>
        </div>

        {/* Extension / File type select */}
        <div className="lg:col-span-2">
          <label htmlFor="filter-extension" className="sr-only">
            {t.filterExtensionLabel}
          </label>
          <select
            id="filter-extension"
            value={filters.extension}
            onChange={(e) =>
              onFiltersChange({ ...filters, extension: e.target.value })
            }
            className="h-10 w-full rounded-lg border border-slate-700/80 bg-[#111827] px-3 font-mono text-xs text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer"
          >
            <option value="ALL">{t.allExtensionsOption}</option>
            {extensions.map((item) => (
              <option key={item.ext} value={item.ext}>
                {item.ext} ({item.count})
              </option>
            ))}
          </select>
        </div>

        {/* Size tier preset */}
        <div className="lg:col-span-2">
          <label htmlFor="filter-size-preset" className="sr-only">
            {t.filterSizePresetLabel}
          </label>
          <select
            id="filter-size-preset"
            value={filters.sizePreset}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                sizePreset: e.target.value as SizePreset,
                minKb: '',
                maxKb: '',
              })
            }
            className="h-10 w-full rounded-lg border border-slate-700/80 bg-[#111827] px-3 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer"
          >
            <option value="all">{t.sizePresetAll}</option>
            <option value="tiny">{t.sizePresetTiny}</option>
            <option value="small">{t.sizePresetSmall}</option>
            <option value="medium">{t.sizePresetMedium}</option>
            <option value="large">{t.sizePresetLarge}</option>
          </select>
        </div>

        {/* Sort select */}
        <div className="lg:col-span-2">
          <label htmlFor="filter-sort" className="sr-only">
            {t.sortLabel}
          </label>
          <select
            id="filter-sort"
            value={filters.sort}
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                sort: e.target.value as SortOption,
              })
            }
            className="h-10 w-full rounded-lg border border-slate-700/80 bg-[#111827] px-3 text-sm text-slate-100 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 cursor-pointer"
          >
            <option value="lines-desc">{t.sortLinesDesc}</option>
            <option value="lines-asc">{t.sortLinesAsc}</option>
            <option value="size-desc">{t.sortSizeDesc}</option>
            <option value="size-asc">{t.sortSizeAsc}</option>
            <option value="path-asc">{t.sortPathAsc}</option>
          </select>
        </div>
      </div>

      {/* Custom Min / Max KB size inputs + live filtered summary */}
      <div className="mt-3 flex flex-col gap-3 border-b border-slate-800/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="min-size-kb"
              className="text-xs text-slate-400 whitespace-nowrap"
            >
              {t.minSizeKbLabel}:
            </label>
            <input
              id="min-size-kb"
              type="number"
              min={0}
              step="0.5"
              dir="ltr"
              value={filters.minKb}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  sizePreset: 'all',
                  minKb: e.target.value,
                })
              }
              placeholder="0"
              className="h-9 w-24 rounded-md border border-slate-700/80 bg-[#111827] px-2.5 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <label
              htmlFor="max-size-kb"
              className="text-xs text-slate-400 whitespace-nowrap"
            >
              {t.maxSizeKbLabel}:
            </label>
            <input
              id="max-size-kb"
              type="number"
              min={0}
              step="0.5"
              dir="ltr"
              value={filters.maxKb}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  sizePreset: 'all',
                  maxKb: e.target.value,
                })
              }
              placeholder="∞"
              className="h-9 w-24 rounded-md border border-slate-700/80 bg-[#111827] px-2.5 font-mono text-xs text-slate-100 placeholder:text-slate-600 focus:border-sky-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="text-xs text-slate-400 tabular-nums">
          {formatMessage(t.showingFilesSummary, {
            shown: formatNumber(filteredFiles.length, lang),
            total: formatNumber(files.length, lang),
            lines: formatNumber(filteredTotals.lines, lang),
            size: formatBytes(filteredTotals.size),
          })}
        </div>
      </div>

      {filesTruncated && (
        <p className="mt-3 text-xs text-amber-400/90">{t.truncatedNotice}</p>
      )}

      {/* Results View */}
      {paginatedFiles.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-slate-200">
            {t.noMatchingFiles}
          </p>
          <p className="mt-1 text-xs text-slate-400">{t.noMatchingFilesHint}</p>
        </div>
      ) : (
        <>
          {/* Desktop Data Table */}
          <div className="mt-4 hidden md:block overflow-x-auto rounded-xl border border-slate-800/80 bg-[#111827]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-medium text-slate-400">
                  <th className="py-2.5 px-4 text-start font-medium">
                    {t.colPath}
                  </th>
                  <th className="py-2.5 px-3 text-start font-medium">
                    {t.colExtension}
                  </th>
                  <th className="py-2.5 px-3 text-start font-medium">
                    {t.colLanguage}
                  </th>
                  <th className="py-2.5 px-3 text-end font-medium">
                    {t.colLines}
                  </th>
                  <th className="py-2.5 px-3 text-end font-medium">
                    {t.colCodeLines}
                  </th>
                  <th className="py-2.5 px-4 text-end font-medium">
                    {t.colSize}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {paginatedFiles.map((file) => (
                  <tr
                    key={file.path}
                    className="hover:bg-slate-800/35 transition-colors"
                  >
                    <td className="h-10 px-4 max-w-[420px]">
                      <span
                        dir="ltr"
                        title={file.path}
                        className="block truncate font-mono text-xs text-slate-200 text-start"
                      >
                        <HighlightedMatch text={file.path} query={filters.query} />
                      </span>
                    </td>
                    <td className="h-10 px-3 font-mono text-xs text-slate-400 whitespace-nowrap">
                      {file.extension}
                    </td>
                    <td className="h-10 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-2 text-xs text-slate-200">
                        <span
                          className="h-2 w-2 shrink-0 rounded-xs"
                          style={{ backgroundColor: file.color }}
                        />
                        <span>{file.language}</span>
                      </span>
                    </td>
                    <td className="h-10 px-3 text-end font-mono text-xs font-semibold text-slate-100 tabular-nums">
                      {formatNumber(file.lines, lang)}
                    </td>
                    <td className="h-10 px-3 text-end font-mono text-xs text-slate-400 tabular-nums">
                      {formatNumber(file.codeLines, lang)}
                    </td>
                    <td className="h-10 px-4 text-end font-mono text-xs text-slate-400 tabular-nums whitespace-nowrap">
                      {formatBytes(file.sizeBytes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cardless List View */}
          <div className="mt-4 divide-y divide-slate-800/70 rounded-xl border border-slate-800/80 bg-[#111827] md:hidden">
            {paginatedFiles.map((file) => (
              <div key={file.path} className="p-3.5">
                <div
                  dir="ltr"
                  className="truncate font-mono text-xs font-medium text-slate-100"
                  title={file.path}
                >
                  <HighlightedMatch text={file.path} query={filters.query} />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-xs"
                      style={{ backgroundColor: file.color }}
                    />
                    <span className="text-slate-300">{file.language}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{file.extension}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono tabular-nums">
                    <span className="font-semibold text-slate-100">
                      {formatNumber(file.lines, lang)} L
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{formatBytes(file.sizeBytes)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-2">
              <span className="text-xs text-slate-400 tabular-nums">
                {formatMessage(t.pageOf, {
                  page: formatNumber(safePage, lang),
                  pages: formatNumber(totalPages, lang),
                })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="min-h-[38px] rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {t.prevPage}
                </button>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="min-h-[38px] rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  {t.nextPage}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
