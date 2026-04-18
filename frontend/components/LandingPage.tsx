'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { useRef } from 'react';

interface LandingPageProps {
  children?: React.ReactNode;
}

const stages = [
  { id: 'plan', label: 'Plan', color: 'text-blue-300', bg: 'bg-blue-500/10 border-blue-500/20' },
  { id: 'approve', label: 'Approve', color: 'text-violet-300', bg: 'bg-violet-500/10 border-violet-500/20' },
  { id: 'travel', label: 'Travel', color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  { id: 'return', label: 'Return', color: 'text-orange-300', bg: 'bg-orange-500/10 border-orange-500/20' },
];

export default function LandingPage({ children }: LandingPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="min-h-screen bg-[#080a0f] text-slate-100 overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none opacity-[0.35] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/25 via-transparent to-transparent" />

      <motion.nav
        initial={{ y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.35 }}
        className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-[#080a0f]/85 backdrop-blur-md"
      >
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-blue-900/30">
              <span className="material-symbols-outlined text-xl">flight_takeoff</span>
            </div>
            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Lockton</p>
              <h2 className="text-base font-semibold tracking-tight">Travel Companion</h2>
            </div>
          </Link>
          <div className="hidden sm:flex items-center gap-8 text-sm text-slate-400">
            <a href="#journey" className="hover:text-white transition-colors">
              Journey
            </a>
            <a href="#experience" className="hover:text-white transition-colors">
              Experience
            </a>
            <div className="h-4 w-px bg-white/10" />
            <span className="text-xs text-slate-500">Enterprise · Mobile-first</span>
          </div>
          <div className="flex items-center gap-3">
            {children}
            {!children && (
              <Link
                href="/home"
                className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl text-sm font-semibold transition-colors shadow-lg shadow-blue-900/25"
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
              className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 mb-6"
            >
              Calm corporate travel
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="text-4xl sm:text-5xl font-semibold tracking-tight text-white mb-6"
            >
              From plan to return—without the stress spiral.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.12 }}
              className="text-lg text-slate-400 max-w-xl mx-auto mb-10 leading-relaxed"
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
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-center transition-colors"
              >
                Start planning
              </Link>
              <Link
                href="/dashboard"
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-white/10 text-slate-300 hover:bg-white/5 text-center text-sm font-medium transition-colors"
              >
                Legacy tools
              </Link>
            </motion.div>
          </div>
        </section>

        <section id="journey" className="px-5 pb-24">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500 mb-6 text-center">
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
                  className={`rounded-2xl border p-4 text-center ${s.bg}`}
                >
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${s.color}`}>{s.label}</p>
                  <p className="text-[11px] text-slate-500 leading-snug">
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
            <div className="rounded-[2rem] border border-white/[0.08] bg-[#0c0e14] shadow-2xl shadow-black/40 overflow-hidden">
              <div className="h-9 flex items-center justify-center gap-1.5 border-b border-white/[0.06] bg-black/30">
                <span className="h-2 w-2 rounded-full bg-white/20" />
                <span className="h-2 w-2 rounded-full bg-white/15" />
                <span className="h-2 w-2 rounded-full bg-white/10" />
              </div>
              <div className="p-6 space-y-4">
                <div className="flex rounded-xl overflow-hidden border border-white/[0.06] p-0.5 gap-0.5">
                  {stages.map((s) => (
                    <div key={s.id} className={`flex-1 text-center py-2 text-[10px] font-medium rounded-lg ${s.bg} ${s.color}`}>
                      {s.label}
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
                  <p className="text-xs text-slate-500 mb-1">Home</p>
                  <p className="text-sm text-white font-medium">Opportunities ready for approval</p>
                  <p className="text-xs text-slate-500 mt-2">Bottom tabs: Home · Explorer · AI · Team · Profile</p>
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

      <footer className="border-t border-white/[0.06] py-12 px-5 bg-black/20">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-slate-500">
          <p>Travel Companion — demo experience for Lockton-style enterprise travel.</p>
          <Link href="/support" className="text-slate-400 hover:text-white transition-colors">
            Support
          </Link>
        </div>
      </footer>
    </div>
  );
}
