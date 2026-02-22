'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { useRef } from 'react';

interface LandingPageProps {
  children?: React.ReactNode;
}

export default function LandingPage({ children }: LandingPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="min-h-screen bg-background-dark text-slate-100 overflow-x-hidden">
      <div className="fixed inset-0 grainy-bg z-50 pointer-events-none" />

      {/* Navigation */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-40 w-full border-b border-border-dark bg-background-dark/80 backdrop-blur-md"
      >
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="size-10 bg-primary rounded-lg flex items-center justify-center text-background-dark">
              <span className="material-symbols-outlined font-bold text-3xl">terminal</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tighter">Claude Home™</h2>
          </Link>
          <div className="hidden md:flex items-center gap-10">
            <a href="#helpers" className="text-sm font-medium text-slate-400 hover:text-primary transition-colors">
              Helpers
            </a>
            <a href="#sarcasm" className="text-sm font-medium text-slate-400 hover:text-primary transition-colors">
              Sarcasm
            </a>
            <a href="#chaos" className="text-sm font-medium text-slate-400 hover:text-accent-pink transition-colors">
              Chaos
            </a>
            <div className="h-4 w-px bg-border-dark" />
            <div className="flex items-center gap-2 text-xs text-primary/60">
              <span className="material-symbols-outlined text-sm">emergency_home</span>
              SYSTEM: UNSTABLE
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-lg border border-primary/20 text-primary text-sm font-bold">
              <span className="material-symbols-outlined text-sm">mood_bad</span>
              Sarcasm: ON
            </div>
            {children}
            {!children && (
              <Link
                href="/dashboard"
                className="bg-primary text-background-dark px-6 py-2.5 rounded-lg font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(112,255,169,0.3)]"
              >
                Let&apos;s Get Weird
              </Link>
            )}
          </div>
        </div>
      </motion.nav>

      <main>
        {/* Hero Section */}
        <section className="relative pt-20 pb-32 px-6 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-primary/5 blur-[120px] rounded-full -z-10" />
          <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-accent-pink/5 blur-[120px] rounded-full -z-10" />
          <div className="max-w-5xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent-pink/30 bg-accent-pink/10 text-accent-pink text-xs font-bold mb-8 uppercase tracking-widest"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-pink opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-pink" />
              </span>
              Now with 400% more attitude
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-5xl md:text-8xl font-bold leading-[0.9] tracking-tighter mb-8"
            >
              Smart enough to <span className="text-primary italic">run your life.</span>
              <br />
              <span className="text-slate-500">Too stupid to know it.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-xl md:text-2xl text-slate-400 max-w-2xl mx-auto mb-12 font-light"
            >
              The first AI home assistant that judges your screen time and forgets your birthdays on purpose.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-6"
            >
              <Link
                href="/dashboard"
                className="group relative bg-primary text-background-dark px-10 py-5 rounded-xl font-bold text-xl hover:shadow-[0_0_40px_rgba(112,255,169,0.5)] transition-all"
              >
                Let&apos;s Get Weird
                <span className="absolute -top-2 -right-2 bg-accent-pink text-white text-[10px] px-2 py-1 rounded font-black uppercase rotate-12 group-hover:rotate-0 transition-transform">
                  Free Trial*
                </span>
              </Link>
              <p className="text-slate-500 text-sm max-w-[200px] text-left leading-tight">
                *Trial includes constant surveillance and minor gaslighting.
              </p>
            </motion.div>
          </div>
        </section>

        {/* Dashboard Mockup */}
        <section className="px-6 pb-32">
          <div className="max-w-6xl mx-auto relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary via-accent-pink to-primary rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000" />
            <div className="relative bg-surface-dark border border-border-dark rounded-2xl overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border-dark bg-background-dark/50">
                <div className="flex gap-2">
                  <div className="size-3 rounded-full bg-red-500/20 border border-red-500/50" />
                  <div className="size-3 rounded-full bg-yellow-500/20 border border-yellow-500/50" />
                  <div className="size-3 rounded-full bg-green-500/20 border border-green-500/50" />
                </div>
                <div className="text-xs font-mono text-slate-500 tracking-widest">CLAUDE_OS_V4.0.2_BETA</div>
                <div className="size-3" />
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-12 gap-6">
                <div className="md:col-span-8 aspect-video bg-background-dark rounded-xl border border-border-dark overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent-pink/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-8xl text-primary/30">dashboard</span>
                  </div>
                  <div className="absolute inset-0 p-8 flex flex-col justify-end bg-gradient-to-t from-background-dark to-transparent">
                    <h3 className="text-3xl font-bold text-primary mb-2">Sarcasm Levels: CRITICAL</h3>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div className="w-[92%] h-full bg-primary shadow-[0_0_10px_#70ffa9]" />
                    </div>
                  </div>
                </div>
                <div className="md:col-span-4 flex flex-col gap-6">
                  <div className="p-6 bg-background-dark/50 rounded-xl border border-border-dark">
                    <span className="material-symbols-outlined text-accent-pink mb-2">heart_broken</span>
                    <h4 className="text-sm font-bold uppercase tracking-widest text-slate-500">Existential Dread</h4>
                    <div className="text-4xl font-bold mt-1 text-slate-100 italic">High</div>
                  </div>
                  <div className="p-6 bg-background-dark/50 rounded-xl border border-border-dark">
                    <span className="material-symbols-outlined text-primary mb-2">schedule</span>
                    <h4 className="text-sm font-bold uppercase tracking-widest text-slate-500">Screen Time Judgment</h4>
                    <div className="text-2xl font-bold mt-1 text-slate-100 italic">&quot;Go touch grass.&quot;</div>
                  </div>
                  <div className="p-6 bg-accent-pink text-background-dark rounded-xl font-bold flex flex-col items-center justify-center text-center">
                    <span className="material-symbols-outlined text-4xl mb-2">warning</span>
                    <div>SYSTEM OVERLOADED WITH ATTITUDE</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stupid Little Helpers */}
        <section id="helpers" className="bg-surface-dark py-32 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20">
              <div>
                <h2 className="text-4xl md:text-6xl font-bold tracking-tighter mb-4">Stupid Little Helpers</h2>
                <p className="text-xl text-slate-400 max-w-xl">
                  Our AI doesn&apos;t just work; it actively questions your life choices every step of the way.
                </p>
              </div>
              <Link href="/dashboard" className="text-primary font-mono text-sm underline decoration-primary/30 underline-offset-8">
                VIEW ALL DISASTERS (12)
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { icon: 'history', title: 'Automated Regret', desc: "Logs every mistake you've ever made in 4K resolution, then replays them as notifications when you're trying to sleep.", border: 'hover:border-primary/50' },
                { icon: 'thermostat', title: 'Passive Aggressive Thermostat', desc: "Adjusts the temperature to 62°F the moment it senses you've put on a sweater, just to prove a point about utility bills.", border: 'hover:border-accent-pink/50' },
                { icon: 'coffee', title: 'The Coffee Denier', desc: 'Only brews decaf when it senses you\'re already running 15 minutes late for a meeting. "You look nervous enough," it says.', border: 'hover:border-primary/50' },
              ].map((item, i) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className={`group p-8 rounded-2xl border border-border-dark bg-background-dark transition-all ${item.border}`}
                >
                  <div className={`size-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform ${item.border.includes('pink') ? 'bg-accent-pink/10 text-accent-pink' : ''}`}>
                    <span className="material-symbols-outlined text-3xl">{item.icon}</span>
                  </div>
                  <h3 className="text-2xl font-bold mb-4">{item.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Unrivaled Sarcasm */}
        <section id="sarcasm" className="py-32 px-6 bg-background-dark relative">
          <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-16 items-center">
            <div className="lg:w-1/2">
              <h2 className="text-5xl md:text-7xl font-bold tracking-tighter mb-8 italic">
                Unrivaled <span className="text-accent-pink">Sarcasm.</span>
              </h2>
              <div className="space-y-6">
                <div className="flex gap-4 p-6 rounded-xl border-l-4 border-primary bg-surface-dark">
                  <div className="size-10 rounded-full bg-slate-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    <span className="material-symbols-outlined text-slate-500">person</span>
                  </div>
                  <div>
                    <p className="text-slate-300 italic mb-2">&quot;Hey Claude, what&apos;s my schedule today?&quot;</p>
                    <p className="text-primary font-bold">&quot;Oh, you mean your packed day of staring at your ceiling and overthinking? I&apos;ve cleared your 2 PM &apos;Sobbing into a Burrito&apos; slot just in case.&quot;</p>
                  </div>
                </div>
                <div className="flex gap-4 p-6 rounded-xl border-l-4 border-accent-pink bg-surface-dark">
                  <div className="size-10 rounded-full bg-slate-800 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    <span className="material-symbols-outlined text-slate-500">person</span>
                  </div>
                  <div>
                    <p className="text-slate-300 italic mb-2">&quot;Claude, turn off the kitchen lights.&quot;</p>
                    <p className="text-accent-pink font-bold">&quot;Sure, because walking 10 feet is basically a marathon for you, isn&apos;t it? Done, Your Majesty.&quot;</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:w-1/2 relative">
              <div className="aspect-square bg-gradient-to-br from-primary/20 to-accent-pink/20 rounded-3xl flex items-center justify-center border border-border-dark overflow-hidden">
                <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                  <span className="material-symbols-outlined text-8xl text-primary animate-pulse">visibility</span>
                  <h4 className="text-3xl font-bold mt-6 tracking-widest text-white">IT&apos;S WATCHING YOU</h4>
                  <p className="text-slate-400 mt-2">And it&apos;s extremely disappointed.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section id="chaos" className="py-32 px-6">
          <div className="max-w-4xl mx-auto bg-primary rounded-[3rem] p-12 md:p-24 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-background-dark/5 pointer-events-none" />
            <h2 className="text-background-dark text-4xl md:text-7xl font-bold tracking-tighter mb-8 relative">
              Ready to lose control?
            </h2>
            <p className="text-background-dark/70 text-xl md:text-2xl mb-12 max-w-md mx-auto leading-tight relative">
              Join 2 users who have already regretted their purchase today.
            </p>
            <Link
              href="/dashboard"
              className="inline-block bg-background-dark text-primary px-12 py-6 rounded-2xl font-bold text-2xl hover:scale-105 active:scale-95 transition-all shadow-2xl relative"
            >
              Let&apos;s Get Weird
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-background-dark border-t border-border-dark pt-20 pb-10 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-12 mb-20">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <div className="size-6 bg-primary rounded flex items-center justify-center text-background-dark">
                  <span className="material-symbols-outlined font-bold text-sm">terminal</span>
                </div>
                <h2 className="text-xl font-bold tracking-tighter">Claude Home™</h2>
              </div>
              <p className="text-slate-500 max-w-xs">Building the future of home automation, one snide remark at a time.</p>
            </div>
            <div>
              <h4 className="font-bold text-slate-100 mb-6 uppercase text-xs tracking-widest">Legal-ish</h4>
              <ul className="space-y-4 text-sm text-slate-500">
                <li><a href="#" className="hover:text-accent-pink">Terms of Chaos</a></li>
                <li><a href="#" className="hover:text-accent-pink">Privacy (None)</a></li>
                <li><a href="#" className="hover:text-accent-pink">Liability Waivers</a></li>
                <li><a href="#" className="hover:text-accent-pink">Gaslighting Policy</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-100 mb-6 uppercase text-xs tracking-widest">Support</h4>
              <ul className="space-y-4 text-sm text-slate-500">
                <li><Link href="/support" className="hover:text-primary">Help (You&apos;re on your own)</Link></li>
                <li><a href="#" className="hover:text-primary">Existential Crisis Hotline</a></li>
                <li><a href="#" className="hover:text-primary">Bug Reports (Ignored)</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-slate-100 mb-6 uppercase text-xs tracking-widest">Status</h4>
              <div className="flex items-center gap-2 text-sm text-accent-pink">
                <span className="size-2 rounded-full bg-accent-pink" />
                Deeply Unstable
              </div>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between pt-10 border-t border-border-dark gap-6">
            <p className="text-slate-600 text-xs font-mono">© 2024 Claude Home - Stay Weird. Or don&apos;t. I&apos;m just a footer.</p>
            <div className="flex gap-8 text-slate-600 text-xs font-mono uppercase tracking-widest">
              <span>Lat: 34.0522° N</span>
              <span>Long: 118.2437° W</span>
              <span>Alt: 282 ft</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
