'use client';

import Link from 'next/link';

export default function ExploreHotelsTab() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Hotels</h2>
        <p className="text-sm text-travel-muted mt-1">
          Compare nightly rates and cancellation rules next to your flight quotes — same pipeline, with a hotel-first
          lens for where you sleep.
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50/90 p-3 text-xs text-gray-700 space-y-2">
        <p className="font-semibold text-gray-900">Common tradeoffs</p>
        <ul className="list-disc list-inside space-y-1 text-travel-muted">
          <li>Non-refundable rates vs flexible cancel — lower price vs change protection.</li>
          <li>Airport hotel vs downtown — time saved vs nightly cost and ground transport.</li>
          <li>Chain loyalty vs independent — perks vs unique location fit.</li>
        </ul>
      </div>

      <p className="text-sm text-gray-700">
        Live quotes and your team booking window live under{' '}
        <Link href="/explore/flights#approve-step-quotes" className="text-blue-600 font-medium hover:underline">
          Approve trips
        </Link>
        . Use Copilot from that tab to explain why one hotel option is better for policy or flexibility.
      </p>

      <Link
        href="/assistant?prefill=Compare%20hotel%20options%20for%20my%20saved%20trip%20focusing%20on%20cancellation%20flexibility%20vs%20price%20and%20typical%20corporate%20policy%20fit."
        className="inline-flex text-xs font-semibold text-blue-700 hover:underline"
      >
        Explain hotel tradeoffs in Copilot
      </Link>
    </div>
  );
}
