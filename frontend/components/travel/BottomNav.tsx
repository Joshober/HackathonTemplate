'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs: { href: string; label: string; icon: string }[] = [
  { href: '/home', label: 'Home', icon: 'home' },
  { href: '/explorer', label: 'Explorer', icon: 'travel_explore' },
  { href: '/assistant', label: 'AI', icon: 'smart_toy' },
  { href: '/team', label: 'Team', icon: 'groups' },
  { href: '/profile', label: 'Profile', icon: 'person' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="shrink-0 border-t border-white/[0.06] bg-[#0c0e14]/95 backdrop-blur-xl pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 px-2"
      aria-label="Main"
    >
      <div className="flex max-w-md mx-auto justify-between items-stretch gap-1">
        {tabs.map((t) => {
          const active = pathname === t.href || (t.href !== '/home' && pathname?.startsWith(t.href));
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-0 flex-1 py-1.5 rounded-xl transition-colors ${
                active ? 'text-white bg-white/[0.08]' : 'text-travel-muted hover:text-white/80'
              }`}
            >
              <span
                className="material-symbols-outlined text-[22px]"
                style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
              >
                {t.icon}
              </span>
              <span className="text-[10px] font-medium truncate w-full text-center">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
