'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { LayoutDashboard, User, ArrowLeft, MessageCircle, GraduationCap, FileWarning, Mic, Camera } from 'lucide-react';
import { logout } from '@/lib/auth';

const navItems = [
  { icon: LayoutDashboard, label: 'Overview', href: '/dashboard' },
  { icon: GraduationCap, label: 'AI Tutor', href: '/tutor' },
  { icon: User, label: 'Profile', href: '/profile' },
  { icon: MessageCircle, label: 'Chat Pipeline', href: '/chat' },
  { icon: FileWarning, label: 'Bullshit Detect', href: '/bullshit-detect' },
  { icon: Mic, label: 'Voice Assistant', href: '/voice-assistant' },
  { icon: Camera, label: 'Pose Attendance', href: '/pose-attendance' },
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
    <div className="min-h-screen bg-[#08050c] text-white flex">
      <div className="fixed inset-0 bg-dot-grid pointer-events-none" />

      <motion.aside
        initial={{ x: -60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-72 flex-shrink-0 relative z-10 border-r-2 border-white/10 bg-[#08050c]/90 backdrop-blur-sm p-6 flex flex-col"
      >
        <Link
          href="/"
          className="mb-8 flex items-center gap-2 text-white/60 hover:text-[#00e5c0] transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm font-medium">Back to Home</span>
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-[#ff6b35] flex items-center justify-center font-heading font-extrabold text-black text-sm">
              CH
            </div>
            <div>
              <h1 className="font-heading font-bold text-lg tracking-tight">Claude Home™</h1>
              <p className="text-xs text-white/40">Control Center</p>
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
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-lg transition-all w-full border-l-2 ${
                    active
                      ? 'bg-[#ff6b35]/15 text-white border-l-[#ff6b35]'
                      : 'text-white/60 hover:bg-white/5 hover:text-[#00e5c0] border-l-transparent'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </motion.span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 rounded-xl border-2 border-white/10 bg-white/[0.03] p-4">
          <div className="text-xs font-medium text-white/40 mb-2">Account</div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left text-sm text-white/60 hover:text-[#00e5c0] transition-colors py-1"
          >
            Sign out
          </button>
        </div>
      </motion.aside>

      <main className="flex-1 overflow-y-auto relative z-10">
        <div className="p-6 sm:p-8">{children}</div>
      </main>
    </div>
  );
}
