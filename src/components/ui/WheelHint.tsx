/**
 * "How to play": a small pill under the HUD on the first screen. An animated
 * mouse wheel plus the keys; touch screens get swipe wording instead. The SVGs
 * carry their own width/height so they stay small even before styles load.
 */
export function WheelHint() {
  return (
    <div className="flex items-center gap-2.5 whitespace-nowrap rounded-full border-2 border-white/70 bg-ink/80 py-1.5 pl-2.5 pr-4 text-[13px] font-bold text-ice-50 shadow-[0_8px_24px_-10px_rgba(0,0,0,0.6)]">
      <svg viewBox="0 0 40 60" width="15" height="22" className="wheel-hint shrink-0 pointer-coarse:hidden" aria-hidden="true">
        <rect x="3" y="3" width="34" height="54" rx="17" fill="#f3fbff" stroke="#0e1b33" strokeWidth="4" />
        <path d="M20 3 V22" stroke="#0e1b33" strokeWidth="3" />
        <rect className="wheel-hint-wheel" x="16" y="10" width="8" height="11" rx="4" fill="#d7262e" />
      </svg>
      <svg viewBox="0 0 48 48" width="20" height="20" className="swipe-hint hidden shrink-0 pointer-coarse:block" aria-hidden="true">
        <path className="swipe-hint-dot" d="M24 36 V14 M15 22 L24 13 L33 22" fill="none" stroke="#f3fbff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="pointer-coarse:hidden">
        Scroll to walk
        <span className="mx-2 text-ice-200/60">·</span>
        <kbd className="rounded border border-white/40 px-1 font-sans text-[11px]">←</kbd> <kbd className="rounded border border-white/40 px-1 font-sans text-[11px]">→</kbd> walk
        <span className="mx-2 text-ice-200/60">·</span>
        <kbd className="rounded border border-white/40 px-1 font-sans text-[11px]">↑</kbd> jump
      </span>
      <span className="hidden pointer-coarse:inline">Swipe left or up to walk</span>
    </div>
  );
}
