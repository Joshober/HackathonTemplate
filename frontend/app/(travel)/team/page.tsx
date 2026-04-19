'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  api,
  type TeamDetail,
  type TeamSummary,
  TRAVEL_ACTIVE_TEAM_STORAGE_KEY,
} from '@/lib/api';
import { useTravelAuth } from '@/components/travel/useTravelAuth';
import { useTeamPlanning } from '@/lib/teamPlanningContext';
import TeamList from '@/components/travel/team/TeamList';
import TeamDetailBasic from '@/components/travel/team/TeamDetailBasic';
import TeamChatPanel from '@/components/travel/TeamChatPanel';

export default function TeamPage() {
  const { user, loading } = useTravelAuth();
  const { bindToTeam } = useTeamPlanning();

  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    const { teams: rows } = await api.listTeams();
    setTeams(rows);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const remembered = localStorage.getItem(TRAVEL_ACTIVE_TEAM_STORAGE_KEY);
    setActiveTeamId(remembered || null);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setBootLoading(true);
    setErr(null);

    void (async () => {
      try {
        await api.syncUser();
        const { teams: rows } = await api.listTeams();
        if (cancelled) return;
        setTeams(rows);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Could not load teams');
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
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
    if (!activeTeamId) {
      setTeamDetail(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);

    void api
      .getTeam(activeTeamId)
      .then((detail) => {
        if (!cancelled) setTeamDetail(detail);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Could not load team details');
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTeamId]);

  const onCreateTeam = useCallback(
    async (name: string) => {
      if (busy) return;
      setBusy(true);
      setErr(null);
      try {
        const created = await api.createTeam({ name });
        await loadTeams();
        setActiveTeamId(created.id);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Could not create team');
      } finally {
        setBusy(false);
      }
    },
    [busy, loadTeams]
  );

  const onAddMember = useCallback(async () => {
    if (!activeTeamId || busy) return;
    const email = window.prompt("Enter member's email:");
    if (!email) return;

    setBusy(true);
    setErr(null);
    try {
      await api.addTeamMember(activeTeamId, email.trim().toLowerCase());
      const [detail] = await Promise.all([api.getTeam(activeTeamId), loadTeams()]);
      setTeamDetail(detail);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add member');
    } finally {
      setBusy(false);
    }
  }, [activeTeamId, busy, loadTeams]);

  const onLeaveTeam = useCallback(async () => {
    if (!activeTeamId || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await api.leaveTeam(activeTeamId);
      setActiveTeamId(null);
      setTeamDetail(null);
      await loadTeams();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not leave team');
    } finally {
      setBusy(false);
    }
  }, [activeTeamId, busy, loadTeams]);

  if (loading || !user) {
    return <div className="py-24 text-center text-travel-muted text-sm">Signing you in…</div>;
  }

  if (bootLoading) {
    return <div className="py-24 text-center text-travel-muted text-sm">Loading teams…</div>;
  }

  return (
    <div className="space-y-3">
      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div>
      ) : null}

      {activeTeamId && teamDetail ? (
        <TeamDetailBasic
          team={teamDetail}
          detailLoading={detailLoading}
          busy={busy}
          onBack={() => setActiveTeamId(null)}
          onAddMember={() => void onAddMember()}
          onLeaveTeam={() => void onLeaveTeam()}
        >
          <TeamChatPanel teamId={activeTeamId} user={user} />
        </TeamDetailBasic>
      ) : (
        <TeamList teams={teams} onSelect={setActiveTeamId} onCreate={onCreateTeam} busy={busy} />
      )}
    </div>
  );
}
