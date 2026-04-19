'use client';

import Link from 'next/link';

export default function ExplorePostTripTab() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3 text-sm text-gray-700">
      <h2 className="text-lg font-semibold text-gray-900">Post-trip</h2>
      <p className="text-travel-muted">
        Submit expenses, capture feedback, and clear follow-up tasks. Your authoritative checklist still lives on Home
        (Return), while Explore keeps the narrative in one place for judges.
      </p>
      <ul className="list-disc list-inside space-y-1 text-xs text-travel-muted">
        <li>Submit receipts before internal deadlines.</li>
        <li>Confirm any open compliance or manager follow-ups.</li>
      </ul>
      <div className="flex flex-wrap gap-3 text-xs font-semibold">
        <Link href="/home" className="text-blue-600 hover:underline">
          Home — Return stage
        </Link>
        <Link
          href="/assistant?prefill=What%20post-trip%20tasks%20am%20I%20still%20missing%20based%20on%20my%20saved%20trips%3F"
          className="text-blue-600 hover:underline"
        >
          Ask Copilot
        </Link>
      </div>
    </div>
  );
}
