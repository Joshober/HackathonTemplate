'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type Profile, type TeamDetail, type TeamSummary, TRAVEL_ACTIVE_TEAM_STORAGE_KEY } from '@/lib/api';
import { useTravelAuth } from '@/components/travel/useTravelAuth';
import TeamChatPanel from '@/components/travel/TeamChatPanel';
import StartPlanningDropdown from '@/components/travel/StartPlanningDropdown';
import GoogleCalendarButton from '@/components/travel/GoogleCalendarButton';
import { useTeamPlanning } from '@/lib/teamPlanningContext';
import { useTravelStage } from '@/lib/travelContext';
import TravelDayItinerary from '@/components/travel/TravelDayItinerary';
import type { Item } from '@/lib/api';
import {
  Plus, Users, X, UserPlus, XCircle, ArrowLeft, Crown, Star, MoreVertical, Shield, Rocket,
} from 'lucide-react';

export default function TeamPage() {
  const { user, loading } = useTravelAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Member context menu
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Planning context
  const { coLeaderId, setCoLeader, bindToTeam, hasStartedPlanning, startPlanning, generatedPlan } = useTeamPlanning();

  const { stage } = useTravelStage();
  const [panelItems, setPanelItems] = useState<Item[]>([]);

  useEffect(() => {
    if (!user) return;
    api.getProfile().then(setProfile).catch(() => setProfile(null));
  }, [user]);

  useEffect(() => {
    if (stage === 'travel') {
      api.getItems().then(setPanelItems).catch(() => {});
    }
  }, [stage]);

  const loadTeams = useCallback(async () => {
    const { teams: t } = await api.listTeams();
    setTeams(t);
  }, []);

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
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Could not load teams');
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (activeTeamId) {
        localStorage.setItem(TRAVEL_ACTIVE_TEAM_STORAGE_KEY, activeTeamId);
        bindToTeam(activeTeamId);
      } else {
        localStorage.removeItem(TRAVEL_ACTIVE_TEAM_STORAGE_KEY);
        bindToTeam(null);
      }
    }
  }, [activeTeamId, bindToTeam]);

  useEffect(() => {
    if (!activeTeamId) { setTeamDetail(null); return; }
    let cancelled = false;
    setDetailLoading(true);
    api.getTeam(activeTeamId)
      .then((d) => { if (!cancelled) setTeamDetail(d); })
      .catch((e) => { if (!cancelled) setErr(e instanceof Error ? e.message : 'Could not load team'); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [activeTeamId]);

  // Close member menu when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenFor(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const refreshTeamDetail = useCallback(async () => {
    if (!activeTeamId) return;
    try { const d = await api.getTeam(activeTeamId); setTeamDetail(d); } catch {/* ignore */}
  }, [activeTeamId]);

  const onCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = createName.trim();
    if (!name || busy) return;
    setBusy(true); setErr(null);
    try {
      const created = await api.createTeam({ name });
      setCreateName(''); setIsCreateOpen(false);
      await loadTeams();
      setActiveTeamId(created.id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create team');
    } finally { setBusy(false); }
  };

  const onAddMember = async () => {
    if (!activeTeamId || busy) return;
    const email = window.prompt("Enter member's email:");
    if (!email) return;
    setBusy(true); setErr(null);
    try {
      await api.addTeamMember(activeTeamId, email.trim().toLowerCase());
      await refreshTeamDetail(); await loadTeams();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add member');
    } finally { setBusy(false); }
  };

  const onLeaveTeam = async () => {
    if (!activeTeamId || busy) return;
    setBusy(true); setErr(null);
    try {
      await api.leaveTeam(activeTeamId);
      setActiveTeamId(null); await loadTeams();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not leave team');
    } finally { setBusy(false); }
  };

  // ── Role helpers ──────────────────────────────────────────────────────────
  const leaderId = teamDetail?.createdBy ?? teamDetail?.members[0]?.userId ?? null;
  const currentUserId = user?.sub ?? null;
  const isLeader = !!(currentUserId && leaderId && currentUserId === leaderId);
  const isCoLeader = !!(currentUserId && coLeaderId && currentUserId === coLeaderId);

  const getMemberRole = (memberId: string) => {
    if (memberId === leaderId) return 'leader';
    if (memberId === coLeaderId) return 'co-leader';
    return 'member';
  };

  const makeCoLeader = (memberId: string) => {
    setCoLeader(memberId);
    setMenuOpenFor(null);
  };

  const removeCoLeader = () => {
    setCoLeader(null);
    setMenuOpenFor(null);
  };

  const promoteToLeader = () => {
    // Co-leader promotes themselves
    // (In a real app this would update the backend. Here we swap just the context.)
    alert('Leader promotion would require a backend call — for the hackathon, contact your leader to transfer ownership.');
    setMenuOpenFor(null);
  };

  if (loading || !user) {
    return <div className="py-24 text-center text-travel-muted text-sm">Signing you in…</div>;
  }
  if (bootLoading) {
    return <div className="py-24 text-center text-travel-muted text-sm">Loading teams…</div>;
  }

  // ── DETAIL VIEW ────────────────────────────────────────────────────────────
  if (activeTeamId && teamDetail) {
    return (
      <div className="flex h-[calc(100vh-140px)] -mt-2 -mx-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative">

        {/* Sidebar */}
        <aside className="w-[128px] shrink-0 border-r border-gray-100 bg-[#f8f9fa] flex flex-col pt-4">
          {/* Back */}
          <div className="px-3 mb-4">
            <button
              onClick={() => setActiveTeamId(null)}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 bg-[#e2e8f0] hover:bg-gray-300 px-3 py-1.5 rounded-full transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          </div>

          {/* Members */}
          <div className="flex-1 px-3 overflow-y-auto">
            <h3 className="text-[10px] font-bold text-[#64748b] mb-4 px-1 uppercase tracking-wider">Members</h3>
            {detailLoading ? (
              <p className="text-xs text-gray-400 px-1">Loading...</p>
            ) : (
              <ul className="space-y-5">
                {teamDetail.members.map((m) => {
                  const role = getMemberRole(m.userId);
                  const isMe = m.userId === currentUserId;
                  const menuOpen = menuOpenFor === m.userId;

                  return (
                    <li key={m.userId} className="flex flex-col items-center gap-1 relative">
                      {/* Avatar */}
                      <div className="relative">
                        {m.profileImageUrl ? (
                          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm bg-gray-100">
                            <Image src={m.profileImageUrl} alt="" fill className="object-cover" unoptimized />
                          </div>
                        ) : (
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold border-2 border-white shadow-sm text-lg
                            ${role === 'leader' ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white' :
                              role === 'co-leader' ? 'bg-gradient-to-br from-blue-400 to-indigo-500 text-white' :
                              'bg-blue-100 text-blue-800'}`}
                          >
                            {(m.displayName || m.email || '?').charAt(0).toUpperCase()}
                          </div>
                        )}

                        {/* Online dot */}
                        <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />

                        {/* Role badge */}
                        {role === 'leader' && (
                          <div className="absolute -top-2 -right-2 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center border-2 border-white shadow-sm" title="Team Leader">
                            <Crown className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                        {role === 'co-leader' && (
                          <div className="absolute -top-2 -right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white shadow-sm" title="Co-Leader">
                            <Shield className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </div>

                      {/* Name */}
                      <p className="text-[11px] font-medium text-gray-700 truncate max-w-full text-center">
                        {m.displayName?.split(' ')[0] || m.email?.split('@')[0] || 'User'}
                      </p>
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
                        {role === 'leader' ? '👑 Leader' : role === 'co-leader' ? '🛡 Co-Lead' : 'Member'}
                      </p>

                      {/* Calendar button */}
                      {isMe && (
                        <GoogleCalendarButton userId={m.userId} compact />
                      )}

                      {/* Context menu trigger (leader only, on non-leader members) */}
                      {isLeader && role !== 'leader' && (
                        <div className="relative" ref={menuOpen ? menuRef : undefined}>
                          <button
                            onClick={() => setMenuOpenFor(menuOpen ? null : m.userId)}
                            className="text-gray-400 hover:text-gray-700 transition-colors"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                          {menuOpen && (
                            <div className="absolute left-full top-0 ml-1 w-36 bg-white rounded-xl shadow-lg border border-gray-100 z-30 overflow-hidden">
                              {role === 'member' ? (
                                <button
                                  onClick={() => makeCoLeader(m.userId)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-800 hover:bg-blue-50 transition-colors"
                                >
                                  <Star className="w-3 h-3 text-blue-500" />
                                  Make Co-Leader
                                </button>
                              ) : (
                                <button
                                  onClick={removeCoLeader}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-800 hover:bg-red-50 transition-colors"
                                >
                                  <X className="w-3 h-3 text-red-400" />
                                  Remove Co-Leader
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Co-leader can promote to leader */}
                      {isCoLeader && isMe && (
                        <button
                          onClick={promoteToLeader}
                          className="text-[9px] font-bold text-blue-500 hover:text-blue-700 transition-colors mt-0.5"
                        >
                          Become Leader
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Bottom actions */}
          <div className="p-3 space-y-2 mt-auto pb-4">
            <button
              onClick={onLeaveTeam}
              className="w-full flex items-center justify-center flex-col gap-1 py-2 bg-[#ff3b3b] hover:bg-red-600 text-white rounded-xl text-[10px] font-semibold shadow-sm transition-transform active:scale-95"
            >
              <XCircle className="w-4 h-4 mb-0.5" /> Cancel Planning
            </button>
            <button
              onClick={onAddMember}
              className="w-full flex items-center justify-center flex-col gap-1 py-2 bg-[#3b82f6] hover:bg-blue-600 text-white rounded-xl text-[10px] font-semibold shadow-sm transition-transform active:scale-95"
            >
              <UserPlus className="w-4 h-4 mb-0.5" /> Add Member
            </button>
          </div>
        </aside>

        {/* Main area */}
        <section className="flex-1 flex flex-col bg-white overflow-hidden relative">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 z-10 bg-white">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{teamDetail.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-sm text-gray-500">{teamDetail.members.length} members</p>
                {coLeaderId && (
                  <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                    Co-Leader assigned
                  </span>
                )}
              </div>
            </div>

            {/* Plan Action — visible to all, but styled for leaders */}
            {(isLeader || isCoLeader) && (
              hasStartedPlanning && generatedPlan ? (
                <button
                  onClick={() => window.location.href = '/approve'}
                  className="flex items-center gap-1.5 bg-green-600 hover:bg-green-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-md transition-all duration-200 active:scale-95 animate-pulse"
                >
                  <Star className="w-3.5 h-3.5" /> Review & Approve Plan
                </button>
              ) : !hasStartedPlanning ? (
                <button
                  onClick={startPlanning}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-md transition-all duration-200 active:scale-95"
                >
                  <Rocket className="w-3.5 h-3.5" /> Start Planning
                </button>
              ) : null
            )}
            
            {(!isLeader && !isCoLeader && generatedPlan) && (
              <button
                onClick={() => window.location.href = '/approve'}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-md transition-all duration-200 active:scale-95"
              >
                 Vote on Plan
              </button>
            )}
          </div>

          {/* Central Area: Chat or specific stage UI */}
          <div className="flex-1 overflow-hidden relative bg-white flex flex-col">
            {(stage === 'chat' || stage === 'plan' || stage === 'approve') ? (
              <TeamChatPanel teamId={activeTeamId} user={user} />
            ) : stage === 'travel' ? (
              <div className="flex-1 overflow-y-auto px-5 py-4">
                <h2 className="text-lg font-semibold text-gray-900">Today & trip record</h2>
                <p className="text-sm text-travel-muted mt-1">Checklist and links from your saved pricing.</p>
                <div className="mt-4">
                  <TravelDayItinerary items={panelItems} compact />
                </div>
              </div>
            ) : stage === 'return' ? (
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">Memory + content builder</h2>
                <p className="text-sm text-travel-muted">
                  Upload trip photos in the full profile editor or paste context into the AI Assistant for captions and post ideas.
                </p>
                <ul className="text-sm text-gray-700 space-y-2 list-disc pl-4">
                  <li>Instagram-ready captions</li>
                  <li>LinkedIn post variants</li>
                  <li>Export as plain text</li>
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    );
  }

  // ── GROUPS LIST ────────────────────────────────────────────────────────────
  return (
    <div className="relative h-full min-h-[70vh]">
      <div className="flex items-center justify-between mb-8 px-1 mt-2">
        <h2 className="text-2xl font-bold text-[#111827]">Groups</h2>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="w-10 h-10 rounded-full bg-[#4c3a7e] flex items-center justify-center text-white shadow-md hover:bg-[#3a2c63] transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {err && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div>
      )}

      {teams.length === 0 ? (
        <div className="text-center py-20 text-gray-500 text-sm font-medium">
          No groups yet. Click the + button to create one.
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTeamId(t.id)}
              className="w-full flex items-center gap-4 bg-transparent border border-gray-200 rounded-[1.25rem] p-4 transition-all hover:bg-white hover:shadow-sm"
            >
              <div className="w-[3.25rem] h-[3.25rem] rounded-full bg-gradient-to-br from-[#4472fa] to-[#a445f6] flex items-center justify-center shadow flex-shrink-0">
                <Users className="w-[1.625rem] h-[1.625rem] text-white/90" />
              </div>
              <div className="flex-1 text-left min-w-0 flex flex-col justify-center">
                <h3 className="text-base font-bold text-gray-900 truncate leading-tight mb-1">{t.name}</h3>
                <p className="text-[13px] font-medium text-[#64748b] leading-tight">{t.memberCount} {t.memberCount === 1 ? 'member' : 'members'}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 bg-white rounded-3xl shadow-[0_10px_40px_-5px_rgba(0,0,0,0.3)] p-6 z-50 animate-in fade-in zoom-in duration-200">
          <button
            onClick={() => setIsCreateOpen(false)}
            className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <h3 className="text-xl font-bold text-gray-900 mb-6 pr-8">Create Group</h3>
          <form onSubmit={onCreateTeam} className="space-y-4">
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Enter group name..."
              autoFocus
              className="w-full border-2 border-blue-500 rounded-[1rem] px-4 py-3 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none shadow-sm font-medium"
            />
            <button
              type="submit"
              disabled={busy || !createName.trim()}
              className="w-full bg-[#a855f7] hover:bg-purple-600 text-white font-bold text-[15px] py-3.5 rounded-2xl shadow-md disabled:opacity-50 transition-colors"
            >
              {busy ? 'Creating...' : 'Create Group'}
            </button>
          </form>
        </div>
      )}
      {isCreateOpen && (
        <div
          className="fixed inset-0 min-h-screen min-w-[100vw] -ml-[100vw] ml-[-50vw] left-1/2 -mt-[50vh] bg-gray-600/40 z-40"
          style={{ backdropFilter: 'blur(1px)' }}
          onClick={() => setIsCreateOpen(false)}
        />
      )}
    </div>
  );
}
