'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, type Profile, type TeamDetail, type TeamSummary, TRAVEL_ACTIVE_TEAM_STORAGE_KEY } from '@/lib/api';
import { useTravelAuth } from '@/components/travel/useTravelAuth';
import { useTravelStage } from '@/lib/travelContext';
import TeamChatPanel from '@/components/travel/TeamChatPanel';

export default function TeamPage() {
  const { user, loading } = useTravelAuth();
  const { setStage } = useTravelStage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createName, setCreateName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    api
      .getProfile()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, [user]);

  const pickActiveTeamId = useCallback((t: TeamSummary[], cur: string | null) => {
    if (!t.length) return null;
    const saved =
      typeof window !== 'undefined' ? localStorage.getItem(TRAVEL_ACTIVE_TEAM_STORAGE_KEY) : null;
    if (saved && t.some((x) => x.id === saved)) return saved;
    if (cur && t.some((x) => x.id === cur)) return cur;
    return t[0].id;
  }, []);

  const loadTeams = useCallback(async () => {
    const { teams: t } = await api.listTeams();
    setTeams(t);
    setActiveTeamId((cur) => pickActiveTeamId(t, cur));
  }, [pickActiveTeamId]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setBootLoading(true);
      setErr(null);
      try {
        await api.syncUser();
        const { teams: t } = await api.listTeams();
        if (cancelled) return;
        setTeams(t);
        setActiveTeamId((cur) => pickActiveTeamId(t, cur));
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Could not load teams');
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, pickActiveTeamId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (activeTeamId) {
      localStorage.setItem(TRAVEL_ACTIVE_TEAM_STORAGE_KEY, activeTeamId);
    } else {
      localStorage.removeItem(TRAVEL_ACTIVE_TEAM_STORAGE_KEY);
    }
  }, [activeTeamId]);

  useEffect(() => {
    if (!activeTeamId) {
      setTeamDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    api
      .getTeam(activeTeamId)
      .then((d) => {
        if (!cancelled) setTeamDetail(d);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Could not load team');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTeamId]);

  const refreshTeamDetail = useCallback(async () => {
    if (!activeTeamId) return;
    try {
      const d = await api.getTeam(activeTeamId);
      setTeamDetail(d);
    } catch {
      /* ignore */
    }
  }, [activeTeamId]);

  const onCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = createName.trim();
    if (!name || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const created = await api.createTeam({ name });
      setCreateName('');
      await loadTeams();
      setActiveTeamId(created.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create team');
    } finally {
      setBusy(false);
    }
  };

  const onAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTeamId || busy) return;
    const email = addEmail.trim().toLowerCase();
    if (!email) return;
    setBusy(true);
    setErr(null);
    try {
      await api.addTeamMember(activeTeamId, email);
      setAddEmail('');
      await refreshTeamDetail();
      await loadTeams();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add member');
    } finally {
      setBusy(false);
    }
  };

  const onLeaveTeam = async () => {
    if (!activeTeamId || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await api.leaveTeam(activeTeamId);
      await loadTeams();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not leave team');
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) {
    return <div className="py-24 text-center text-travel-muted text-sm">Signing you in…</div>;
  }

  if (bootLoading) {
    return <div className="py-24 text-center text-travel-muted text-sm">Loading teams…</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Team</h2>
        <p className="text-sm text-travel-muted mt-1">
          Create a team, invite colleagues by email (they must sign in once), and chat with a shared travel assistant. Your profile
          still syncs from the server.
        </p>
      </div>

      <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">Trip approvals</p>
          <p className="text-xs text-travel-muted mt-0.5">
            Open Home in the Approve stage to track reviewers, pricing, and sign-off. Reviewer names come from your active team
            here.
          </p>
        </div>
        <Link
          href="/home"
          onClick={() => setStage('approve')}
          className="shrink-0 inline-flex items-center justify-center rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium px-4 py-2.5 text-center transition-colors"
        >
          Approve a trip
        </Link>
      </div>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div>
      ) : null}

      {teams.length === 0 ? (
        <form onSubmit={onCreateTeam} className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3 max-w-md shadow-sm">
          <p className="text-sm font-medium text-gray-900">Create your first team</p>
          <input
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Team name"
            className="w-full rounded-xl bg-white border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm"
          />
          <button
            type="submit"
            disabled={busy || !createName.trim()}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium py-2.5"
          >
            {busy ? '…' : 'Create team'}
          </button>
        </form>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 max-w-xl">
          <label className="text-xs text-travel-muted shrink-0" htmlFor="team-select">
            Active team
          </label>
          <select
            id="team-select"
            value={activeTeamId ?? ''}
            onChange={(e) => setActiveTeamId(e.target.value || null)}
            className="flex-1 rounded-xl bg-white border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm"
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.memberCount} {t.memberCount === 1 ? 'member' : 'members'})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              const name = window.prompt('New team name');
              if (name?.trim()) {
                void (async () => {
                  setBusy(true);
                  setErr(null);
                  try {
                    const created = await api.createTeam({ name: name.trim() });
                    await loadTeams();
                    setActiveTeamId(created.id);
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : 'Could not create team');
                  } finally {
                    setBusy(false);
                  }
                })();
              }
            }}
            disabled={busy}
            className="text-xs px-3 py-2 rounded-xl border border-gray-200 text-gray-800 hover:bg-gray-50 disabled:opacity-50 bg-white shadow-sm"
          >
            + New team
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 lg:items-stretch min-h-[72vh]">
        <aside className="w-full lg:w-[min(100%,280px)] shrink-0 flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-travel-muted mb-3">You</p>
            <div className="flex items-center gap-3">
              {profile?.profileImageUrl ? (
                <div className="relative w-12 h-12 rounded-full overflow-hidden border border-gray-200">
                  <Image src={profile.profileImageUrl} alt="" fill className="object-cover" unoptimized />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-sm font-bold border border-blue-200">
                  {(profile?.displayName || user.name || user.email || '?').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{profile?.displayName || user.name || 'Traveler'}</p>
                <p className="text-xs text-travel-muted truncate">{user.email}</p>
              </div>
            </div>
          </div>

          {activeTeamId && teamDetail ? (
            <>
              <div className="rounded-2xl border border-gray-200 bg-white p-4 flex-1 min-h-0 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-travel-muted mb-3">Members</p>
                {detailLoading ? (
                  <p className="text-xs text-travel-muted">Loading…</p>
                ) : (
                  <ul className="space-y-2 max-h-[min(52vh,480px)] lg:max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
                    {teamDetail.members.map((m) => (
                      <li
                        key={m.userId}
                        className="flex items-center gap-3 rounded-xl border border-gray-200 px-3 py-3 bg-gray-50"
                      >
                        {m.profileImageUrl ? (
                          <div className="relative w-10 h-10 shrink-0 rounded-full overflow-hidden border border-gray-200">
                            <Image src={m.profileImageUrl} alt="" fill className="object-cover" unoptimized />
                          </div>
                        ) : (
                          <div className="w-10 h-10 shrink-0 rounded-full bg-violet-100 flex items-center justify-center text-sm font-semibold text-violet-900 border border-violet-200">
                            {(m.displayName || m.email || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {m.displayName || m.email || m.userId}
                            {m.userId === user.sub ? <span className="text-travel-muted font-normal"> · you</span> : null}
                          </p>
                          {m.email ? <p className="text-xs text-travel-muted truncate">{m.email}</p> : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <form onSubmit={onAddMember} className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wider text-travel-muted">Invite by email</p>
                <p className="text-[10px] text-travel-muted">They must log in once so their email is synced.</p>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="flex-1 rounded-xl bg-white border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm"
                  />
                  <button
                    type="submit"
                    disabled={busy || !addEmail.trim()}
                    className="shrink-0 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 border border-gray-200 disabled:opacity-50 text-sm text-gray-900"
                  >
                    Add
                  </button>
                </div>
              </form>

              <button
                type="button"
                onClick={() => void onLeaveTeam()}
                disabled={busy}
                className="text-xs text-travel-muted hover:text-red-700 underline disabled:opacity-50"
              >
                Leave this team
              </button>
            </>
          ) : null}

          <p className="text-xs text-travel-muted text-center px-1">Team data is stored in MongoDB for this app.</p>
        </aside>

        <section className="flex-1 min-w-0 flex flex-col rounded-2xl border border-gray-200 bg-white p-4 lg:p-5 shadow-sm">
          <TeamChatPanel teamId={activeTeamId} user={user} presetCities={teamDetail?.cityPresets || []} />
        </section>
      </div>
    </div>
  );
}
