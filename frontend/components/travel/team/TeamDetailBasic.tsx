'use client';

import type { ReactNode } from 'react';
import type { TeamDetail, TeamTripContext } from '@/lib/api';
import TeamMembersBasic from '@/components/travel/team/TeamMembersBasic';
import TeamActionsBasic from '@/components/travel/team/TeamActionsBasic';

function tripSourceLabel(source: TeamTripContext['tripContextSource']) {
  if (source === 'user') return 'Saved';
  if (source === 'inferred') return 'Inferred';
  if (source === 'mixed') return 'Mixed';
  if (source === 'demo_docs') return 'Demo defaults';
  return source || '';
}

export default function TeamDetailBasic({
  team,
  detailLoading,
  busy,
  onBack,
  onAddMember,
  onLeaveTeam,
  children,
}: {
  team: TeamDetail;
  detailLoading: boolean;
  busy: boolean;
  onBack: () => void;
  onAddMember: () => void;
  onLeaveTeam: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onBack}
        className="text-xs font-semibold text-blue-600 hover:underline"
      >
        Back to teams
      </button>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{team.name}</h2>
          <p className="text-xs text-travel-muted">{team.members.length} members</p>
          {team.tripContext ? (
            <p className="text-xs text-gray-700 mt-1">
              {team.tripContext.tripDestination || 'No destination'} · {team.tripContext.tripStartDate || '—'} →{' '}
              {team.tripContext.tripEndDate || '—'}
              {team.tripContext.tripContextSource ? ` · ${tripSourceLabel(team.tripContext.tripContextSource)}` : ''}
            </p>
          ) : null}
        </div>

        {detailLoading ? (
          <p className="text-xs text-travel-muted">Loading team details…</p>
        ) : (
          <TeamMembersBasic members={team.members} />
        )}

        <TeamActionsBasic busy={busy} onAddMember={onAddMember} onLeaveTeam={onLeaveTeam} />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm min-h-[45vh] relative">
        {children}
      </section>
    </div>
  );
}
