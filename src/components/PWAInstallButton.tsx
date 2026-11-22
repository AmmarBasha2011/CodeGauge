import { Download, Share, X } from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';
import type { Translations } from '../lib/i18n.ts';

interface PWAInstallButtonProps {
  t: Translations;
}

export function PWAInstallButton({ t }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-300 hover:bg-sky-500/20 hover:border-sky-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{t.pwaInstallButton}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
        >
          <Download className="h-3.5 w-3.5 text-sky-400 shrink-0" aria-hidden="true" />
          <span>{t.pwaInstallIosButton}</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
          >
            <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-[#111827] p-6 text-slate-100">
              <div className="flex items-start justify-between gap-3">
                <h3 id="ios-install-title" className="text-base font-semibold">
                  {t.pwaIosModalTitle}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label={t.pwaCloseModal}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-100 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <ol className="mt-4 space-y-2.5 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="font-mono text-xs text-sky-400 mt-0.5">1.</span>
                  <span>
                    {t.pwaIosStep1}{' '}
                    <Share
                      className="inline h-3.5 w-3.5 text-sky-400 mx-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-mono text-xs text-sky-400 mt-0.5">2.</span>
                  <span>{t.pwaIosStep2}</span>
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 h-10 w-full rounded-lg bg-sky-500 text-sm font-semibold text-slate-950 hover:bg-sky-400 transition-colors cursor-pointer"
              >
                {t.pwaCloseModal}
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
