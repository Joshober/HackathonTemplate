'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, MessageSquare, Users } from 'lucide-react';

const tabs: { href: string; label: string; Icon: typeof Home }[] = [
  { href: '/home', label: 'Home', Icon: Home },
  { href: '/assistant', label: 'AI', Icon: MessageSquare },
  { href: '/team', label: 'Team', Icon: Users },
  { href: '/profile', label: 'More', Icon: LayoutGrid },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="mx-auto w-full max-w-md" aria-label="Main">
      <div className="flex items-center justify-between gap-2 rounded-full bg-white px-2 py-2 shadow-[0_10px_30px_rgba(15,23,42,0.10)] ring-1 ring-slate-900/5">
        {tabs.map((t) => {
          const active = pathname === t.href || (t.href !== '/home' && pathname?.startsWith(t.href));
          const Icon = t.Icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={[
                'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-3 py-2.5 transition-colors',
                active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              {active ? (
                <>
                  {/* soft glow */}
                  <div className="absolute inset-0 -z-10 rounded-2xl bg-sky-200/35 blur-[10px]" />
                  {/* active bubble */}
                  <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-b from-sky-50 to-white ring-1 ring-sky-100 shadow-[0_8px_18px_rgba(14,165,233,0.18)]" />
                </>
              ) : null}

              <div className="relative">
                <Icon
                  className="mx-auto h-6 w-6"
                  strokeWidth={active ? 2.25 : 2}
                  aria-hidden
                />
              </div>
              <span
                className={[
                  'w-full truncate text-center text-[11px] font-medium tracking-tight',
                  active ? 'text-slate-900' : 'text-slate-500',
                ].join(' ')}
              >
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
