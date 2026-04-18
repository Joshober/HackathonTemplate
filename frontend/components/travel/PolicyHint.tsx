'use client';

export default function PolicyHint({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <span className="sr-only">{title}</span>
      <button
        type="button"
        title={title}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/15 text-[10px] font-bold text-travel-muted hover:text-white hover:border-white/30"
        aria-label={title}
      >
        i
      </button>
      <span className="text-xs text-travel-muted">{children}</span>
    </span>
  );
}
