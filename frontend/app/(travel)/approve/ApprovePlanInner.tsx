'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTeamPlanning } from '@/lib/teamPlanningContext';
import { useTravelAuth } from '@/components/travel/useTravelAuth';
import { api } from '@/lib/api';
import { useEffect, useState } from 'react';
import type { TeamDetail } from '@/lib/api';
import {
  CheckCircle2, XCircle, Crown,
  Shield, ThumbsUp, ThumbsDown, Loader2, AlertCircle,
  Sparkles, ChevronDown, ChevronUp, ArrowRight,
} from 'lucide-react';
import ApprovalGuidancePanel from '@/components/travel/workflow/ApprovalGuidancePanel';

export default function ApprovePlanInner() {
  const { user, loading } = useTravelAuth();
  const {
    generatedPlan, memberVotes, setVote, leaderApproved, setLeaderApproved,
    canFinalApprove, coLeaderId, activeTeamId, unlockStage,
  } = useTeamPlanning();
  const router = useRouter();
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
  const [approving, setApproving] = useState(false);
  const [teamVoteOpen, setTeamVoteOpen] = useState(false);
  const [items, setItems] = useState<import('@/lib/api').Item[]>([]);

  useEffect(() => {
    if (!activeTeamId) return;
    api.getTeam(activeTeamId).then(setTeamDetail).catch(() => {});
  }, [activeTeamId]);

  useEffect(() => {
    api.getItems().then(setItems).catch(() => {});
  }, []);

  const leaderId = teamDetail?.createdBy ?? teamDetail?.members[0]?.userId ?? '';
  const currentUserId = user?.sub ?? '';
  const isAuthorized = canFinalApprove(currentUserId, leaderId);
  const myVote = memberVotes[currentUserId];

  const approveCount = Object.values(memberVotes).filter(v => v === 'approve').length;
  const rejectCount = Object.values(memberVotes).filter(v => v === 'reject').length;
  const totalVotes = Object.keys(memberVotes).length;

  const handleFinalApprove = async () => {
    setApproving(true);
    await new Promise(r => setTimeout(r, 800));
    setLeaderApproved(true);
    unlockStage('travel');
    setApproving(false);
    router.push('/travel-plan');
  };

  if (loading || !user) {
    return <div className="py-24 text-center text-sm text-gray-400">Signing you in…</div>;
  }

  return (
    <div className="space-y-4 pb-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Your Approval Status</h2>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-violet-400" />
            Copilot handles the approval process so you don't have to
          </p>
        </div>
        {leaderApproved && (
          <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-bold border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Team approved
          </div>
        )}
      </div>

      {/* HERO: Copilot Approval Panel — always first */}
      <ApprovalGuidancePanel items={items} onSaved={() => api.getItems().then(setItems).catch(() => {})} />

      {/* Ask Copilot CTA */}
      <Link
        href="/assistant?q=What+is+the+current+status+of+my+approval+and+what+are+the+next+steps%3F"
        className="flex items-center justify-between gap-2 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 hover:bg-violet-100 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-violet-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-violet-800">Ask Copilot about this approval</p>
            <p className="text-xs text-violet-600">Get plain-language explanations, fix suggestions, and next steps</p>
          </div>
        </div>
        <ArrowRight className="w-4 h-4 text-violet-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
      </Link>

      {/* Team plan section — collapsed by default */}
      {generatedPlan && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => setTeamVoteOpen((p) => !p)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
          >
            <div>
              <p className="text-sm font-semibold text-gray-900">Team plan sign-off</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {totalVotes} vote{totalVotes !== 1 ? 's' : ''} · {approveCount} approved · {rejectCount} rejected
              </p>
            </div>
            {teamVoteOpen ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
          </button>

          {teamVoteOpen && (
            <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-4">
              {/* Destination summary */}
              <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-700 rounded-xl px-4 py-3 text-white">
                <p className="text-base font-bold">{generatedPlan.destination}</p>
                <p className="text-xs opacity-80 mt-0.5">{generatedPlan.startDate} → {generatedPlan.endDate}</p>
                <p className="text-xs opacity-70 mt-1">
                  ${generatedPlan.budgetEstimateUSD.low.toLocaleString()}–${generatedPlan.budgetEstimateUSD.high.toLocaleString()} USD
                </p>
              </div>

              {/* Member votes */}
              {teamDetail ? (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Member votes</p>
                  {teamDetail.members.map(m => {
                    const mVote = memberVotes[m.userId];
                    const mIsLeader = m.userId === leaderId;
                    const mIsCoLeader = m.userId === coLeaderId;
                    const isMe = m.userId === currentUserId;

                    return (
                      <div key={m.userId} className={`flex items-center gap-3 p-2 rounded-xl transition-colors ${isMe ? 'bg-violet-50 border border-violet-100' : 'bg-gray-50'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0
                          ${mIsLeader ? 'bg-amber-100 text-amber-700' : mIsCoLeader ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>
                          {(m.displayName || m.email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-semibold text-gray-900 truncate">
                              {m.displayName?.split(' ')[0] || m.email?.split('@')[0] || 'User'}
                            </span>
                            {mIsLeader && <Crown className="w-3 h-3 text-amber-500 shrink-0" />}
                            {mIsCoLeader && <Shield className="w-3 h-3 text-blue-500 shrink-0" />}
                            {isMe && <span className="text-[9px] text-violet-500 font-bold">(you)</span>}
                          </div>
                        </div>
                        {isMe && !mVote ? (
                          <div className="flex gap-1.5 shrink-0">
                            <button
                              onClick={() => setVote(currentUserId, 'approve')}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500 text-white text-[11px] font-bold hover:bg-emerald-600 transition-colors"
                            >
                              <ThumbsUp className="w-3 h-3" /> Approve
                            </button>
                            <button
                              onClick={() => setVote(currentUserId, 'reject')}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-100 text-red-600 text-[11px] font-bold hover:bg-red-200 transition-colors border border-red-200"
                            >
                              <ThumbsDown className="w-3 h-3" /> Reject
                            </button>
                          </div>
                        ) : mVote ? (
                          <div className={`flex items-center gap-1 text-[11px] font-bold shrink-0 ${mVote === 'approve' ? 'text-emerald-600' : 'text-red-500'}`}>
                            {mVote === 'approve' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {mVote === 'approve' ? 'Approved' : 'Rejected'}
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-400 shrink-0">Pending…</span>
                        )}
                      </div>
                    );
                  })}

                  {/* Vote tally */}
                  {totalVotes > 0 && (
                    <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
                      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                          style={{ width: `${totalVotes > 0 ? (approveCount / totalVotes) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-emerald-600">{approveCount} ✓</span>
                      <span className="text-xs font-bold text-red-400">{rejectCount} ✗</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Loading members…</p>
              )}

              {/* Final approve */}
              {!leaderApproved ? (
                isAuthorized ? (
                  <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl px-4 py-3">
                    <h4 className="text-sm font-bold text-violet-800 mb-1 flex items-center gap-1.5">
                      <Crown className="w-4 h-4 text-amber-500" />
                      Final Approval
                    </h4>
                    <p className="text-xs text-violet-600 mb-3">
                      As {currentUserId === leaderId ? 'Team Leader' : 'Co-Leader'}, you have the final say. Approving unlocks the Travel itinerary.
                    </p>
                    <button
                      onClick={handleFinalApprove}
                      disabled={approving}
                      className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 text-white font-bold text-sm py-3 rounded-xl shadow-md transition-all duration-200 active:scale-[0.98] disabled:opacity-60"
                    >
                      {approving ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Approving…</>
                      ) : (
                        <><CheckCircle2 className="w-4 h-4" /> Give Final Approval &amp; Unlock Travel</>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-center">
                    <p className="text-xs text-gray-500">Waiting for the Team Leader or Co-Leader to give final approval.</p>
                  </div>
                )
              ) : (
                <div className="flex items-center justify-center gap-2 py-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <p className="text-sm font-bold text-emerald-700">Plan approved! Head to Travel →</p>
                  <button
                    onClick={() => router.push('/travel-plan')}
                    className="ml-2 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-colors"
                  >
                    View Itinerary
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* No plan yet — softer nudge */}
      {!generatedPlan && (
        <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-gray-600">No team plan generated yet</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Go to the{' '}
              <Link href="/plan" className="text-violet-600 font-semibold hover:underline">Plan room</Link>
              {' '}and say "I agree" when the agents finish discussing.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
