import { GitCompareArrows, Search, X } from 'lucide-react';
import type { FormEvent } from 'react';
import type { Translations } from '../lib/i18n.ts';
import { PWAInstallButton } from './PWAInstallButton.tsx';

interface RepoSearchBarProps {
  t: Translations;
  repoUrl: string;
  onRepoUrlChange: (val: string) => void;
  compareMode: boolean;
  onToggleCompareMode: () => void;
  secondRepoUrl: string;
  onSecondRepoUrlChange: (val: string) => void;
  onSubmit: (primaryOverride?: string, secondaryOverride?: string) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const SAMPLE_REPOS = [
  { label: 'Co-dfns/Co-dfns', note: 'APL (.apl)' },
  { label: 'expressjs/express', note: 'JavaScript' },
  { label: 'tiangolo/fastapi', note: 'Python' },
];

export function RepoSearchBar({
  t,
  repoUrl,
  onRepoUrlChange,
  compareMode,
  onToggleCompareMode,
  secondRepoUrl,
  onSecondRepoUrlChange,
  onSubmit,
  onCancel,
  isLoading,
}: RepoSearchBarProps) {
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const canSubmit =
    !isLoading &&
    repoUrl.trim().length > 0 &&
    (!compareMode || secondRepoUrl.trim().length > 0);

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              dir="ltr"
              value={repoUrl}
              onChange={(e) => onRepoUrlChange(e.target.value)}
              placeholder={
                compareMode
                  ? `${t.repoALabel}: ${t.inputPlaceholder}`
                  : t.inputPlaceholder
              }
              aria-label={t.inputPlaceholder}
              disabled={isLoading}
              className="h-12 w-full rounded-lg border border-slate-700/80 bg-[#111827] ps-10 pe-10 font-mono text-sm text-slate-100 placeholder:font-sans placeholder:text-slate-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 disabled:opacity-60"
            />
            {repoUrl && !isLoading && (
              <button
                type="button"
                onClick={() => onRepoUrlChange('')}
                aria-label="Clear primary input"
                className="absolute top-1/2 end-2.5 -translate-y-1/2 rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="submit"
              disabled={!canSubmit}
              className="h-12 w-full sm:w-auto rounded-lg bg-sky-500 px-6 text-sm font-semibold text-slate-950 hover:bg-sky-400 transition-colors disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F17]"
            >
              {isLoading
                ? t.analyzingButton
                : compareMode
                  ? t.addSecondRepoButton
                  : t.analyzeButton}
            </button>

            {isLoading && (
              <button
                type="button"
                onClick={onCancel}
                className="h-12 rounded-lg border border-slate-700 bg-slate-900 px-4 text-sm font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
              >
                {t.cancelButton}
              </button>
            )}
          </div>
        </div>

        {/* Second repository input for side-by-side comparison */}
        {compareMode && (
          <div className="relative">
            <GitCompareArrows
              className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-emerald-400"
              aria-hidden="true"
            />
            <input
              type="text"
              dir="ltr"
              value={secondRepoUrl}
              onChange={(e) => onSecondRepoUrlChange(e.target.value)}
              placeholder={`${t.repoBLabel}: ${t.secondRepoPlaceholder}`}
              aria-label={t.secondRepoPlaceholder}
              disabled={isLoading}
              className="h-12 w-full rounded-lg border border-emerald-500/40 bg-[#111827] ps-10 pe-10 font-mono text-sm text-slate-100 placeholder:font-sans placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-60"
            />
            {secondRepoUrl && !isLoading && (
              <button
                type="button"
                onClick={() => onSecondRepoUrlChange('')}
                aria-label="Clear second repository input"
                className="absolute top-1/2 end-2.5 -translate-y-1/2 rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </form>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span>{t.sampleLabel}</span>
          {SAMPLE_REPOS.map((sample) => (
            <button
              key={sample.label}
              type="button"
              disabled={isLoading}
              onClick={() => {
                const full = `https://github.com/${sample.label}`;
                if (compareMode && repoUrl.trim()) {
                  onSecondRepoUrlChange(full);
                  onSubmit(repoUrl, full);
                } else {
                  onRepoUrlChange(full);
                  if (!compareMode) {
                    onSubmit(full);
                  }
                }
              }}
              className="inline-flex items-center gap-1.5 py-1 text-slate-300 hover:text-sky-400 transition-colors disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:underline"
            >
              <span className="font-mono">{sample.label}</span>
              <span className="text-slate-500">· {sample.note}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            disabled={isLoading}
            onClick={onToggleCompareMode}
            className="inline-flex items-center gap-1.5 py-1 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <GitCompareArrows className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{compareMode ? t.closeCompareInput : t.compareModeButton}</span>
          </button>

          <PWAInstallButton t={t} />
        </div>
      </div>
    </div>
  );
}
