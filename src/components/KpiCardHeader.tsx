import { Info } from 'lucide-react';
import { type ReactNode, useEffect, useId, useState } from 'react';

interface KpiCardHeaderProps {
  label: string;
  tooltip: string;
  icon?: ReactNode;
  align?: 'start' | 'end';
}

export function KpiCardHeader({
  label,
  tooltip,
  icon,
  align = 'end',
}: KpiCardHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tooltipId = useId();

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

  return (
    <div
      className="relative flex items-center justify-between gap-2"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <div className="flex items-center gap-1.5 min-w-0 text-xs font-medium text-slate-400">
        {icon}
        <span className="truncate">{label}</span>
      </div>

      <button
        type="button"
        aria-label={`${label} — Info`}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-500 hover:text-sky-400 focus-visible:text-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 transition-colors cursor-help"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          id={tooltipId}
          role="tooltip"
          className={`pointer-events-none absolute bottom-full mb-2 z-30 w-64 max-w-[calc(100vw-3rem)] rounded-lg border border-slate-700/90 bg-[#0B0F17] px-3 py-2 text-xs leading-relaxed text-slate-200 shadow-xl ${
            align === 'end' ? 'end-0' : 'start-0'
          }`}
        >
          {tooltip}
        </div>
      )}
    </div>
  );
}
