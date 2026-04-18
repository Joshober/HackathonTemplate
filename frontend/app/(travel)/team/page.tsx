'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { api, type Profile } from '@/lib/api';
import { useTravelAuth } from '@/components/travel/useTravelAuth';
import TeamChatPanel from '@/components/travel/TeamChatPanel';

const MOCK_TEAM = [
  { name: 'Alex Rivera', role: 'Manager', participating: true, avatar: null as string | null },
  { name: 'Jordan Lee', role: 'Finance partner', participating: true, avatar: null },
  { name: 'Sam Okonkwo', role: 'Travel desk', participating: false, avatar: null },
  { name: 'Riley Chen', role: 'Peer', participating: true, avatar: null },
];

export default function TeamPage() {
  const { user, loading } = useTravelAuth();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .getProfile()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [user]);

  if (loading || !user) {
    return <div className="py-24 text-center text-travel-muted text-sm">Signing you in…</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Team</h2>
        <p className="text-sm text-travel-muted mt-1">
          Team chat is the main column; people and your card sit in the side rail (demo roster). Your profile syncs from the server.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 lg:items-stretch min-h-[72vh]">
        <aside className="w-full lg:w-[min(100%,280px)] shrink-0 flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-travel-muted mb-3">You</p>
            <div className="flex items-center gap-3">
              {profile?.profileImageUrl ? (
                <div className="relative w-12 h-12 rounded-full overflow-hidden border border-white/10">
                  <Image src={profile.profileImageUrl} alt="" fill className="object-cover" unoptimized />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-blue-500/30 flex items-center justify-center text-sm font-bold">
                  {(profile?.displayName || user.name || user.email || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-medium text-white truncate">{profile?.displayName || user.name || 'Traveler'}</p>
                <p className="text-xs text-travel-muted truncate">{user.email}</p>
              </div>
              <span className="ml-auto shrink-0 text-[10px] font-semibold uppercase text-emerald-300/90">In loop</span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex-1 min-h-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-travel-muted mb-3">People</p>
            <ul className="space-y-2 max-h-[min(52vh,480px)] lg:max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
              {MOCK_TEAM.map((m) => (
                <li
                  key={m.name}
                  className="flex items-center gap-3 rounded-xl border border-white/10 px-3 py-3 bg-black/20"
                >
                  <div className="w-10 h-10 shrink-0 rounded-full bg-violet-500/25 flex items-center justify-center text-sm font-semibold text-violet-100">
                    {m.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{m.name}</p>
                    <p className="text-xs text-travel-muted truncate">{m.role}</p>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md ${
                      m.participating ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-travel-muted'
                    }`}
                  >
                    {m.participating ? 'In loop' : 'Optional'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-travel-muted text-center px-1">
            Add/remove flows would connect to HR or directory APIs in production.
          </p>
        </aside>

        <section className="flex-1 min-w-0 flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-4 lg:p-5">
          <TeamChatPanel user={user} />
        </section>
      </div>
    </div>
  );
}
