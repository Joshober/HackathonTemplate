'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { useRef } from 'react';
import { Plane } from 'lucide-react';

interface LandingPageProps {
  children?: React.ReactNode;
}

const stages = [
  { id: 'plan', label: 'Plan', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  { id: 'approve', label: 'Approve', color: 'text-violet-700', bg: 'bg-violet-50 border-violet-200' },
  { id: 'travel', label: 'Travel', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  { id: 'return', label: 'Return', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
];

export default function LandingPage({ children }: LandingPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="min-h-screen bg-gray-50 text-gray-900 overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none opacity-40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-100/80 via-transparent to-transparent" />

      <motion.nav
        initial={{ y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="sticky top-0 z-40 w-full border-b border-gray-200 glass-panel"
      >
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-blue-900/15">
              <Plane className="w-5 h-5" aria-hidden />
            </div>
            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Lockton</p>
              <h2 className="text-base font-semibold tracking-tight text-gray-900">Travel Companion</h2>
            </div>
          </Link>
          <div className="hidden sm:flex items-center gap-8 text-sm text-gray-500">
            <a href="#journey" className="hover:text-gray-900 transition-colors">
              Journey
            </a>
            <a href="#experience" className="hover:text-gray-900 transition-colors">
              Experience
            </a>
            <div className="h-4 w-px bg-gray-200" />
            <span className="text-xs text-gray-400">Enterprise · Mobile-first</span>
          </div>
          <div className="flex items-center gap-3">
            {children}
            {!children && (
              <Link
                href="/home"
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors shadow-md shadow-blue-900/10"
              >
                Open app
              </Link>
            )}
          </div>
        </div>
      </motion.nav>

      <main>
        <section className="relative pt-16 pb-24 px-5">
          <div className="max-w-3xl mx-auto text-center">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-500 mb-6"
            >
              Calm corporate travel
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="text-4xl sm:text-5xl font-semibold tracking-tight text-gray-900 mb-6"
            >
              From plan to return—without the stress spiral.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.12 }}
              className="text-lg text-gray-600 max-w-xl mx-auto mb-10 leading-relaxed"
            >
              A modern mobile web experience for enterprise employees: clear stages, gentle progress, AI woven in—not
              bolted on the side.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link
                href="/home"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-center transition-colors shadow-lg shadow-blue-900/15"
              >
                Start planning
              </Link>
            </motion.div>
          </div>
        </section>

        <section id="journey" className="px-5 pb-24">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-6 text-center">
              Four-stage journey
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {stages.map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className={`rounded-2xl border p-4 text-center shadow-sm bg-white ${s.bg}`}
                >
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${s.color}`}>{s.label}</p>
                  <p className="text-[11px] text-gray-500 leading-snug">
                    {s.id === 'plan' && 'Explore, shortlist, submit'}
                    {s.id === 'approve' && 'Approvals & booking options'}
                    {s.id === 'travel' && 'Vote, calendars, logistics'}
                    {s.id === 'return' && 'Share wins & memories'}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="experience" className="px-5 pb-28">
          <div className="max-w-md mx-auto">
            <div className="rounded-[2rem] border border-gray-200 bg-white shadow-2xl shadow-gray-900/10 overflow-hidden shine-overlay">
              <div className="h-9 flex items-center justify-center gap-1.5 border-b border-gray-100 bg-gray-50">
                <span className="h-2 w-2 rounded-full bg-gray-300" />
                <span className="h-2 w-2 rounded-full bg-gray-200" />
                <span className="h-2 w-2 rounded-full bg-gray-100" />
              </div>
              <div className="p-6 space-y-4">
                <div className="flex rounded-xl overflow-hidden border border-gray-200 p-0.5 gap-0.5 bg-gray-50">
                  {stages.map((s) => (
                    <div key={s.id} className={`flex-1 text-center py-2 text-[10px] font-medium rounded-lg border ${s.bg} ${s.color}`}>
                      {s.label}
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-xs text-gray-500 mb-1">Home</p>
                  <p className="text-sm text-gray-900 font-medium">Opportunities ready for approval</p>
                  <p className="text-xs text-gray-500 mt-2">Bottom tabs: Home · Explorer · AI · Team · More</p>
                </div>
                <Link
                  href="/home"
                  className="block w-full text-center py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500"
                >
                  Enter Travel Companion
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 py-12 px-5 bg-white/80">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-gray-500">
          <p>Travel Companion — demo experience for Lockton-style enterprise travel.</p>
          <Link href="/assistant" className="text-gray-600 hover:text-gray-900 transition-colors font-medium">
            AI assistant
          </Link>
        </div>
      </footer>
    </div>
  );
}
