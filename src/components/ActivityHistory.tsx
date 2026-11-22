import { Activity, Clock, GitPullRequest } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMessage, formatNumber, type Translations } from '../lib/i18n.ts';
import type { AppLanguage, RepoMetadata } from '../lib/types.ts';

interface ActivityHistoryProps {
  t: Translations;
  lang: AppLanguage;
  repository: RepoMetadata;
}

export function formatRelativeDate(
  isoDate: string | null,
  lang: AppLanguage
): { relative: string; exact: string } | null {
  if (!isoDate) return null;
  const ms = Date.parse(isoDate);
  if (!Number.isFinite(ms)) return null;

  const diffSec = Math.round((ms - Date.now()) / 1000);
  const absSec = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    numeric: 'auto',
  });

  let relative: string;
  if (absSec < 60) {
    relative = rtf.format(diffSec, 'second');
  } else if (absSec < 3600) {
    relative = rtf.format(Math.round(diffSec / 60), 'minute');
  } else if (absSec < 86400) {
    relative = rtf.format(Math.round(diffSec / 3600), 'hour');
  } else if (absSec < 86400 * 30) {
    relative = rtf.format(Math.round(diffSec / 86400), 'day');
  } else if (absSec < 86400 * 365) {
    relative = rtf.format(Math.round(diffSec / (86400 * 30)), 'month');
  } else {
    relative = rtf.format(Math.round(diffSec / (86400 * 365)), 'year');
  }

  const exact = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(ms));

  return { relative, exact };
}

export function ActivityHistory({ t, lang, repository }: ActivityHistoryProps) {
  const updatedInfo = formatRelativeDate(
    repository.pushedAt ?? repository.updatedAt,
    lang
  );
  const lastCommitInfo = formatRelativeDate(
    repository.activity?.lastCommitAt ?? null,
    lang
  );
  const weeklyBuckets = repository.activity?.weeklyBuckets ?? [];
  const hasWeeklyBuckets = weeklyBuckets.length > 0;
  const lastFourWeeks = weeklyBuckets.slice(-4);
  const fourWeekAvg =
    lastFourWeeks.length > 0
      ? Number(
          (
            lastFourWeeks.reduce((sum, item) => sum + item.commits, 0) /
            lastFourWeeks.length
          ).toFixed(1)
        )
      : 0;

  return (
    <div className="mt-4 rounded-xl border border-slate-800/80 bg-[#111827] p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-100">
            {t.activitySectionTitle}
          </h3>
          <p className="mt-0.5 text-xs text-slate-400">
            {t.activitySectionSubtitle}
          </p>
        </div>

        {lastCommitInfo && (
          <div className="text-xs text-slate-400 tabular-nums">
            <span>{t.lastCommitLabel}: </span>
            <span className="text-slate-200">{lastCommitInfo.exact}</span>
          </div>
        )}
      </div>

      {/* 3 Activity Metric Columns */}
      <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-800/80 pt-4 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <Clock className="h-3.5 w-3.5 text-sky-400 shrink-0" aria-hidden="true" />
            <span>{t.lastUpdatedLabel}</span>
          </div>
          <div className="mt-1.5 text-base font-semibold text-slate-100">
            {updatedInfo ? updatedInfo.relative : t.unavailableLabel}
          </div>
          {updatedInfo && (
            <div className="mt-0.5 text-xs text-slate-400 tabular-nums">
              {updatedInfo.exact}
            </div>
          )}
        </div>

        <div className="border-t border-slate-800/80 pt-3 sm:border-t-0 sm:pt-0 sm:border-s sm:ps-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <GitPullRequest className="h-3.5 w-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
            <span>{t.openPrsLabel}</span>
          </div>
          <div className="mt-1.5 font-mono text-xl font-bold text-slate-100 tabular-nums">
            {typeof repository.openPullRequests === 'number'
              ? formatNumber(repository.openPullRequests, lang)
              : t.unavailableLabel}
          </div>
          <div className="mt-0.5 text-xs text-slate-400">
            {repository.fullName}
          </div>
        </div>

        <div className="border-t border-slate-800/80 pt-3 sm:border-t-0 sm:pt-0 sm:border-s sm:ps-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
            <Activity className="h-3.5 w-3.5 text-sky-400 shrink-0" aria-hidden="true" />
            <span>{t.commitFrequencyLabel}</span>
          </div>
          <div className="mt-1.5 font-mono text-xl font-bold text-slate-100 tabular-nums">
            {repository.activity
              ? formatMessage(t.commitsPerWeekUnit, {
                  count: repository.activity.commitsPerWeek,
                })
              : t.unavailableLabel}
          </div>
          {repository.activity && (
            <div className="mt-0.5 text-xs text-slate-400 tabular-nums">
              {formatMessage(t.commitsLast30DaysSub, {
                count: `${formatNumber(repository.activity.commitsLast30Days, lang)}${
                  repository.activity.commitsLast30DaysCapped ? '+' : ''
                }`,
              })}
            </div>
          )}
        </div>
      </div>

      {/* Activity Charts Row: 4-Week Line Trend + 8-Week Commit Cadence */}
      {hasWeeklyBuckets && (
        <div className="mt-5 grid grid-cols-1 gap-6 border-t border-slate-800/80 pt-5 lg:grid-cols-2">
          {/* Weekly Activity Trend (Last 4 Weeks Line Chart) */}
          <div>
            <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-slate-200">
                  {t.weeklyTrendChartTitle}
                </div>
                <div className="text-[11px] text-slate-400">
                  {t.weeklyTrendChartSubtitle}
                </div>
              </div>
              <div className="font-mono text-[11px] text-emerald-400 tabular-nums">
                {formatMessage(t.fourWeekAvgLabel, {
                  count: fourWeekAvg,
                })}
              </div>
            </div>

            <div dir="ltr" className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={lastFourWeeks}
                  margin={{ top: 8, right: 12, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1E293B"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#64748B', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ stroke: '#334155', strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) {
                        return null;
                      }
                      const bucket = payload[0].payload as {
                        label: string;
                        commits: number;
                      };
                      return (
                        <div className="rounded-md border border-slate-700 bg-[#0B0F17] px-2.5 py-1.5 text-xs text-slate-100 shadow-lg tabular-nums">
                          <span className="font-mono text-slate-400">
                            {bucket.label}:{' '}
                          </span>
                          <span className="font-mono font-semibold text-emerald-400">
                            {formatNumber(bucket.commits, lang)} {t.commitsUnitLabel}
                          </span>
                        </div>
                      );
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="commits"
                    stroke="#10B981"
                    strokeWidth={2.25}
                    dot={{
                      r: 3.5,
                      fill: '#10B981',
                      stroke: '#0B0F17',
                      strokeWidth: 1.5,
                    }}
                    activeDot={{
                      r: 5,
                      fill: '#34D399',
                      stroke: '#0B0F17',
                      strokeWidth: 2,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 8-Week Commit Cadence Bar Chart */}
          <div className="border-t border-slate-800/80 pt-4 lg:border-t-0 lg:border-s lg:ps-6 lg:pt-0">
            <div className="mb-2.5">
              <div className="text-xs font-semibold text-slate-200">
                {t.weeklyCommitsChartTitle}
              </div>
            </div>
            <div dir="ltr" className="h-36 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={weeklyBuckets}
                  margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1E293B"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#94A3B8', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: '#64748B', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                    content={({ active, payload }) => {
                      if (!active || !payload || payload.length === 0) {
                        return null;
                      }
                      const bucket = payload[0].payload as {
                        label: string;
                        commits: number;
                      };
                      return (
                        <div className="rounded-md border border-slate-700 bg-[#0B0F17] px-2.5 py-1.5 text-xs text-slate-100 shadow-lg tabular-nums">
                          <span className="font-mono text-slate-400">
                            {bucket.label}:{' '}
                          </span>
                          <span className="font-mono font-semibold text-sky-400">
                            {formatNumber(bucket.commits, lang)} {t.commitsUnitLabel}
                          </span>
                        </div>
                      );
                    }}
                  />
                  <Bar
                    dataKey="commits"
                    fill="#38BDF8"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
