'use client';

export default function TeamActionsBasic({
  busy,
  onAddMember,
  onLeaveTeam,
}: {
  busy: boolean;
  onAddMember: () => void;
  onLeaveTeam: () => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      <button
        type="button"
        onClick={onAddMember}
        disabled={busy}
        className="rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2.5"
      >
        Add member
      </button>
      <button
        type="button"
        onClick={onLeaveTeam}
        disabled={busy}
        className="rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2.5"
      >
        Leave team
      </button>
    </div>
  );
}
