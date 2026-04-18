'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Home, LayoutGrid, MessageSquare, Users } from 'lucide-react';

const tabs: { href: string; label: string; Icon: typeof Home }[] = [
  { href: '/home', label: 'Home', Icon: Home },
  { href: '/explorer', label: 'Explorer', Icon: Compass },
  { href: '/assistant', label: 'AI', Icon: MessageSquare },
  { href: '/team', label: 'Team', Icon: Users },
  { href: '/profile', label: 'More', Icon: LayoutGrid },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="shine-overlay max-w-md mx-auto" aria-label="Main">
      <div className="glass-panel rounded-[28px] p-1.5 flex items-center justify-around shadow-2xl border border-black/[0.06]">
        {tabs.map((t) => {
          const active = pathname === t.href || (t.href !== '/home' && pathname?.startsWith(t.href));
          const Icon = t.Icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className="relative flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-all duration-300 min-w-0"
            >
              {active ? <div className="absolute inset-0 glass-button rounded-[20px] mx-1" /> : null}
              <div className="relative z-10">
                <Icon
                  className={`w-6 h-6 transition-colors mx-auto ${active ? 'text-gray-900' : 'text-gray-500'}`}
                  strokeWidth={2}
                  aria-hidden
                />
              </div>
              <span
                className={`relative z-10 text-[10px] font-medium transition-colors truncate w-full text-center ${
                  active ? 'text-gray-900' : 'text-gray-500'
                }`}
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
