'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, login, User } from '@/lib/auth';
import Link from 'next/link';
import DashboardShell from '@/components/DashboardShell';

const legacyTools = [
  { href: '/chat', label: 'Chat pipeline', icon: 'forum', desc: 'Voice, text, images → AI' },
  { href: '/tutor', label: 'AI Tutor', icon: 'school', desc: 'Weekend energy tutor' },
  { href: '/support', label: 'Support', icon: 'support_agent', desc: 'Tickets & email' },
  { href: '/voice-assistant', label: 'Voice assistant', icon: 'mic', desc: 'Hands-free' },
  { href: '/bullshit-detect', label: 'Reality check', icon: 'fact_check', desc: 'Content analysis' },
  { href: '/pose-attendance', label: 'Pose attendance', icon: 'videocam', desc: 'Pose-based check-in' },
  { href: '/profile/edit', label: 'Profile editor', icon: 'person', desc: 'Photo & bio' },
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
      <div className="w-full max-w-3xl space-y-8">
        <div className="rounded-2xl border border-primary/15 bg-primary/5 p-6">
          <h1 className="text-2xl font-bold text-slate-100 mb-2">Travel Companion</h1>
          <p className="text-slate-500 text-sm mb-4">
            Primary app experience: planning, approvals, travel coordination, and return — mobile-first with AI and
            your existing APIs.
          </p>
          <Link
            href="/home"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-3 rounded-xl text-sm transition-colors"
          >
            <span className="material-symbols-outlined text-lg">flight_takeoff</span>
            Open Travel Companion
          </Link>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-slate-200 mb-1">Legacy &amp; developer tools</h2>
          <p className="text-slate-500 text-sm mb-4">Original hackathon demos still available here.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {legacyTools.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                className="flex items-center gap-4 p-5 rounded-2xl border border-primary/10 bg-background-dark hover:border-primary/25 hover:bg-primary/5 transition-colors"
              >
                <span className="material-symbols-outlined text-primary text-3xl">{s.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-100">{s.label}</p>
                  <p className="text-slate-500 text-sm mt-0.5">{s.desc}</p>
                </div>
                <span className="material-symbols-outlined text-slate-500">chevron_right</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
