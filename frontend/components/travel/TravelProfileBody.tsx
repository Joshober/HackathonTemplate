'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, type Profile } from '@/lib/api';
import { logout } from '@/lib/auth';
import { useTravelAuth } from '@/components/travel/useTravelAuth';

export default function TravelProfileBody() {
  const { user, loading } = useTravelAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketTitle, setTicketTitle] = useState('Travel support request');
  const [ticketBody, setTicketBody] = useState('');
  const [ticketMsg, setTicketMsg] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setProfileLoading(true);
    try {
      const p = await api.getProfile();
      setProfile(p);
    } catch {
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const submitTicket = async () => {
    if (!ticketBody.trim()) {
      setTicketMsg('Please describe what you need.');
      return;
    }
    setTicketMsg(null);
    try {
      await api.createTicket({
        title: ticketTitle.trim() || 'Travel support',
        description: ticketBody.trim(),
        user_email: user?.email,
        conversation_summary: 'Travel Companion — profile escalation',
      });
      setTicketMsg('Ticket created. The travel desk will follow up.');
      setTicketBody('');
      setTicketOpen(false);
    } catch (e) {
      setTicketMsg(e instanceof Error ? e.message : 'Could not create ticket');
    }
  };

  if (loading || !user) {
    return <div className="py-24 text-center text-travel-muted text-sm">Signing you in…</div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-white">Profile</h2>
        <p className="text-sm text-travel-muted mt-1">Preferences and travel settings (demo fields).</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex gap-4 items-center">
        {profile?.profileImageUrl ? (
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-white/10 shrink-0">
            <Image src={profile.profileImageUrl} alt="" fill className="object-cover" unoptimized />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-blue-500/25 flex items-center justify-center text-xl font-bold shrink-0">
            {(profile?.displayName || user.name || user.email || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white truncate">{profile?.displayName || user.name || 'Traveler'}</p>
          <p className="text-xs text-travel-muted truncate">{user.email}</p>
          {profileLoading ? <p className="text-xs text-travel-muted mt-1">Loading profile…</p> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 divide-y divide-white/10 overflow-hidden text-sm">
        <div className="px-4 py-3 flex justify-between gap-2">
          <span className="text-travel-muted">Seat preference</span>
          <span className="text-white/90">Aisle</span>
        </div>
        <div className="px-4 py-3 flex justify-between gap-2">
          <span className="text-travel-muted">Hotel loyalty</span>
          <span className="text-white/90">Add in full profile</span>
        </div>
        <div className="px-4 py-3 flex justify-between gap-2">
          <span className="text-travel-muted">Notifications</span>
          <span className="text-white/90">Disruption alerts on</span>
        </div>
      </div>

      <Link
        href="/profile/edit"
        className="block w-full text-center py-3 rounded-xl border border-white/15 text-sm font-medium text-white hover:bg-white/5"
      >
        Edit full profile & photo
      </Link>

      {!profile && !profileLoading ? (
        <Link
          href="/profile/new"
          className="block w-full text-center py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-semibold text-white"
        >
          Create profile
        </Link>
      ) : null}

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-white">Escalate to support</p>
          <button
            type="button"
            onClick={() => setTicketOpen((o) => !o)}
            className="text-xs font-medium text-blue-300 hover:underline"
          >
            {ticketOpen ? 'Close' : 'Open'}
          </button>
        </div>
        {ticketOpen ? (
          <div className="space-y-2">
            <input
              value={ticketTitle}
              onChange={(e) => setTicketTitle(e.target.value)}
              className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm text-white"
            />
            <textarea
              value={ticketBody}
              onChange={(e) => setTicketBody(e.target.value)}
              rows={4}
              placeholder="Describe the issue or urgency…"
              className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30"
            />
            <button
              type="button"
              onClick={submitTicket}
              className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium"
            >
              Submit ticket
            </button>
          </div>
        ) : null}
        {ticketMsg ? <p className="text-xs text-emerald-300/90">{ticketMsg}</p> : null}
      </div>

      <button
        type="button"
        onClick={() => logout()}
        className="w-full py-3 rounded-xl border border-red-500/30 text-red-200 text-sm font-medium hover:bg-red-500/10"
      >
        Sign out
      </button>

      <p className="text-[10px] text-center text-travel-muted">
        Policy compliance is summarized in-app; always confirm with official Lockton guidance.
      </p>
    </div>
  );
}
