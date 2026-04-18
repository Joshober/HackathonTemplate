'use client';

import Link from 'next/link';

/** Minimal chrome for profile sub-routes (no legacy demo navigation). */
export default function TravelSubpageLayout({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="min-h-dvh bg-[#080a0f] text-slate-100">
      <header className="border-b border-white/[0.06] bg-[#0c0e14]/90 backdrop-blur-md px-4 py-3 flex items-center gap-3">
        <Link
          href="/profile"
          className="inline-flex items-center gap-1 text-sm text-travel-muted hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
          Profile
        </Link>
        <span className="text-white/20">|</span>
        <span className="text-sm font-medium text-white/90">{title}</span>
        <Link href="/home" className="ml-auto text-xs font-semibold text-blue-300 hover:underline">
          Travel Companion
        </Link>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
