import { Check, Loader2 } from 'lucide-react';
import { formatNumber, type Translations } from '../lib/i18n.ts';
import { formatBytes } from '../lib/languageMap.ts';
import type { AnalysisProgressEvent, AppLanguage, ProgressStage } from '../lib/types.ts';

interface ProgressPanelProps {
  t: Translations;
  lang: AppLanguage;
  progress: AnalysisProgressEvent;
}

const ORDERED_STAGES: ProgressStage[] = [
  'connecting',
  'metadata',
  'downloading',
  'parsing',
];

export function ProgressPanel({ t, lang, progress }: ProgressPanelProps) {
  const stageLabels: Record<ProgressStage, string> = {
    connecting: t.stageConnecting,
    metadata: t.stageMetadata,
    downloading: t.stageDownloading,
    parsing: t.stageParsing,
    complete: t.stageComplete,
  };

  const currentIdx = Math.max(
    0,
    ORDERED_STAGES.indexOf(
      progress.stage === 'complete' ? 'parsing' : progress.stage
    )
  );

  const clampedPct = Math.max(0, Math.min(100, progress.progress));

  return (
    <section
      aria-live="polite"
      className="rounded-xl border border-slate-800/90 bg-[#111827] p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Loader2
            className="h-5 w-5 animate-spin text-sky-400 shrink-0"
            aria-hidden="true"
          />
          <h2 className="text-base font-semibold text-slate-100">
            {stageLabels[progress.stage]}
          </h2>
        </div>
        <span className="font-mono text-sm font-semibold text-sky-400 tabular-nums">
          {formatNumber(clampedPct, lang)}%
        </span>
      </div>

      {/* Determinate progress bar */}
      <div
        role="progressbar"
        aria-valuenow={clampedPct}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-800"
      >
        <div
          className="h-full rounded-full bg-sky-500 transition-[width] duration-200 ease-out"
          style={{ width: `${clampedPct}%` }}
        />
      </div>

      {/* 4-stage horizontal indicator */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ORDERED_STAGES.map((stage, idx) => {
          const isDone = progress.stage === 'complete' || idx < currentIdx;
          const isActive = progress.stage !== 'complete' && idx === currentIdx;
          return (
            <div
              key={stage}
              className={`flex items-center gap-2 text-xs ${
                isDone
                  ? 'text-emerald-400'
                  : isActive
                    ? 'text-slate-100 font-medium'
                    : 'text-slate-500'
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-mono tabular-nums ${
                  isDone
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                    : isActive
                      ? 'border-sky-400 bg-sky-500/15 text-sky-300'
                      : 'border-slate-700 bg-slate-900 text-slate-500'
                }`}
              >
                {isDone ? (
                  <Check className="h-3 w-3" aria-hidden="true" />
                ) : (
                  idx + 1
                )}
              </span>
              <span className="truncate">{stageLabels[stage]}</span>
            </div>
          );
        })}
      </div>

      {/* Live streaming telemetry */}
      <div className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-800/80 pt-4 sm:grid-cols-3">
        <div>
          <div className="text-xs text-slate-400">{t.progressDownloaded}</div>
          <div className="mt-0.5 font-mono text-sm font-medium text-slate-200 tabular-nums">
            {formatBytes(progress.bytesDownloaded)}
            {progress.totalBytes
              ? ` / ${formatBytes(progress.totalBytes)}`
              : ''}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">{t.progressFilesScanned}</div>
          <div className="mt-0.5 font-mono text-sm font-medium text-slate-200 tabular-nums">
            {formatNumber(progress.filesProcessed, lang)}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400">{t.progressLinesCounted}</div>
          <div className="mt-0.5 font-mono text-sm font-medium text-slate-200 tabular-nums">
            {formatNumber(progress.linesCounted, lang)}
          </div>
        </div>
      </div>

      {progress.currentFile && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <span className="shrink-0">{t.progressCurrentFile}:</span>
          <span dir="ltr" className="truncate font-mono text-slate-300">
            {progress.currentFile}
          </span>
        </div>
      )}
    </section>
  );
}
