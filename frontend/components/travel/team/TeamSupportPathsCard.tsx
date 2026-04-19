'use client';

import Link from 'next/link';

/** Shared “who helps when something goes wrong” block for Team support routes. */
export default function TeamSupportPathsCard() {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3 text-sm text-gray-700">
      <h2 className="text-base font-semibold text-gray-900">Support paths</h2>
      <p className="text-travel-muted">
        For delays, cancellations, hotel problems, or policy exceptions, start with a short impact summary, then route
        to the right channel — same flow as the issue panel on Home (Travel stage).
      </p>
      <ul className="list-disc list-inside space-y-1 text-travel-muted text-xs">
        <li>Log the disruption in Home → Travel &amp; issues so your team sees one timeline.</li>
        <li>Use Copilot for wording before you call a travel desk or manager.</li>
        <li>Escalate when self-service rebooking is exhausted or safety is involved.</li>
      </ul>
      <div className="flex flex-col gap-2 text-xs font-semibold">
        <Link href="/home?focus=upload" className="text-blue-600 hover:underline">
          Home (Plan) — documents &amp; context
        </Link>
        <Link href="/home" className="text-blue-600 hover:underline">
          Home — switch to Travel for incidents
        </Link>
        <Link
          href="/assistant?prefill=Draft%20a%20short%20escalation%20message%20for%20my%20travel%20desk%20including%20impact%2C%20urgency%2C%20and%20what%20I%20already%20tried."
          className="text-blue-600 hover:underline"
        >
          Copilot — escalation wording
        </Link>
      </div>
    </section>
  );
}
