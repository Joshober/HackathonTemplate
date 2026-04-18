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
        <h2 className="text-lg font-semibold text-gray-900">Profile</h2>
        <p className="text-sm text-travel-muted mt-1">Preferences and travel settings (demo fields).</p>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 flex gap-4 items-center shadow-sm">
        {profile?.profileImageUrl ? (
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-gray-200 shrink-0">
            <Image src={profile.profileImageUrl} alt="" fill className="object-cover" unoptimized />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center text-xl font-bold shrink-0 border border-blue-200">
            {(profile?.displayName || user.name || user.email || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 truncate">{profile?.displayName || user.name || 'Traveler'}</p>
          <p className="text-xs text-travel-muted truncate">{user.email}</p>
          {profileLoading ? <p className="text-xs text-travel-muted mt-1">Loading profile…</p> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden text-sm bg-white shadow-sm">
        <div className="px-4 py-3 flex justify-between gap-2">
          <span className="text-travel-muted">Seat preference</span>
          <span className="text-gray-900">Aisle</span>
        </div>
        <div className="px-4 py-3 flex justify-between gap-2">
          <span className="text-travel-muted">Hotel loyalty</span>
          <span className="text-gray-900">Add in full profile</span>
        </div>
        <div className="px-4 py-3 flex justify-between gap-2">
          <span className="text-travel-muted">Notifications</span>
          <span className="text-gray-900">Disruption alerts on</span>
        </div>
      </div>

      <Link
        href="/profile/edit"
        className="block w-full text-center py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-900 hover:bg-gray-50 bg-white shadow-sm"
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

      <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-gray-900">Escalate to support</p>
          <button
            type="button"
            onClick={() => setTicketOpen((o) => !o)}
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            {ticketOpen ? 'Close' : 'Open'}
          </button>
        </div>
        {ticketOpen ? (
          <div className="space-y-2">
            <input
              value={ticketTitle}
              onChange={(e) => setTicketTitle(e.target.value)}
              className="w-full rounded-xl bg-white border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm"
            />
            <textarea
              value={ticketBody}
              onChange={(e) => setTicketBody(e.target.value)}
              rows={4}
              placeholder="Describe the issue or urgency…"
              className="w-full rounded-xl bg-white border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm"
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
        {ticketMsg ? <p className="text-xs text-emerald-800">{ticketMsg}</p> : null}
      </div>

      <button
        type="button"
        onClick={() => logout()}
        className="w-full py-3 rounded-xl border border-red-200 text-red-800 text-sm font-medium hover:bg-red-50 bg-white"
      >
        Sign out
      </button>

      <p className="text-[10px] text-center text-travel-muted">
        Policy compliance is summarized in-app; always confirm with official Lockton guidance.
      </p>
    </div>
  );
}
