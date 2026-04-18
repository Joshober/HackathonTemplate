'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { logout } from '@/lib/auth';
import { api } from '@/lib/api';

const navItems: { icon: string; label: string; href: string }[] = [
  { icon: 'flight_takeoff', label: 'Travel Companion', href: '/home' },
  { icon: 'dashboard', label: 'Legacy hub', href: '/dashboard' },
  { icon: 'list_alt', label: 'Chaos Logs', href: '/chat' },
  { icon: 'history', label: 'AI Tutor', href: '/tutor' },
  { icon: 'warning', label: 'Existential Threats', href: '/bullshit-detect' },
  { icon: 'graphic_eq', label: 'Voice Assistant', href: '/voice-assistant' },
  { icon: 'videocam', label: 'Pose Attendance', href: '/pose-attendance' },
  { icon: 'help_center', label: 'Help us', href: '/support' },
];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    api.adminMe().then((r) => setIsAdmin(!!r?.isAdmin));
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      if (typeof window !== 'undefined') window.location.href = '/';
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background-dark text-slate-100">
      <div className="fixed inset-0 bg-dot-grid pointer-events-none" />

      <aside className="w-72 flex-shrink-0 flex flex-col border-r border-primary/10 bg-background-dark/50 backdrop-blur-xl relative z-10">
        <div className="p-6 flex flex-col h-full">
          <Link href="/" className="mb-6 flex items-center gap-2 text-slate-400 hover:text-primary transition-colors group">
            <span className="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">arrow_back</span>
            <span className="text-sm font-medium">Back to Home</span>
          </Link>

          <div className="mb-10">
            <h1 className="text-lg font-bold leading-none">Hackathon tools</h1>
            <p className="text-xs text-primary font-medium tracking-tight mt-1">Travel Companion lives under /home</p>
          </div>

          <nav className="flex-1 space-y-2">
            {navItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== '/dashboard' && item.href !== '/home' && pathname?.startsWith(item.href)) ||
                (item.href === '/home' && (pathname === '/home' || pathname?.startsWith('/explorer') || pathname?.startsWith('/assistant') || pathname?.startsWith('/team') || pathname === '/profile'));
              return (
                <Link key={item.href} href={item.href}>
                  <motion.span
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full cursor-pointer group ${
                      active
                        ? 'bg-primary text-background-dark font-bold'
                        : 'hover:bg-primary/10 text-slate-400 hover:text-primary'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">{item.icon}</span>
                    <span className="text-sm">{item.label}</span>
                  </motion.span>
                </Link>
              );
            })}
            {isAdmin && (
              <Link href="/admin">
                <motion.span
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all w-full cursor-pointer group ${
                    pathname === '/admin' || pathname?.startsWith('/admin/')
                      ? 'bg-amber-500/30 text-amber-200 font-bold border border-amber-500/40'
                      : 'hover:bg-amber-500/10 text-slate-400 hover:text-amber-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
                  <span className="text-sm">Admin</span>
                </motion.span>
              </Link>
            )}
          </nav>

          <div className="mt-auto pt-6 border-t border-primary/10 space-y-3">
            <Link
              href="/profile"
              className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-primary/20 text-primary text-sm font-medium hover:bg-primary/10 transition-colors ${
                pathname === '/profile' || pathname?.startsWith('/profile/') ? 'bg-primary/10' : ''
              }`}
            >
              <span className="material-symbols-outlined text-xl">person</span>
              Profile Settings
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full h-14 bg-primary text-background-dark font-black uppercase tracking-widest rounded-xl glow-primary hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined">logout</span>
              Panic Button
            </button>
            <p className="text-[10px] text-center mt-3 text-slate-500 uppercase tracking-tighter">Click in case of clarity</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 scrollbar-hide">{children}</div>
      </main>
    </div>
  );
}
