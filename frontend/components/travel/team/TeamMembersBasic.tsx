'use client';

import type { TeamMember } from '@/lib/api';

function memberLabel(member: TeamMember): string {
  return member.displayName?.trim() || member.email?.split('@')[0] || 'Team member';
}

export default function TeamMembersBasic({ members }: { members: TeamMember[] }) {
  if (!members.length) {
    return <p className="text-xs text-travel-muted">No members yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {members.map((m) => (
        <li key={m.userId} className="rounded-xl border border-gray-200 bg-white px-3 py-2">
          <p className="text-sm font-medium text-gray-900">{memberLabel(m)}</p>
          {m.email ? <p className="text-xs text-travel-muted">{m.email}</p> : null}
        </li>
      ))}
    </ul>
  );
}
