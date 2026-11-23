import { useMemo, useState } from 'react';
import { formatMessage, formatNumber, type Translations } from '../lib/i18n.ts';
import { formatBytes } from '../lib/languageMap.ts';
import type {
  AppLanguage,
  ComplexityMetrics,
  RefactoringCategory,
  RefactoringRecommendation,
} from '../lib/types.ts';
import { KpiCardHeader } from './KpiCardHeader.tsx';

interface ComplexityInsightsProps {
  t: Translations;
  lang: AppLanguage;
  complexity: ComplexityMetrics;
}

type ComplexityFilter = 'all' | 'critical-high' | 'nesting' | 'large';

function getComplexityTier(score: number, t: Translations): {
  label: string;
  colorClass: string;
} {
  if (score >= 75) {
    return { label: t.complexityTierLow, colorClass: 'text-emerald-400' };
  }
  if (score >= 45) {
    return { label: t.complexityTierModerate, colorClass: 'text-amber-400' };
  }
  return { label: t.complexityTierHigh, colorClass: 'text-red-400' };
}

function getSeverityDisplay(
  severity: RefactoringRecommendation['severity'],
  t: Translations
): { label: string; colorClass: string } {
  if (severity === 'critical') {
    return { label: t.complexitySeverityCritical, colorClass: 'text-red-400' };
  }
  if (severity === 'high') {
    return { label: t.complexitySeverityHigh, colorClass: 'text-amber-400' };
  }
  return { label: t.complexitySeverityModerate, colorClass: 'text-sky-400' };
}

function formatCategoryCopy(
  category: RefactoringCategory,
  rec: RefactoringRecommendation,
  t: Translations,
  lang: AppLanguage
): { title: string; description: string } {
  switch (category) {
    case 'extract-functions':
      return {
        title: t.recTitleExtractFunctions,
        description: t.recDescExtractFunctions,
      };
    case 'flatten-nesting':
      return {
        title: t.recTitleFlattenNesting,
        description: formatMessage(t.recDescFlattenNesting, {
          depth: formatNumber(rec.maxNesting, lang),
        }),
      };
    case 'simplify-conditionals':
      return {
        title: t.recTitleSimplifyConditionals,
        description: formatMessage(t.recDescSimplifyConditionals, {
          complexity: formatNumber(rec.complexity, lang),
        }),
      };
    case 'split-module':
      return {
        title: t.recTitleSplitModule,
        description: formatMessage(t.recDescSplitModule, {
          lines: formatNumber(rec.codeLines, lang),
        }),
      };
    case 'add-documentation':
      return {
        title: t.recTitleAddDocumentation,
        description: t.recDescAddDocumentation,
      };
  }
}

export function ComplexityInsights({
  t,
  lang,
  complexity,
}: ComplexityInsightsProps) {
  const [activeFilter, setActiveFilter] = useState<ComplexityFilter>('all');

  const tier = getComplexityTier(complexity.score, t);

  const filteredRecommendations = useMemo(() => {
    return complexity.recommendations.filter((rec) => {
      if (activeFilter === 'critical-high') {
        return rec.severity === 'critical' || rec.severity === 'high';
      }
      if (activeFilter === 'nesting') {
        return rec.maxNesting >= 4;
      }
      if (activeFilter === 'large') {
        return rec.codeLines >= 350 || rec.sizeBytes >= 40 * 1024;
      }
      return true;
    });
  }, [complexity.recommendations, activeFilter]);

  return (
    <section id="complexity" className="border-t border-slate-800/80 pt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            {t.complexitySectionTitle}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {t.complexitySectionSubtitle}
          </p>
        </div>

        {complexity.recommendations.length > 0 && (
          <div
            role="group"
            aria-label={t.complexitySectionTitle}
            className="inline-flex self-start sm:self-auto flex-wrap items-center rounded-lg border border-slate-800 bg-[#111827] p-1 shrink-0"
          >
            {(
              [
                { id: 'all', label: t.complexityFilterAll },
                { id: 'critical-high', label: t.complexityFilterCriticalHigh },
                { id: 'nesting', label: t.complexityFilterNesting },
                { id: 'large', label: t.complexityFilterLarge },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                aria-pressed={activeFilter === tab.id}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeFilter === tab.id
                    ? 'bg-sky-500/20 text-sky-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 4-Column Complexity KPI Strip */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800/80 bg-[#111827] p-5">
          <KpiCardHeader
            label={t.complexityScoreLabel}
            tooltip={t.kpiTooltipComplexityScore}
          />
          <div className="mt-1.5 flex items-baseline gap-2 font-mono text-2xl font-bold text-slate-50 tabular-nums">
            <span>{formatNumber(complexity.score, lang)}</span>
            <span className="text-sm font-normal text-slate-400">/ 100</span>
          </div>
          <div className={`mt-1 text-xs font-medium ${tier.colorClass}`}>
            {tier.label}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-[#111827] p-5">
          <KpiCardHeader
            label={t.complexityAvgLabel}
            tooltip={t.kpiTooltipComplexityAvg}
          />
          <div
            dir="ltr"
            className="mt-1.5 font-mono text-2xl font-bold text-slate-50 tabular-nums"
          >
            {formatMessage(t.complexityMetricValue, {
              value: formatNumber(complexity.avgComplexity, lang),
            })}
          </div>
          <div className="mt-1 text-xs text-slate-400 tabular-nums">
            {formatMessage(t.complexityAvgSub, {
              files: formatNumber(complexity.logicFilesCount, lang),
              depth: formatNumber(complexity.avgNestingDepth, lang),
            })}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-[#111827] p-5">
          <KpiCardHeader
            label={t.complexityPeakLabel}
            tooltip={t.kpiTooltipComplexityPeak}
            align="end"
          />
          <div
            dir="ltr"
            className="mt-1.5 font-mono text-2xl font-bold text-slate-50 tabular-nums"
          >
            {formatMessage(t.complexityMetricValue, {
              value: formatNumber(complexity.maxComplexity, lang),
            })}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {t.complexityPeakSub}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-[#111827] p-5">
          <KpiCardHeader
            label={t.complexityFlaggedLabel}
            tooltip={t.kpiTooltipComplexityFlagged}
            align="end"
          />
          <div className="mt-1.5 font-mono text-2xl font-bold text-slate-50 tabular-nums">
            {formatNumber(complexity.highComplexityFilesCount, lang)}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {t.complexityFlaggedSub}
          </div>
        </div>
      </div>

      {/* High-Complexity Files & Refactoring Recommendations List */}
      <div className="mt-6 rounded-xl border border-slate-800/80 bg-[#111827]">
        {complexity.recommendations.length === 0 ? (
          <div className="p-6 text-center">
            <div className="text-sm font-semibold text-emerald-400">
              {t.complexityCleanTitle}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {t.complexityCleanDesc}
            </p>
          </div>
        ) : filteredRecommendations.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400">
            {t.complexityNoMatchFilter}
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {filteredRecommendations.map((rec) => {
              const severity = getSeverityDisplay(rec.severity, t);
              return (
                <div key={rec.path} className="p-5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-xs"
                        style={{ backgroundColor: rec.color }}
                      />
                      <span
                        dir="ltr"
                        title={rec.path}
                        className="truncate font-mono text-sm font-semibold text-slate-100"
                      >
                        {rec.path}
                      </span>
                    </div>

                    {/* Unboxed inline metadata strip */}
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs tabular-nums shrink-0">
                      <span className={`font-semibold ${severity.colorClass}`}>
                        {severity.label}
                      </span>
                      <span className="text-slate-600" aria-hidden="true">
                        ·
                      </span>
                      <span dir="ltr" className="font-mono font-semibold text-slate-200">
                        {formatMessage(t.complexityMetricValue, {
                          value: formatNumber(rec.complexity, lang),
                        })}
                      </span>
                      <span className="text-slate-600" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-mono text-slate-300">
                        {formatMessage(t.complexityDepthLabel, {
                          depth: formatNumber(rec.maxNesting, lang),
                        })}
                      </span>
                      <span className="text-slate-600" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-mono text-slate-400">
                        {formatMessage(t.complexityFunctionsLabel, {
                          count: formatNumber(rec.functionCount, lang),
                        })}
                      </span>
                      <span className="text-slate-600" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-mono text-slate-400">
                        {formatNumber(rec.codeLines, lang)} {t.colCodeLines}
                      </span>
                      <span className="text-slate-600" aria-hidden="true">
                        ·
                      </span>
                      <span className="font-mono text-slate-400">
                        {formatBytes(rec.sizeBytes)}
                      </span>
                    </div>
                  </div>

                  {/* Actionable Refactoring Guidance */}
                  <ul className="mt-3.5 grid grid-cols-1 gap-2.5 md:grid-cols-2 lg:grid-cols-3">
                    {rec.categories.map((cat) => {
                      const copy = formatCategoryCopy(cat, rec, t, lang);
                      return (
                        <li
                          key={cat}
                          className="border-t border-slate-800/70 pt-2.5 text-xs"
                        >
                          <div className="font-semibold text-sky-300">
                            {copy.title}
                          </div>
                          <p className="mt-1 leading-relaxed text-slate-400">
                            {copy.description}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
