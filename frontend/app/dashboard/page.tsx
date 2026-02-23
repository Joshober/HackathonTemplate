'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, login, User } from '@/lib/auth';
import Link from 'next/link';
import DashboardShell from '@/components/DashboardShell';

const shortcuts = [
  { href: '/chat', label: 'Chat Pipeline', icon: 'forum', desc: 'Voice, text, images → AI' },
  { href: '/tutor', label: 'AI Tutor', icon: 'school', desc: 'Learn with voice or text' },
  { href: '/support', label: 'Tech Support', icon: 'support_agent', desc: 'Chat, email, tickets' },
  { href: '/voice-assistant', label: 'Voice Assistant', icon: 'mic', desc: 'Hands-free assistant' },
  { href: '/bullshit-detect', label: 'Reality Check', icon: 'fact_check', desc: 'Detect unreliable content' },
  { href: '/pose-attendance', label: 'Pose Attendance', icon: 'photo_camera', desc: 'Attendance by pose' },
  { href: '/profile', label: 'Profile', icon: 'person', desc: 'Edit your profile' },
];

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        await login();
        return;
      }
      setUser(currentUser);
    } catch {
      await login();
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background-dark flex items-center justify-center">
        <div className="text-primary flex items-center gap-2">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          Loading...
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardShell>
      <div className="w-full max-w-5xl">
        <h1 className="text-2xl font-bold text-slate-100 mb-1">
          Welcome back{user.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-slate-500 text-sm mb-8">{user.email}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {shortcuts.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="flex items-center gap-6 p-7 rounded-2xl border border-primary/10 bg-background-dark hover:border-primary/30 hover:bg-primary/5 transition-colors min-h-[120px]"
            >
              <span className="material-symbols-outlined text-primary text-4xl">{s.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-100 text-lg">{s.label}</p>
                <p className="text-slate-500 mt-1">{s.desc}</p>
              </div>
              <span className="material-symbols-outlined text-slate-500 text-2xl ml-auto">arrow_forward</span>
            </Link>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
