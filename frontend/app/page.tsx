import Link from 'next/link';

const journey = [
  {
    title: 'Before the Trip',
    detail: 'Generate requirements, policy-aware checklist, and clear booking tradeoffs.',
  },
  {
    title: 'Approval',
    detail: 'Prepare approval packages, show status clearly, and surface fast fixes when blocked.',
  },
  {
    title: 'During Travel',
    detail: 'Handle delays/cancellations with concise options and escalation when risk increases.',
  },
  {
    title: 'Return',
    detail: 'Close the loop with follow-ups for expenses, feedback, and compliance items.',
  },
];

export default function Page() {
  return (
    <main className="min-h-dvh bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-5xl px-6 py-14">
        <header className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">HackKU · Lockton Track</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
            Intelligent Travel Companion Copilot
          </h1>
          <p className="mt-3 text-sm text-gray-600 max-w-3xl">
            Everything a business traveler needs before, during, and after the trip in one trusted assistant.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/home"
              className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Open Travel Companion
            </Link>
            <Link
              href="/assistant"
              className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              Open AI Assistant
            </Link>
          </div>
        </header>

        <section className="mt-8 grid gap-3 sm:grid-cols-2">
          {journey.map((row) => (
            <article key={row.title} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900">{row.title}</h2>
              <p className="mt-1.5 text-sm text-gray-600">{row.detail}</p>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">What This Demo Prioritizes</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-gray-700">
            <li>- Traveler stress reduction with clear, staged guidance.</li>
            <li>- Approval clarity with reasons, timelines, and fix suggestions.</li>
            <li>- Crisis triage with escalation paths when issues become high risk.</li>
            <li>- Privacy-by-design context minimization and sensitive-data exclusion.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
