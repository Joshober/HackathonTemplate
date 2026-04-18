'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { PlanningStage, TeamPlan } from '@/lib/travelTypes';

// ---------- co-leader storage helpers ----------
const CO_LEADER_KEY = (teamId: string) => `squad_coleader_${teamId}`;
const PLANNING_STAGE_KEY = (teamId: string) => `squad_planstage_${teamId}`;
const TEAM_PLAN_KEY = (teamId: string) => `squad_teamplan_${teamId}`;
const MEMBER_VOTES_KEY = (teamId: string) => `squad_votes_${teamId}`;
const LEADER_APPROVED_KEY = (teamId: string) => `squad_leaderapproved_${teamId}`;
const HAS_STARTED_PLANNING_KEY = (teamId: string) => `squad_started_${teamId}`;

function ls(key: string): string | null {
  try { return typeof window !== 'undefined' ? localStorage.getItem(key) : null; } catch { return null; }
}
function lsSet(key: string, val: string) {
  try { if (typeof window !== 'undefined') localStorage.setItem(key, val); } catch { /* */ }
}
function lsDel(key: string) {
  try { if (typeof window !== 'undefined') localStorage.removeItem(key); } catch { /* */ }
}

// ---------- types ----------
export type MemberVote = 'approve' | 'reject';

interface TeamPlanningContextValue {
  /** The userId of the co-leader (or null). Set by the leader. */
  coLeaderId: string | null;
  setCoLeader: (userId: string | null) => void;

  /** Which planning sub-stages are unlocked */
  unlockedStages: Set<PlanningStage>;
  unlockStage: (stage: PlanningStage) => void;

  /** AI-generated plan (set by Sage after trigger phrase) */
  generatedPlan: TeamPlan | null;
  setGeneratedPlan: (plan: TeamPlan) => void;

  /** Per-member votes: userId → vote */
  memberVotes: Record<string, MemberVote>;
  setVote: (userId: string, vote: MemberVote) => void;

  /** Final approval by leader or co-leader */
  leaderApproved: boolean;
  setLeaderApproved: (v: boolean) => void;

  /** Helper: is a given userId a leader or co-leader? */
  canFinalApprove: (userId: string, leaderId: string) => boolean;

  /** Reset all planning state for current team */
  resetPlanning: () => void;

  /** Active team id the context is bound to */
  activeTeamId: string | null;
  bindToTeam: (teamId: string | null) => void;

  /** True if the team has started the planning flow */
  hasStartedPlanning: boolean;
  startPlanning: () => void;
}

const TeamPlanningContext = createContext<TeamPlanningContextValue | null>(null);

const ALL_STAGES: PlanningStage[] = ['chat', 'plan', 'approve', 'travel', 'return'];

function parseStages(raw: string | null): Set<PlanningStage> {
  if (!raw) return new Set<PlanningStage>(['chat', 'plan']);
  try {
    const arr = JSON.parse(raw) as PlanningStage[];
    return new Set(arr.filter((s) => ALL_STAGES.includes(s)));
  } catch { return new Set<PlanningStage>(['chat', 'plan']); }
}

export function TeamPlanningProvider({ children }: { children: ReactNode }) {
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [coLeaderId, setCoLeaderIdState] = useState<string | null>(null);
  const [unlockedStages, setUnlockedStages] = useState<Set<PlanningStage>>(new Set(['chat', 'plan']));
  const [generatedPlan, setGeneratedPlanState] = useState<TeamPlan | null>(null);
  const [memberVotes, setMemberVotesState] = useState<Record<string, MemberVote>>({});
  const [leaderApproved, setLeaderApprovedState] = useState(false);
  const [hasStartedPlanning, setHasStartedPlanningState] = useState(false);

  // Hydrate from localStorage when team changes
  useEffect(() => {
    if (!activeTeamId) return;
    setCoLeaderIdState(ls(CO_LEADER_KEY(activeTeamId)));
    setUnlockedStages(parseStages(ls(PLANNING_STAGE_KEY(activeTeamId))));
    const planRaw = ls(TEAM_PLAN_KEY(activeTeamId));
    setGeneratedPlanState(planRaw ? JSON.parse(planRaw) : null);
    const votesRaw = ls(MEMBER_VOTES_KEY(activeTeamId));
    setMemberVotesState(votesRaw ? JSON.parse(votesRaw) : {});
    setLeaderApprovedState(ls(LEADER_APPROVED_KEY(activeTeamId)) === 'true');
    setHasStartedPlanningState(ls(HAS_STARTED_PLANNING_KEY(activeTeamId)) === 'true');
  }, [activeTeamId]);

  const bindToTeam = useCallback((teamId: string | null) => {
    setActiveTeamId(teamId);
  }, []);

  const setCoLeader = useCallback((userId: string | null) => {
    setCoLeaderIdState(userId);
    if (activeTeamId) {
      if (userId) lsSet(CO_LEADER_KEY(activeTeamId), userId);
      else lsDel(CO_LEADER_KEY(activeTeamId));
    }
  }, [activeTeamId]);

  const unlockStage = useCallback((stage: PlanningStage) => {
    setUnlockedStages((prev) => {
      const next = new Set(prev);
      next.add(stage);
      if (activeTeamId) lsSet(PLANNING_STAGE_KEY(activeTeamId), JSON.stringify([...next]));
      return next;
    });
  }, [activeTeamId]);

  const setGeneratedPlan = useCallback((plan: TeamPlan) => {
    setGeneratedPlanState(plan);
    if (activeTeamId) lsSet(TEAM_PLAN_KEY(activeTeamId), JSON.stringify(plan));
  }, [activeTeamId]);

  const setVote = useCallback((userId: string, vote: MemberVote) => {
    setMemberVotesState((prev) => {
      const next = { ...prev, [userId]: vote };
      if (activeTeamId) lsSet(MEMBER_VOTES_KEY(activeTeamId), JSON.stringify(next));
      return next;
    });
  }, [activeTeamId]);

  const setLeaderApproved = useCallback((v: boolean) => {
    setLeaderApprovedState(v);
    if (activeTeamId) lsSet(LEADER_APPROVED_KEY(activeTeamId), String(v));
    if (v && activeTeamId) {
      setUnlockedStages((prev) => {
        const next = new Set(prev);
        next.add('travel');
        next.add('return');
        lsSet(PLANNING_STAGE_KEY(activeTeamId), JSON.stringify([...next]));
        return next;
      });
    }
  }, [activeTeamId]);

  const canFinalApprove = useCallback((userId: string, leaderId: string) => {
    return userId === leaderId || userId === coLeaderId;
  }, [coLeaderId]);

  const startPlanning = useCallback(() => {
    setHasStartedPlanningState(true);
    if (activeTeamId) lsSet(HAS_STARTED_PLANNING_KEY(activeTeamId), 'true');
  }, [activeTeamId]);

  const resetPlanning = useCallback(() => {
    if (!activeTeamId) return;
    lsDel(CO_LEADER_KEY(activeTeamId));
    lsDel(PLANNING_STAGE_KEY(activeTeamId));
    lsDel(TEAM_PLAN_KEY(activeTeamId));
    lsDel(MEMBER_VOTES_KEY(activeTeamId));
    lsDel(LEADER_APPROVED_KEY(activeTeamId));
    lsDel(HAS_STARTED_PLANNING_KEY(activeTeamId));
    setCoLeaderIdState(null);
    setUnlockedStages(new Set(['chat', 'plan']));
    setGeneratedPlanState(null);
    setMemberVotesState({});
    setLeaderApprovedState(false);
    setHasStartedPlanningState(false);
  }, [activeTeamId]);

  const value = useMemo<TeamPlanningContextValue>(() => ({
    coLeaderId,
    setCoLeader,
    unlockedStages,
    unlockStage,
    generatedPlan,
    setGeneratedPlan,
    memberVotes,
    setVote,
    leaderApproved,
    setLeaderApproved,
    canFinalApprove,
    resetPlanning,
    activeTeamId,
    bindToTeam,
    hasStartedPlanning,
    startPlanning,
  }), [
    coLeaderId, setCoLeader, unlockedStages, unlockStage, generatedPlan, setGeneratedPlan,
    memberVotes, setVote, leaderApproved, setLeaderApproved, canFinalApprove, resetPlanning,
    activeTeamId, bindToTeam, hasStartedPlanning, startPlanning,
  ]);

  return (
    <TeamPlanningContext.Provider value={value}>
      {children}
    </TeamPlanningContext.Provider>
  );
}

export function useTeamPlanning() {
  const ctx = useContext(TeamPlanningContext);
  if (!ctx) throw new Error('useTeamPlanning must be used within TeamPlanningProvider');
  return ctx;
}
