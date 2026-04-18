'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

/** Minimal chrome for profile sub-routes (no legacy demo navigation). */
export default function TravelSubpageLayout({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="min-h-dvh bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 glass-panel px-4 py-3 flex items-center gap-3">
        <Link
          href="/profile"
          className="inline-flex items-center gap-1 text-sm text-travel-muted hover:text-gray-900 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 shrink-0" aria-hidden />
          Profile
        </Link>
        <span className="text-gray-300">|</span>
        <span className="text-sm font-medium text-gray-800">{title}</span>
        <Link href="/home" className="ml-auto text-xs font-semibold text-blue-600 hover:underline">
          Travel Companion
        </Link>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
