import { useMemo, useState } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMessage, formatNumber, type Translations } from '../lib/i18n.ts';
import { formatBytes } from '../lib/languageMap.ts';
import type {
  AppLanguage,
  HistoricalLanguageSnapshot,
  LanguageAdoptionMonth,
  LanguageAdoptionTrend,
  LanguageStat,
} from '../lib/types.ts';

interface LanguageBreakdownProps {
  t: Translations;
  lang: AppLanguage;
  languages: LanguageStat[];
  totalLines: number;
  selectedLanguage: string;
  onSelectLanguage: (languageName: string) => void;
  languageHistory?: HistoricalLanguageSnapshot | null;
  languageAdoption?: LanguageAdoptionTrend | null;
}

interface BarTooltipPayloadItem {
  payload: LanguageStat;
}

interface GrowthRow {
  name: string;
  color: string;
  prevCodeLines: number;
  currCodeLines: number;
  diffCodeLines: number;
  prevPct: number;
  currPct: number;
  diffPct: number;
}

function formatCompactAxis(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

function formatSnapshotDate(iso: string, lang: AppLanguage): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso.slice(0, 10);
  }
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatMonthLabel(timestamp: string, monthKey: string, lang: AppLanguage): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return monthKey;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(date);
}

export function LanguageBreakdown({
  t,
  lang,
  languages,
  totalLines,
  selectedLanguage,
  onSelectLanguage,
  languageHistory,
  languageAdoption,
}: LanguageBreakdownProps) {
  const [hoveredLang, setHoveredLang] = useState<string | null>(null);
  const [barMetric, setBarMetric] = useState<'codeLines' | 'lines'>('codeLines');
  const [growthMetric, setGrowthMetric] = useState<'codeLines' | 'percentage'>(
    'codeLines'
  );
  const [adoptionMetric, setAdoptionMetric] = useState<
    'codeLines' | 'percentage' | 'files'
  >('codeLines');

  const chartSegments = useMemo(() => {
    const top = languages.slice(0, 8);
    const others = languages.slice(8);
    const combined = [...top];

    if (others.length > 0) {
      const otherLines = others.reduce((acc, item) => acc + item.lines, 0);
      const otherPct =
        totalLines > 0 ? Number(((otherLines / totalLines) * 100).toFixed(2)) : 0;
      combined.push({
        name: lang === 'ar' ? 'أخرى' : 'Other',
        color: '#475569',
        lines: otherLines,
        codeLines: others.reduce((acc, item) => acc + item.codeLines, 0),
        blankLines: others.reduce((acc, item) => acc + item.blankLines, 0),
        files: others.reduce((acc, item) => acc + item.files, 0),
        sizeBytes: others.reduce((acc, item) => acc + item.sizeBytes, 0),
        percentage: otherPct,
      });
    }

    const radius = 68;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    return combined.map((seg) => {
      const ratio = totalLines > 0 ? seg.lines / totalLines : 0;
      const strokeLength = ratio * circumference;
      const currentOffset = offset;
      offset += strokeLength;
      return {
        ...seg,
        radius,
        circumference,
        strokeLength,
        strokeDashoffset: -currentOffset,
      };
    });
  }, [languages, totalLines, lang]);

  const barChartData = useMemo(() => languages.slice(0, 12), [languages]);

  const top5GrowthData = useMemo<GrowthRow[]>(() => {
    if (!languageHistory || languageHistory.languages.length === 0) return [];
    const prevMap = new Map(
      languageHistory.languages.map((item) => [item.name, item])
    );

    return languages.slice(0, 5).map((curr) => {
      const prev = prevMap.get(curr.name);
      const prevCodeLines = prev?.codeLines ?? 0;
      const prevPct = prev?.percentage ?? 0;
      return {
        name: curr.name,
        color: curr.color,
        prevCodeLines,
        currCodeLines: curr.codeLines,
        diffCodeLines: curr.codeLines - prevCodeLines,
        prevPct: Number(prevPct.toFixed(1)),
        currPct: Number(curr.percentage.toFixed(1)),
        diffPct: Number((curr.percentage - prevPct).toFixed(1)),
      };
    });
  }, [languages, languageHistory]);

  const adoptionChartData = useMemo(() => {
    if (!languageAdoption || languageAdoption.months.length === 0) return [];
    return languageAdoption.months.map((month) => {
      const row: Record<string, string | number | LanguageAdoptionMonth> = {
        monthKey: month.monthKey,
        label: formatMonthLabel(month.timestamp, month.monthKey, lang),
        __rawMonth: month,
      };
      for (const topLang of languageAdoption.topLanguages) {
        const pt = month.languages[topLang.name];
        if (adoptionMetric === 'percentage') {
          row[topLang.name] = Number((pt?.percentage ?? 0).toFixed(2));
        } else if (adoptionMetric === 'files') {
          row[topLang.name] = pt?.files ?? 0;
        } else {
          row[topLang.name] = pt?.codeLines ?? 0;
        }
      }
      return row;
    });
  }, [languageAdoption, adoptionMetric, lang]);

  const activeHoverStat = useMemo(() => {
    const targetName =
      hoveredLang || (selectedLanguage !== 'ALL' ? selectedLanguage : null);
    if (!targetName) return null;
    return languages.find((item) => item.name === targetName) ?? null;
  }, [hoveredLang, selectedLanguage, languages]);

  return (
    <section id="languages" className="border-t border-slate-800/80 pt-8">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">
            {t.sectionLanguagesTitle}
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            {t.sectionLanguagesSubtitle}
          </p>
        </div>

        {selectedLanguage !== 'ALL' && (
          <button
            type="button"
            onClick={() => onSelectLanguage('ALL')}
            className="self-start sm:self-auto text-xs font-medium text-sky-400 hover:text-sky-300 underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {t.allLanguagesOption}
          </button>
        )}
      </div>

      {/* Stacked proportion bar */}
      {totalLines > 0 && (
        <div
          className="mt-5 flex h-3 w-full overflow-hidden rounded-full bg-slate-800/90"
          role="img"
          aria-label={t.sectionLanguagesTitle}
        >
          {languages.map((item) => {
            const widthPct = (item.lines / totalLines) * 100;
            if (widthPct < 0.25) return null;
            const isDimmed =
              (selectedLanguage !== 'ALL' && selectedLanguage !== item.name) ||
              (hoveredLang !== null && hoveredLang !== item.name);
            return (
              <button
                key={item.name}
                type="button"
                title={`${item.name}: ${item.percentage}% (${formatNumber(item.lines, lang)})`}
                onClick={() =>
                  onSelectLanguage(
                    selectedLanguage === item.name ? 'ALL' : item.name
                  )
                }
                onMouseEnter={() => setHoveredLang(item.name)}
                onMouseLeave={() => setHoveredLang(null)}
                className="h-full transition-opacity duration-150 cursor-pointer focus:outline-none"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: item.color,
                  opacity: isDimmed ? 0.3 : 1,
                }}
              />
            );
          })}
        </div>
      )}

      {/* Recharts Bar Chart: Distribution of code lines per language */}
      {barChartData.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-800/80 bg-[#111827] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                {t.barChartTitle}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {t.barChartSubtitle}
              </p>
            </div>

            <div className="inline-flex items-center self-start sm:self-auto rounded-lg border border-slate-800 bg-[#0B0F17] p-1">
              <button
                type="button"
                onClick={() => setBarMetric('codeLines')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  barMetric === 'codeLines'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.colCodeLines}
              </button>
              <button
                type="button"
                onClick={() => setBarMetric('lines')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  barMetric === 'lines'
                    ? 'bg-slate-800 text-slate-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.colLines}
              </button>
            </div>
          </div>

          <div dir="ltr" className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barChartData}
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
                  angle={barChartData.length > 6 ? -22 : 0}
                  textAnchor={barChartData.length > 6 ? 'end' : 'middle'}
                  height={barChartData.length > 6 ? 52 : 30}
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
                    const item = (payload[0] as unknown as BarTooltipPayloadItem)
                      .payload;
                    return (
                      <div
                        dir={lang === 'ar' ? 'rtl' : 'ltr'}
                        className="rounded-lg border border-slate-700 bg-[#0B0F17] px-3.5 py-2.5 text-xs shadow-lg"
                      >
                        <div className="flex items-center gap-2 font-semibold text-slate-100">
                          <span
                            className="h-2.5 w-2.5 rounded-xs shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span>{item.name}</span>
                        </div>
                        <div className="mt-2 space-y-1 text-slate-300 tabular-nums">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-400">{t.colCodeLines}:</span>
                            <span className="font-mono font-semibold text-slate-100">
                              {formatNumber(item.codeLines, lang)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-400">{t.colLines}:</span>
                            <span className="font-mono text-slate-200">
                              {formatNumber(item.lines, lang)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-400">{t.colFiles}:</span>
                            <span className="font-mono text-slate-200">
                              {formatNumber(item.files, lang)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-400">{t.colShare}:</span>
                            <span className="font-mono text-sky-400">
                              {item.percentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar
                  dataKey={barMetric}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={48}
                  className="cursor-pointer"
                  onClick={(entry) => {
                    const name = (entry as unknown as LanguageStat)?.name;
                    if (name) {
                      onSelectLanguage(selectedLanguage === name ? 'ALL' : name);
                    }
                  }}
                >
                  {barChartData.map((entry) => {
                    const isDimmed =
                      (selectedLanguage !== 'ALL' &&
                        selectedLanguage !== entry.name) ||
                      (hoveredLang !== null && hoveredLang !== entry.name);
                    return (
                      <Cell
                        key={entry.name}
                        fill={entry.color}
                        fillOpacity={isDimmed ? 0.35 : 0.92}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recharts Top 5 Languages Growth Chart (Current vs 1 Month Ago) */}
      {languageHistory && top5GrowthData.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-800/80 bg-[#111827] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                {t.langGrowthTitle}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {formatMessage(t.langGrowthSubtitle, {
                  date: formatSnapshotDate(languageHistory.snapshotDate, lang),
                })}
              </p>
            </div>

            <div
              role="group"
              aria-label={t.langGrowthTitle}
              className="inline-flex items-center self-start sm:self-auto rounded-lg border border-slate-800 bg-[#0B0F17] p-1 shrink-0"
            >
              <button
                type="button"
                onClick={() => setGrowthMetric('codeLines')}
                aria-pressed={growthMetric === 'codeLines'}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  growthMetric === 'codeLines'
                    ? 'bg-sky-500/20 text-sky-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.langGrowthMetricLines}
              </button>
              <button
                type="button"
                onClick={() => setGrowthMetric('percentage')}
                aria-pressed={growthMetric === 'percentage'}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  growthMetric === 'percentage'
                    ? 'bg-sky-500/20 text-sky-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.langGrowthMetricShare}
              </button>
            </div>
          </div>

          <div dir="ltr" className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={top5GrowthData}
                margin={{ top: 12, right: 12, left: 4, bottom: 8 }}
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
                  tickFormatter={(val: string) =>
                    val.length > 14 ? `${val.slice(0, 13)}…` : val
                  }
                />
                <YAxis
                  tick={{ fill: '#94A3B8', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  domain={growthMetric === 'percentage' ? [0, 'auto'] : [0, 'auto']}
                  tickFormatter={(val: number) =>
                    growthMetric === 'percentage'
                      ? `${val}%`
                      : formatCompactAxis(val)
                  }
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                  content={({ active, payload }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    const row = payload[0].payload as GrowthRow;
                    const prevDisplay =
                      growthMetric === 'percentage'
                        ? `${row.prevPct.toFixed(1)}%`
                        : formatNumber(row.prevCodeLines, lang);
                    const currDisplay =
                      growthMetric === 'percentage'
                        ? `${row.currPct.toFixed(1)}%`
                        : formatNumber(row.currCodeLines, lang);
                    const diffVal =
                      growthMetric === 'percentage' ? row.diffPct : row.diffCodeLines;
                    const diffText =
                      diffVal === 0
                        ? t.langGrowthNoChange
                        : growthMetric === 'percentage'
                          ? `${diffVal > 0 ? '+' : ''}${diffVal.toFixed(1)}%`
                          : `${diffVal > 0 ? '+' : '-'}${formatNumber(
                              Math.abs(diffVal),
                              lang
                            )}`;
                    const diffColor =
                      diffVal > 0
                        ? 'text-emerald-400'
                        : diffVal < 0
                          ? 'text-rose-400'
                          : 'text-slate-400';

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
                            <span className="text-slate-400">
                              {t.langGrowthLegendPrevious}:
                            </span>
                            <span className="font-mono text-slate-300">
                              {prevDisplay}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sky-400">
                              {t.langGrowthLegendCurrent}:
                            </span>
                            <span className="font-mono font-semibold text-slate-100">
                              {currDisplay}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4 border-t border-slate-800 pt-1">
                            <span className="text-slate-400">Δ:</span>
                            <span
                              dir="ltr"
                              className={`font-mono font-semibold ${diffColor}`}
                            >
                              {diffText}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '6px' }} />
                <Bar
                  dataKey={
                    growthMetric === 'percentage' ? 'prevPct' : 'prevCodeLines'
                  }
                  name={t.langGrowthLegendPrevious}
                  fill="#64748B"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
                <Bar
                  dataKey={
                    growthMetric === 'percentage' ? 'currPct' : 'currCodeLines'
                  }
                  name={t.langGrowthLegendCurrent}
                  fill="#38BDF8"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 5-Language Delta Strip (single-elevation divider layout, no nested cards) */}
          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-800/80 pt-4 sm:grid-cols-2 lg:grid-cols-5">
            {top5GrowthData.map((row) => {
              const diffVal =
                growthMetric === 'percentage' ? row.diffPct : row.diffCodeLines;
              const diffLabel =
                diffVal === 0
                  ? t.langGrowthNoChange
                  : growthMetric === 'percentage'
                    ? `${diffVal > 0 ? '+' : ''}${diffVal.toFixed(1)}%`
                    : `${diffVal > 0 ? '+' : '-'}${formatNumber(
                        Math.abs(diffVal),
                        lang
                      )}`;
              const diffTone =
                diffVal > 0
                  ? 'text-emerald-400'
                  : diffVal < 0
                    ? 'text-rose-400'
                    : 'text-slate-400';

              return (
                <div
                  key={row.name}
                  className="flex items-center justify-between gap-2 border-b border-slate-800/60 pb-2 last:border-b-0 lg:flex-col lg:items-start lg:border-b-0 lg:border-e lg:pb-0 lg:pe-3 lg:last:border-e-0 lg:last:pe-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-xs"
                      style={{ backgroundColor: row.color }}
                    />
                    <span className="truncate text-xs font-medium text-slate-200">
                      {row.name}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 tabular-nums">
                    <span
                      dir="ltr"
                      className={`font-mono text-xs font-semibold ${diffTone}`}
                    >
                      {diffLabel}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {growthMetric === 'percentage'
                        ? `${row.prevPct.toFixed(1)}% → ${row.currPct.toFixed(1)}%`
                        : `${formatCompactAxis(row.prevCodeLines)} → ${formatCompactAxis(
                            row.currCodeLines
                          )}`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recharts 12-Month Language Adoption Trend Line Chart */}
      {languageAdoption &&
        languageAdoption.topLanguages.length > 0 &&
        adoptionChartData.length > 0 && (
          <div className="mt-6 rounded-xl border border-slate-800/80 bg-[#111827] p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  {t.adoptionTrendTitle}
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  {t.adoptionTrendSubtitle}
                </p>
              </div>

              <div
                role="group"
                aria-label={t.adoptionTrendTitle}
                className="inline-flex items-center self-start sm:self-auto rounded-lg border border-slate-800 bg-[#0B0F17] p-1 shrink-0"
              >
                <button
                  type="button"
                  onClick={() => setAdoptionMetric('codeLines')}
                  aria-pressed={adoptionMetric === 'codeLines'}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    adoptionMetric === 'codeLines'
                      ? 'bg-sky-500/20 text-sky-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.langGrowthMetricLines}
                </button>
                <button
                  type="button"
                  onClick={() => setAdoptionMetric('percentage')}
                  aria-pressed={adoptionMetric === 'percentage'}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    adoptionMetric === 'percentage'
                      ? 'bg-sky-500/20 text-sky-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.langGrowthMetricShare}
                </button>
                <button
                  type="button"
                  onClick={() => setAdoptionMetric('files')}
                  aria-pressed={adoptionMetric === 'files'}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    adoptionMetric === 'files'
                      ? 'bg-sky-500/20 text-sky-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.colFiles}
                </button>
              </div>
            </div>

            <div dir="ltr" className="mt-4 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={adoptionChartData}
                  margin={{ top: 12, right: 16, left: 4, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1E293B"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                    axisLine={{ stroke: '#334155' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                    domain={[0, 'auto']}
                    tickFormatter={(val: number) =>
                      adoptionMetric === 'percentage'
                        ? `${val}%`
                        : formatCompactAxis(val)
                    }
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) return null;
                      const firstRow = payload[0].payload as {
                        label: string;
                        __rawMonth: LanguageAdoptionMonth;
                      };
                      const rawMonth = firstRow.__rawMonth;
                      return (
                        <div
                          dir={lang === 'ar' ? 'rtl' : 'ltr'}
                          className="rounded-lg border border-slate-700 bg-[#0B0F17] px-3.5 py-2.5 text-xs shadow-lg"
                        >
                          <div className="mb-2 font-semibold text-slate-100">
                            {firstRow.label}
                          </div>
                          <div className="space-y-1.5 tabular-nums">
                            {languageAdoption.topLanguages.map((topLang) => {
                              const pt = rawMonth.languages[topLang.name];
                              const displayVal =
                                adoptionMetric === 'percentage'
                                  ? `${(pt?.percentage ?? 0).toFixed(1)}%`
                                  : adoptionMetric === 'files'
                                    ? formatNumber(pt?.files ?? 0, lang)
                                    : formatNumber(pt?.codeLines ?? 0, lang);
                              const newFiles = pt?.newFiles ?? 0;

                              return (
                                <div
                                  key={topLang.name}
                                  className="flex items-center justify-between gap-4"
                                >
                                  <span className="flex items-center gap-1.5 text-slate-300">
                                    <span
                                      className="h-2 w-2 rounded-xs shrink-0"
                                      style={{ backgroundColor: topLang.color }}
                                    />
                                    <span>{topLang.name}</span>
                                  </span>
                                  <span className="flex items-center gap-2 font-mono">
                                    <span className="font-semibold text-slate-100">
                                      {displayVal}
                                    </span>
                                    {newFiles > 0 && (
                                      <span className="text-[11px] text-emerald-400">
                                        {formatMessage(t.adoptionNewFilesMonth, {
                                          count: formatNumber(newFiles, lang),
                                        })}
                                      </span>
                                    )}
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
                  {languageAdoption.topLanguages.map((topLang) => (
                    <Line
                      key={topLang.name}
                      type="monotone"
                      dataKey={topLang.name}
                      name={topLang.name}
                      stroke={topLang.color}
                      strokeWidth={2.25}
                      dot={{ r: 3, strokeWidth: 1.5, fill: '#111827' }}
                      activeDot={{ r: 5 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 12-Month Per-Language Trend Summary Strip */}
            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-800/80 pt-4 sm:grid-cols-2 lg:grid-cols-5">
              {languageAdoption.summary.map((item) => {
                const TrendIcon =
                  item.trend === 'increasing'
                    ? TrendingUp
                    : item.trend === 'decreasing'
                      ? TrendingDown
                      : Minus;
                const trendLabel =
                  item.trend === 'increasing'
                    ? t.adoptionIncreasingLabel
                    : item.trend === 'decreasing'
                      ? t.adoptionDecreasingLabel
                      : t.adoptionStableLabel;
                const trendTone =
                  item.trend === 'increasing'
                    ? 'text-emerald-400'
                    : item.trend === 'decreasing'
                      ? 'text-rose-400'
                      : 'text-slate-400';

                const deltaVal =
                  adoptionMetric === 'percentage'
                    ? item.deltaPercentage
                    : adoptionMetric === 'files'
                      ? item.endFiles - item.startFiles
                      : item.deltaCodeLines;
                const deltaDisplay =
                  deltaVal === 0
                    ? t.adoptionNoChangeLabel
                    : adoptionMetric === 'percentage'
                      ? `${deltaVal > 0 ? '+' : ''}${deltaVal.toFixed(1)}%`
                      : `${deltaVal > 0 ? '+' : '-'}${formatNumber(
                          Math.abs(deltaVal),
                          lang
                        )}`;

                return (
                  <div
                    key={item.name}
                    className="flex flex-col gap-1.5 border-b border-slate-800/60 pb-2.5 last:border-b-0 lg:border-b-0 lg:border-e lg:pb-0 lg:pe-3 lg:last:border-e-0 lg:last:pe-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 min-w-0">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-xs"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="truncate text-xs font-medium text-slate-200">
                          {item.name}
                        </span>
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium shrink-0 ${trendTone}`}
                      >
                        <TrendIcon className="h-3.5 w-3.5 shrink-0" />
                        <span>{trendLabel}</span>
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between gap-2 tabular-nums">
                      <span
                        dir="ltr"
                        className={`font-mono text-xs font-semibold ${trendTone}`}
                      >
                        {deltaDisplay}
                      </span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {formatMessage(t.adoptionCreated12m, {
                          count: formatNumber(item.createdFiles12m, lang),
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      {/* Donut chart + High-density language breakdown table */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* Donut summary */}
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800/80 bg-[#111827] p-5 lg:col-span-4">
          <div className="relative flex h-44 w-44 items-center justify-center">
            <svg
              viewBox="0 0 180 180"
              className="h-full w-full -rotate-90"
              aria-hidden="true"
            >
              <circle
                cx="90"
                cy="90"
                r="68"
                fill="none"
                stroke="#1E293B"
                strokeWidth="16"
              />
              {chartSegments.map((seg) => {
                const isDimmed =
                  (selectedLanguage !== 'ALL' &&
                    selectedLanguage !== seg.name) ||
                  (hoveredLang !== null && hoveredLang !== seg.name);
                return (
                  <circle
                    key={seg.name}
                    cx="90"
                    cy="90"
                    r={seg.radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="16"
                    strokeDasharray={`${seg.strokeLength} ${seg.circumference}`}
                    strokeDashoffset={seg.strokeDashoffset}
                    className="transition-opacity duration-150 cursor-pointer"
                    style={{ opacity: isDimmed ? 0.25 : 1 }}
                    onMouseEnter={() => setHoveredLang(seg.name)}
                    onMouseLeave={() => setHoveredLang(null)}
                    onClick={() => {
                      if (languages.some((l) => l.name === seg.name)) {
                        onSelectLanguage(
                          selectedLanguage === seg.name ? 'ALL' : seg.name
                        );
                      }
                    }}
                  />
                );
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-4">
              <span className="text-xs text-slate-400 truncate max-w-full">
                {activeHoverStat ? activeHoverStat.name : t.kpiTotalLines}
              </span>
              <span className="mt-0.5 font-mono text-lg font-bold text-slate-100 tabular-nums">
                {formatNumber(
                  activeHoverStat ? activeHoverStat.lines : totalLines,
                  lang
                )}
              </span>
              {activeHoverStat && (
                <span className="font-mono text-xs text-sky-400 tabular-nums">
                  {activeHoverStat.percentage}%
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 grid w-full grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-800/80 pt-4 text-xs">
            {languages.slice(0, 6).map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() =>
                  onSelectLanguage(
                    selectedLanguage === item.name ? 'ALL' : item.name
                  )
                }
                onMouseEnter={() => setHoveredLang(item.name)}
                onMouseLeave={() => setHoveredLang(null)}
                className="flex items-center justify-between gap-2 text-start py-0.5 hover:text-slate-100 text-slate-300 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-xs"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate">{item.name}</span>
                </span>
                <span className="font-mono text-slate-400 tabular-nums shrink-0">
                  {item.percentage}%
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Language Breakdown Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-[#111827] lg:col-span-8">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-medium text-slate-400">
                <th className="py-2.5 px-3 sm:px-4 text-start font-medium">
                  {t.colLanguage}
                </th>
                <th className="py-2.5 px-3 text-end font-medium">
                  {t.colFiles}
                </th>
                <th className="py-2.5 px-3 text-end font-medium">
                  {t.colLines}
                </th>
                <th className="hidden sm:table-cell py-2.5 px-3 text-end font-medium">
                  {t.colCodeLines}
                </th>
                <th className="py-2.5 px-3 text-end font-medium">
                  {t.colShare}
                </th>
                <th className="hidden md:table-cell py-2.5 px-4 text-end font-medium">
                  {t.colSize}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {languages.map((item) => {
                const isSelected = selectedLanguage === item.name;
                return (
                  <tr
                    key={item.name}
                    onClick={() =>
                      onSelectLanguage(isSelected ? 'ALL' : item.name)
                    }
                    onMouseEnter={() => setHoveredLang(item.name)}
                    onMouseLeave={() => setHoveredLang(null)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-sky-500/10 text-slate-100'
                        : 'hover:bg-slate-800/40 text-slate-200'
                    }`}
                  >
                    <td className="h-10 px-3 sm:px-4">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-xs"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-medium whitespace-nowrap">
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="h-10 px-3 text-end font-mono text-xs text-slate-300 tabular-nums">
                      {formatNumber(item.files, lang)}
                    </td>
                    <td className="h-10 px-3 text-end font-mono text-xs font-semibold text-slate-100 tabular-nums">
                      {formatNumber(item.lines, lang)}
                    </td>
                    <td className="hidden sm:table-cell h-10 px-3 text-end font-mono text-xs text-slate-400 tabular-nums">
                      {formatNumber(item.codeLines, lang)}
                    </td>
                    <td className="h-10 px-3 text-end font-mono text-xs text-sky-400 tabular-nums">
                      {item.percentage.toFixed(1)}%
                    </td>
                    <td className="hidden md:table-cell h-10 px-4 text-end font-mono text-xs text-slate-400 tabular-nums whitespace-nowrap">
                      {formatBytes(item.sizeBytes)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
