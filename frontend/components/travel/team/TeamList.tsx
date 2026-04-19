'use client';

import { useState } from 'react';
import type { TeamSummary } from '@/lib/api';

export default function TeamList({
  teams,
  onSelect,
  onCreate,
  busy,
}: {
  teams: TeamSummary[];
  onSelect: (teamId: string) => void;
  onCreate: (name: string) => Promise<void>;
  busy: boolean;
}) {
  const [createName, setCreateName] = useState('');

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
        <h2 className="text-lg font-semibold text-gray-900">Create team</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const name = createName.trim();
            if (!name || busy) return;
            void onCreate(name);
            setCreateName('');
          }}
          className="flex gap-2"
        >
          <input
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Team name"
            className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900"
          />
          <button
            type="submit"
            disabled={busy || !createName.trim()}
            className="rounded-xl bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2"
          >
            Create
          </button>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-900">Your teams</h2>
        {teams.length === 0 ? (
          <p className="text-sm text-travel-muted">No teams yet. Create one to start planning together.</p>
        ) : (
          <div className="space-y-2">
            {teams.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(t.id)}
                className="w-full rounded-xl border border-gray-200 bg-white hover:bg-gray-50 px-3 py-3 text-left"
              >
                <p className="text-sm font-medium text-gray-900">{t.name}</p>
                <p className="text-xs text-travel-muted">
                  {t.memberCount} member{t.memberCount === 1 ? '' : 's'}
                  {t.tripContext?.tripDestination ? ` · ${t.tripContext.tripDestination}` : ''}
                </p>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
