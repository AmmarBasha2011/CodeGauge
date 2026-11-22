import { Languages } from 'lucide-react';
import type { AnalysisResult, AppLanguage, CodeHealthMetrics } from '../lib/types.ts';
import type { Translations } from '../lib/i18n.ts';
import { CodeHealthGauge } from './CodeHealthGauge.tsx';
import { SocialShareMenu } from './SocialShareMenu.tsx';

interface HeaderProps {
  t: Translations;
  lang: AppLanguage;
  onToggleLang: () => void;
  hasResult: boolean;
  hasComparison: boolean;
  health?: CodeHealthMetrics | null;
  shareResult?: AnalysisResult | null;
  compareResult?: AnalysisResult | null;
}

export function Header({
  t,
  lang,
  onToggleLang,
  hasResult,
  hasComparison,
  health,
  shareResult,
  compareResult,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-[#0B0F17]/95 backdrop-blur-sm">
      <div className="relative sm:static mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-2 px-4 sm:gap-6 sm:px-6 lg:px-8">
        {/* Zone 1: Single-element wordmark */}
        <a
          href="#top"
          className="text-lg font-bold tracking-tight text-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-sm"
        >
          {t.brand}
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Primary"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400"
        >
          {hasResult ? (
            <>
              <a
                href="#overview"
                className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-slate-500"
              >
                {t.navOverview}
              </a>
              {hasComparison && (
                <a
                  href="#comparison"
                  className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-slate-500"
                >
                  {t.navComparison}
                </a>
              )}
              <a
                href="#languages"
                className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-slate-500"
              >
                {t.navLanguages}
              </a>
              <a
                href="#files"
                className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-slate-500"
              >
                {t.navFiles}
              </a>
            </>
          ) : (
            <a
              href="#capabilities"
              className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 py-1 border-b border-transparent hover:border-slate-500"
            >
              {t.navOverview}
            </a>
          )}
        </nav>

        {/* Zone 3: Code Health Gauge + Social Share + Language Switcher */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {health && <CodeHealthGauge t={t} lang={lang} health={health} />}

          {shareResult && (
            <SocialShareMenu
              t={t}
              lang={lang}
              result={shareResult}
              compareResult={compareResult}
            />
          )}

          <button
            type="button"
            onClick={onToggleLang}
            aria-label={
              lang === 'en'
                ? 'Switch language to Arabic'
                : 'التبديل إلى اللغة الإنجليزية'
            }
            className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900 px-3 sm:px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            <Languages className="h-3.5 w-3.5 text-sky-400 shrink-0" aria-hidden="true" />
            <span>{t.switchLangLabel}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
