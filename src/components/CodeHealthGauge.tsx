import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { formatNumber, type Translations } from '../lib/i18n.ts';
import { formatBytes } from '../lib/languageMap.ts';
import type { AppLanguage, CodeHealthMetrics } from '../lib/types.ts';

interface CodeHealthGaugeProps {
  t: Translations;
  lang: AppLanguage;
  health: CodeHealthMetrics;
}

interface HealthTier {
  stroke: string;
  textClass: string;
  barClass: string;
  ratingLabel: string;
}

function getHealthTier(score: number, t: Translations): HealthTier {
  if (score >= 80) {
    return {
      stroke: '#10B981',
      textClass: 'text-emerald-400',
      barClass: 'bg-emerald-500',
      ratingLabel: t.healthRatingHealthy,
    };
  }
  if (score >= 55) {
    return {
      stroke: '#F59E0B',
      textClass: 'text-amber-400',
      barClass: 'bg-amber-500',
      ratingLabel: t.healthRatingModerate,
    };
  }
  return {
    stroke: '#EF4444',
    textClass: 'text-red-400',
    barClass: 'bg-red-500',
    ratingLabel: t.healthRatingNeedsAttention,
  };
}

export function CodeHealthGauge({ t, lang, health }: CodeHealthGaugeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const popoverId = useId();

  const clampedScore = Math.max(0, Math.min(100, Math.round(health.score)));
  const tier = getHealthTier(clampedScore, t);
  const formattedScore = formatNumber(clampedScore, lang);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const commentBarWidthPct = Math.max(
    0,
    Math.min(100, (health.commentScore / 35) * 100)
  );
  const fileSizeBarWidthPct = Math.max(
    0,
    Math.min(100, (health.fileSizeScore / 35) * 100)
  );
  const complexityScoreVal = health.complexityScore ?? 24;
  const complexityBarWidthPct = Math.max(
    0,
    Math.min(100, (complexityScoreVal / 30) * 100)
  );

  return (
    <div ref={containerRef} className="sm:relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={popoverId}
        aria-label={`${t.healthGaugeLabel}: ${formattedScore}/100 (${tier.ratingLabel})`}
        className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        {/* Semicircular Arc Gauge */}
        <svg
          width="46"
          height="26"
          viewBox="0 0 64 36"
          aria-hidden="true"
          className="shrink-0 overflow-visible"
        >
          <path
            d="M 8 31 A 24 24 0 0 1 56 31"
            fill="none"
            stroke="#1E293B"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <path
            d="M 8 31 A 24 24 0 0 1 56 31"
            fill="none"
            stroke={tier.stroke}
            strokeWidth="5.5"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={100 - clampedScore}
          />
          <text
            x="32"
            y="30"
            textAnchor="middle"
            fill="#F8FAFC"
            fontSize="13"
            fontWeight="700"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
          >
            {formattedScore}
          </text>
        </svg>

        <div className="hidden sm:flex flex-col items-start leading-tight">
          <span className="text-[11px] font-medium text-slate-400">
            {t.healthGaugeLabel}
          </span>
          <span className={`text-xs font-semibold ${tier.textClass}`}>
            {tier.ratingLabel}
          </span>
        </div>

        <ChevronDown
          className={`h-3.5 w-3.5 text-slate-400 transition-transform shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          id={popoverId}
          role="dialog"
          aria-label={t.healthPopoverTitle}
          className="absolute end-4 sm:end-0 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] sm:w-80 rounded-xl border border-slate-700/80 bg-[#111827] p-4 shadow-xl z-40"
        >
          <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <div className="text-xs font-semibold text-slate-100">
                {t.healthPopoverTitle}
              </div>
              <div className={`mt-0.5 text-xs font-medium ${tier.textClass}`}>
                {tier.ratingLabel}
              </div>
            </div>
            <div className="font-mono text-lg font-bold text-slate-50 tabular-nums">
              {formattedScore}
              <span className="text-xs font-normal text-slate-400"> / 100</span>
            </div>
          </div>

          <div className="mt-3.5 space-y-3.5 text-xs">
            {/* Component 1: Comment-to-Code Ratio */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-300">
                  {t.healthCommentScoreLabel}
                </span>
                <span className="font-mono font-semibold text-slate-100 tabular-nums">
                  {formatNumber(health.commentScore, lang)} / {formatNumber(35, lang)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full ${tier.barClass}`}
                  style={{ width: `${commentBarWidthPct}%` }}
                />
              </div>
              <div className="mt-1.5 text-[11px] text-slate-400 tabular-nums">
                {health.commentDataAvailable ? (
                  <span>
                    {t.healthCommentRatioLabel}:{' '}
                    <span className="font-mono text-slate-200">
                      {health.commentRatioPct}%
                    </span>{' '}
                    ({formatNumber(health.commentLines, lang)} /{' '}
                    {formatNumber(health.commentCapableLines, lang)})
                  </span>
                ) : (
                  <span>{t.healthNoCommentData}</span>
                )}
              </div>
            </div>

            {/* Component 2: File Size Distribution */}
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-slate-300">
                  {t.healthFileSizeScoreLabel}
                </span>
                <span className="font-mono font-semibold text-slate-100 tabular-nums">
                  {formatNumber(health.fileSizeScore, lang)} / {formatNumber(35, lang)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full ${tier.barClass}`}
                  style={{ width: `${fileSizeBarWidthPct}%` }}
                />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-800/80 pt-2 text-[11px]">
                <div>
                  <div className="text-slate-400">{t.healthMedianSizeLabel}</div>
                  <div className="mt-0.5 font-mono font-medium text-slate-200 tabular-nums">
                    {formatBytes(health.medianFileSizeBytes)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">{t.healthOversizedFilesLabel}</div>
                  <div className="mt-0.5 font-mono font-medium text-slate-200 tabular-nums">
                    {formatNumber(health.oversizedFilesCount, lang)}{' '}
                    <span className="text-slate-400 font-normal">
                      ({health.healthySizeFilesPct}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Component 3: Cyclomatic Complexity */}
            {health.complexity && (
              <div className="border-t border-slate-800/80 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-300">
                    {t.healthComplexityScoreLabel}
                  </span>
                  <span className="font-mono font-semibold text-slate-100 tabular-nums">
                    {formatNumber(complexityScoreVal, lang)} / {formatNumber(30, lang)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full ${tier.barClass}`}
                    style={{ width: `${complexityBarWidthPct}%` }}
                  />
                </div>
                <div className="mt-1.5 text-[11px] text-slate-400 tabular-nums">
                  {t.healthComplexityAvgSub
                    .replace('{avg}', formatNumber(health.complexity.avgComplexity, lang))
                    .replace('{files}', formatNumber(health.complexity.logicFilesCount, lang))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
