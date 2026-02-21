'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { LayoutDashboard, User, ArrowLeft, Brain, Flame } from 'lucide-react';
import { logout } from '@/lib/auth';

const navItems = [
  { icon: LayoutDashboard, label: 'Overview', href: '/dashboard' },
  { icon: User, label: 'Profile', href: '/profile' },
  { icon: Flame, label: 'Roast AI', href: '/multiverse' },
];

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      if (typeof window !== 'undefined') window.location.href = '/';
    }
  };

  return (
    <div className="min-h-screen bg-[#0E1117] text-white flex">
      {/* Animated gradient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-gradient-to-b from-[#4F8CFF]/10 via-[#4F8CFF]/5 to-transparent rounded-full blur-3xl"
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Left Sidebar */}
      <motion.aside
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="w-72 bg-white/5 backdrop-blur-xl border-r border-white/10 p-6 flex flex-col relative z-10"
      >
        <Link
          href="/"
          className="mb-10 flex items-center gap-2 text-gray-400 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm">Back to Home</span>
        </Link>

        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-[#4F8CFF] to-[#6BA0FF] rounded-xl flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Claude Home™</h1>
              <p className="text-xs text-gray-500">Control Center</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <motion.span
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all w-full ${
                    active
                      ? 'bg-[#4F8CFF]/20 text-white border border-[#4F8CFF]/30 shadow-lg shadow-[#4F8CFF]/10'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </motion.span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-5">
          <div className="text-sm text-gray-400 mb-3">Account</div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left text-sm text-gray-400 hover:text-white transition-colors py-1"
          >
            Sign out
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative z-10">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
