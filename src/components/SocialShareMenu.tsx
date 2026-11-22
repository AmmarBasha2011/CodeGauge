import { Check, Copy, Download, ExternalLink, Share2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { generateShareCardBlob } from '../lib/generateShareCard.ts';
import { resolveCodeHealth } from '../lib/health.ts';
import { formatNumber, type Translations } from '../lib/i18n.ts';
import type { AnalysisResult, AppLanguage } from '../lib/types.ts';

interface SocialShareMenuProps {
  t: Translations;
  lang: AppLanguage;
  result: AnalysisResult;
  compareResult?: AnalysisResult | null;
}

export function SocialShareMenu({
  t,
  lang,
  result,
  compareResult,
}: SocialShareMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [imageCopied, setImageCopied] = useState(false);
  const [cardBlob, setCardBlob] = useState<Blob | null>(null);
  const [cardPreviewUrl, setCardPreviewUrl] = useState<string | null>(null);
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('repo', result.repository.fullName);
    if (compareResult) {
      url.searchParams.set('compare', compareResult.repository.fullName);
    }
    return url.toString();
  }, [result.repository.fullName, compareResult]);

  const shareSummaryText = useMemo(() => {
    const health = resolveCodeHealth(result);
    const topLang = result.languages[0]?.name ?? '-';
    const totalLines = formatNumber(result.summary.totalLines, lang);
    const langCount = formatNumber(result.summary.languageCount, lang);
    return `${result.repository.fullName} — ${totalLines} lines across ${langCount} languages (Primary: ${topLang}, Code Health: ${health.score}/100) via ${t.brand}`;
  }, [result, lang, t.brand]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    let objectUrl: string | null = null;
    setIsGeneratingCard(true);

    generateShareCardBlob(result, t, lang)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setCardBlob(blob);
        setCardPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setCardBlob(null);
          setCardPreviewUrl(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsGeneratingCard(false);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [isOpen, result, t, lang]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Clipboard write unavailable
    }
  };

  const handleCopyImage = async () => {
    if (!cardBlob || typeof ClipboardItem === 'undefined') return;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': cardBlob }),
      ]);
      setImageCopied(true);
      setTimeout(() => setImageCopied(false), 2000);
    } catch {
      // Clipboard image write unsupported in some browsers
    }
  };

  const safeSlug = `${result.repository.owner}-${result.repository.name}`.replace(
    /[^a-zA-Z0-9._-]/g,
    '-'
  );

  const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    shareSummaryText
  )}&url=${encodeURIComponent(shareUrl)}`;
  const linkedInHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    shareUrl
  )}`;
  const facebookHref = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
    shareUrl
  )}&quote=${encodeURIComponent(shareSummaryText)}`;

  const supportsClipboardImage =
    typeof navigator !== 'undefined' &&
    typeof ClipboardItem !== 'undefined' &&
    Boolean(navigator.clipboard?.write);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={t.shareButtonLabel}
        className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900 px-2.5 sm:px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 hover:border-slate-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <Share2 className="h-3.5 w-3.5 text-sky-400 shrink-0" aria-hidden="true" />
        <span className="hidden sm:inline">{t.shareButtonLabel}</span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-report-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-700/80 bg-[#111827] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="share-report-dialog-title"
                  className="text-base font-semibold text-slate-50"
                >
                  {t.shareModalTitle}
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  {t.shareModalSubtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={t.pwaCloseModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {/* Summary Card Image Preview */}
            <div className="mt-4">
              <div className="flex items-center justify-between gap-2 text-xs font-medium text-slate-300">
                <span>{t.shareCardPreviewLabel}</span>
                <span className="font-mono text-[11px] text-slate-500">
                  1200 × 630 PNG
                </span>
              </div>

              <div className="mt-2 overflow-hidden rounded-lg border border-slate-800 bg-[#0B0F17] aspect-[1200/630] flex items-center justify-center">
                {cardPreviewUrl ? (
                  <img
                    src={cardPreviewUrl}
                    alt={`${result.repository.fullName} summary card`}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-slate-500">
                    {isGeneratingCard ? '...' : ''}
                  </span>
                )}
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {cardPreviewUrl && (
                  <a
                    href={cardPreviewUrl}
                    download={`${safeSlug}-summary-card.png`}
                    className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg bg-sky-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0"
                  >
                    <Download className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{t.shareDownloadImageButton}</span>
                  </a>
                )}

                {supportsClipboardImage && cardBlob && (
                  <button
                    type="button"
                    onClick={handleCopyImage}
                    className="inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {imageCopied ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                    )}
                    <span>
                      {imageCopied ? t.shareCopiedLabel : t.shareCopyImageButton}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Shareable Link Input + Copy */}
            <div className="mt-4 border-t border-slate-800/80 pt-4">
              <label
                htmlFor="share-report-url-input"
                className="block text-xs font-medium text-slate-300"
              >
                {t.shareLinkLabel}
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  id="share-report-url-input"
                  type="text"
                  readOnly
                  dir="ltr"
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-9 flex-1 min-w-0 rounded-lg border border-slate-700/80 bg-[#0B0F17] px-3 font-mono text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-400"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {linkCopied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                  )}
                  <span>
                    {linkCopied ? t.shareCopiedLabel : t.shareCopyLinkButton}
                  </span>
                </button>
              </div>
            </div>

            {/* Social Platform Share Links */}
            <div className="mt-4 border-t border-slate-800/80 pt-4">
              <div className="text-xs font-medium text-slate-300">
                {t.shareSocialPlatformsLabel}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2.5">
                <a
                  href={twitterHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800 hover:border-sky-500/60 transition-colors whitespace-nowrap"
                >
                  <span>{t.shareTwitterLabel}</span>
                  <ExternalLink className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
                </a>
                <a
                  href={linkedInHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800 hover:border-sky-500/60 transition-colors whitespace-nowrap"
                >
                  <span>{t.shareLinkedInLabel}</span>
                  <ExternalLink className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
                </a>
                <a
                  href={facebookHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800 hover:border-sky-500/60 transition-colors whitespace-nowrap"
                >
                  <span>{t.shareFacebookLabel}</span>
                  <ExternalLink className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
