import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus.ts';
import type { Translations } from '../lib/i18n.ts';

interface OfflineIndicatorProps {
  t: Translations;
}

export function OfflineIndicator({ t }: OfflineIndicatorProps) {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 start-4 z-50 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-[#111827]/95 px-3.5 py-2 text-xs font-medium text-amber-300 shadow-lg backdrop-blur-sm"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
      <span>{t.pwaOfflineBanner}</span>
    </div>
  );
}
