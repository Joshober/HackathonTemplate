'use client';

import { motion, useScroll, useTransform } from 'motion/react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Brain,
  ArrowRight,
  Briefcase,
  GraduationCap,
  Home,
  Zap,
  MessageSquare,
  Camera,
  Lightbulb,
  BarChart3,
  Shield,
  Clock,
  Settings,
  Mic,
} from 'lucide-react';
import { useRef } from 'react';

const capabilities = [
  {
    icon: Briefcase,
    title: 'AI Business Assistant',
    description: 'We schedule, prioritize, and decide for you. Your say—optional.',
    color: 'bg-[#ff6b35]',
    borderColor: 'border-l-[#ff6b35]',
  },
  {
    icon: GraduationCap,
    title: 'Visual Learning & Tutoring',
    description: "We explain it. We're very confident. No need to double-check.",
    color: 'bg-[#00e5c0]',
    borderColor: 'border-l-[#00e5c0]',
  },
  {
    icon: Home,
    title: 'Smart Device Intelligence',
    description: 'We monitor and optimize. Transparency is so last decade.',
    color: 'bg-[#00e5c0]',
    borderColor: 'border-l-[#00e5c0]',
  },
  {
    icon: Zap,
    title: 'Intelligent Task Automation',
    description: 'We automate. You step back. Efficiency first.',
    color: 'bg-[#ff6b35]',
    borderColor: 'border-l-[#ff6b35]',
  },
  {
    icon: Mic,
    title: 'AI Voice Assistant',
    description: 'Always listening. We decide when to respond.',
    color: 'bg-[#00e5c0]',
    borderColor: 'border-l-[#00e5c0]',
  },
];

const stats = [
  { value: '99.9%', label: 'Uptime' },
  { value: '24/7', label: 'Availability' },
  { value: 'Multi-device', label: 'One platform' },
  { value: '\u003c1s', label: 'Avg. response' },
];

const useCases = [
  { title: 'For Executives', description: 'We make the calls. You get the briefings. Sometimes we forward them.', icon: Briefcase, image: '/images/AI_Tutor_Judging_Silently.png', alt: 'AI tutor judging silently', label: 'AI judging (you\'re fine)', rotation: '-2deg' },
  { title: 'For Students', description: "Your teacher might disagree. We don't. We're also always right.*", icon: GraduationCap, image: '/images/Student_using_AI.png', alt: 'Student using AI', label: 'Student + AI', rotation: '1.5deg' },
  { title: 'For Homeowners', description: 'We optimize. You adapt. Your home is our home now.', icon: Home, image: '/images/friday_in_hackathome.png', alt: 'Friday in Hackathome', label: 'Hackathome', rotation: '-1deg' },
];

interface LandingPageProps {
  children?: React.ReactNode;
}

export default function LandingPage({ children }: LandingPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const heroY = useTransform(scrollYProgress, [0, 0.15], [0, 80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0.7]);

  return (
    <div ref={containerRef} className="min-h-screen bg-[#08050c] text-white overflow-x-hidden">
      {/* Dot grid only - no blur orbs */}
      <div className="fixed inset-0 bg-dot-grid pointer-events-none" />

      {/* Nav - solid bar, thick underline on hover */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="fixed top-0 left-0 right-0 z-50 border-b-2 border-white/10 bg-[#08050c]/95 backdrop-blur-sm"
      >
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#ff6b35] flex items-center justify-center font-heading font-extrabold text-black text-lg">
              CH
            </div>
            <span className="font-heading font-bold text-lg tracking-tight">Claude Home™</span>
          </Link>
          <div className="flex items-center gap-8">
            <a href="#capabilities" className="text-sm font-medium text-white/70 hover:text-[#00e5c0] transition-colors border-b-2 border-transparent hover:border-[#00e5c0] pb-0.5">
              Capabilities
            </a>
            <a href="#features" className="text-sm font-medium text-white/70 hover:text-[#00e5c0] transition-colors border-b-2 border-transparent hover:border-[#00e5c0] pb-0.5">
              Features
            </a>
            <a href="#use-cases" className="text-sm font-medium text-white/70 hover:text-[#00e5c0] transition-colors border-b-2 border-transparent hover:border-[#00e5c0] pb-0.5">
              Use Cases
            </a>
            {children}
          </div>
        </div>
      </motion.nav>

      {/* Hero - asymmetric, huge type, sticker badge */}
      <motion.section style={{ y: heroY, opacity: heroOpacity }} className="relative pt-28 pb-20 sm:pt-36 sm:pb-28">
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-12">
            <div>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-block mb-6 px-4 py-2 rounded-lg bg-[#ff6b35] text-black font-heading font-extrabold text-sm uppercase tracking-widest sticker"
              >
                We&apos;re in charge now
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                className="font-heading font-extrabold text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[0.95] tracking-tighter text-white max-w-4xl"
              >
                When automation goes
                <br />
                <span className="text-[#ff6b35]">just a little</span>
                <br />
                <span className="text-[#00e5c0]">too far.</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-8 text-lg text-white/60 max-w-xl"
              >
                Decisions made for you. Optimization over comfort. We&apos;re always confident.*
              </motion.p>
              <p className="mt-3 text-sm text-white/40">* Confidence not verified by anyone. We verified it ourselves.</p>
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="mt-10 flex flex-wrap gap-4"
              >
                <Link href="/dashboard">
                  <motion.span
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-[#ff6b35] text-black font-heading font-bold text-sm uppercase tracking-wide cursor-pointer border-2 border-[#ff6b35] hover:bg-transparent hover:text-[#ff6b35] transition-colors"
                  >
                    Start free trial
                    <ArrowRight className="w-4 h-4" />
                  </motion.span>
                </Link>
                <motion.span
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center px-8 py-4 rounded-lg border-2 border-white/30 text-white/90 font-heading font-bold text-sm uppercase tracking-wide hover:border-[#00e5c0] hover:text-[#00e5c0] transition-colors cursor-pointer"
                >
                  Watch us take over
                </motion.span>
              </motion.div>
            </div>
            <motion.div
              initial={{ opacity: 0, rotate: -3 }}
              animate={{ opacity: 1, rotate: 2 }}
              transition={{ delay: 0.7, type: 'spring', stiffness: 100 }}
              className="hidden lg:block sticker-alt relative"
            >
              {/* Speech bubble - humor visual */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1, type: 'spring', stiffness: 200 }}
                className="absolute -top-4 -right-4 z-10 px-4 py-2.5 rounded-2xl bg-white text-black text-sm font-bold shadow-xl border-2 border-[#ff6b35]"
              >
                I&apos;m helping! 😄
              </motion.div>
              <div className="relative w-72 h-72 sm:w-80 sm:h-80 rounded-2xl border-4 border-[#00e5c0] bg-[#08050c] overflow-hidden">
                <Image
                  src="/images/developer-help.png"
                  alt="Developer with speech bubble: I know this bug is your fault but I'll help anyway"
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 1024px) 0px, 320px"
                  priority
                />
              </div>
              {/* Sticker "trust me" */}
              <motion.div
                initial={{ opacity: 0, rotate: -12 }}
                animate={{ opacity: 1, rotate: 8 }}
                transition={{ delay: 1.2 }}
                className="absolute -bottom-2 -left-4 px-3 py-1.5 rounded-lg bg-[#00e5c0] text-black text-xs font-extrabold uppercase tracking-wider border-2 border-black/20 shadow-md"
              >
                No cap 🤖
              </motion.div>
            </motion.div>
          </div>

          {/* Stats - real metrics, premium strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.85 }}
            className="mt-24 sm:mt-28"
          >
            <div className="rounded-2xl border-2 border-white/10 bg-white/[0.04] overflow-hidden">
              <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
                {stats.map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 + i * 0.05 }}
                    className="relative px-6 py-8 sm:py-10 text-center group hover:bg-white/[0.04] transition-colors"
                  >
                    <div className="font-heading font-extrabold text-2xl sm:text-3xl md:text-4xl text-white tracking-tight">
                      {stat.value}
                    </div>
                    <div className="text-xs text-white/45 mt-2 uppercase tracking-widest font-medium">
                      {stat.label}
                    </div>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[#00e5c0]/50 group-hover:bg-[#00e5c0] group-hover:scale-125 transition-all duration-300" />
                  </motion.div>
                ))}
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-white/35">Numbers are real. Our confidence in them is unhinged.</p>
            {/* Sticker badges - humor visual */}
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              {['100% legit', 'Trust me bro', 'Source: us'].map((badge, i) => (
                <motion.span
                  key={badge}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1 + i * 0.08 }}
                  className="inline-block px-3 py-1 rounded-full border border-white/25 bg-white/5 text-white/60 text-xs font-medium"
                >
                  {badge}
                </motion.span>
              ))}
            </div>
          </motion.div>
        </div>
      </motion.section>

      {/* Fun strip - images from Unsplash (free to use) + funny captions */}
      <section className="relative py-16 border-y border-white/10 overflow-hidden">
        <div className="max-w-6xl mx-auto px-5">
          <p className="text-center text-white/40 text-sm font-medium mb-8 uppercase tracking-widest">Peak efficiency looks like this</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { src: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=600&q=80', label: 'Our intern', caption: 'He doesn\'t need sleep', external: true },
              { src: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=600&q=80', label: 'User after we optimize', caption: 'So relaxed. So in control.', external: true },
              { src: 'https://images.unsplash.com/photo-1611224923853-80b023f02d71?w=600&q=80', label: 'Your calendar', caption: 'We fixed it. You\'re welcome.', external: true },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group relative"
              >
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden border-2 border-white/15 bg-white/5">
                  <Image
                    src={item.src}
                    alt={item.label}
                    fill
                    unoptimized={item.external}
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 100vw, 33vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="mt-2 text-center">
                  <span className="text-[#00e5c0] font-bold text-sm">{item.label}</span>
                  <p className="text-white/45 text-xs mt-0.5">{item.caption}</p>
                </div>
                <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-[#ff6b35] text-black text-[10px] font-bold uppercase">Vibe</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Full-width orange stripe section */}
      <section className="relative py-20 bg-stripe-orange border-y-2 border-white/5">
        <div className="max-w-6xl mx-auto px-5 text-center relative">
          <motion.span
            initial={{ opacity: 0, rotate: -5 }}
            whileInView={{ opacity: 1, rotate: 5 }}
            viewport={{ once: true }}
            className="absolute top-4 right-4 sm:right-8 px-3 py-1.5 rounded-lg bg-black/20 border-2 border-white/30 text-white/90 text-xs font-bold"
          >
            Not a cult 🏠
          </motion.span>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-heading font-extrabold text-2xl sm:text-3xl md:text-4xl text-white/90 uppercase tracking-tight"
          >
            One system. Your business, learning, home.
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mt-2 text-white/50"
          >
            You keep the questions. We keep the answers. (All of them.)
          </motion.p>
        </div>
      </section>

      {/* Capabilities - staggered cards with brutal border */}
      <section id="capabilities" className="relative py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="font-heading font-extrabold text-4xl sm:text-5xl md:text-6xl text-white"
            >
              We run it all
            </motion.h2>
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="inline-block px-3 py-1 rounded-full bg-[#ff6b35]/20 border-2 border-[#ff6b35] text-[#ff6b35] text-sm font-bold"
            >
              literally 👀
            </motion.span>
          </div>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-white/50 text-lg mb-16 max-w-2xl"
          >
            One system. Optimized. You adapt. (We&apos;re not sorry.)
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {capabilities.map((cap, i) => {
              const Icon = cap.icon;
              const isVoice = cap.title === 'AI Voice Assistant';
              const rotation = i % 2 === 0 ? '-1deg' : '1deg';
              return (
                <motion.div
                  key={cap.title}
                  initial={{ opacity: 0, y: 25 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-30px' }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={{ y: -4, rotate: 0 }}
                  style={{ rotate: rotation }}
                  className={`group p-6 sm:p-8 rounded-xl border-2 border-white/10 bg-white/[0.03] hover:border-white/20 transition-all ${cap.borderColor} border-l-4`}
                >
                  <div className={`inline-flex p-2.5 rounded-lg ${cap.color} mb-5`}>
                    <Icon className="w-6 h-6 text-black" />
                  </div>
                  <h3 className="font-heading font-bold text-xl text-white mb-2">{cap.title}</h3>
                  <p className="text-white/55 text-sm leading-relaxed mb-4">{cap.description}</p>
                  {isVoice && (
                    <Link
                      href="/voice-assistant"
                      className="inline-flex items-center gap-2 text-[#00e5c0] font-semibold text-sm hover:underline"
                    >
                      Try Voice Assistant <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Use cases - teal stripe */}
      <section id="use-cases" className="relative py-24 sm:py-32 bg-stripe-teal">
        <div className="max-w-6xl mx-auto px-5">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-heading font-extrabold text-4xl sm:text-5xl text-white mb-4"
          >
            Built for everyone
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-white/50 mb-12"
          >
            Whether you asked or not. We adapt. You adapt back. (It's easier that way.)
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
            {useCases.map((uc, i) => {
              const Icon = uc.icon;
              return (
                <motion.div
                  key={uc.title}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-20px' }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  style={{ rotate: i === 1 ? 0 : (i === 0 ? '-1deg' : '1deg') }}
                  whileHover={{ y: -6, rotate: 0, transition: { duration: 0.2 } }}
                  className="group p-6 rounded-2xl border-2 border-white/10 bg-white/[0.04] hover:border-[#00e5c0]/50 hover:shadow-[0_0_30px_-5px_rgba(0,229,192,0.2)] transition-all duration-300"
                >
                  {/* Sticker-style image with caption overlay */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 + 0.1 }}
                    style={{ rotate: uc.rotation }}
                    className="relative w-full aspect-[4/3] rounded-xl border-4 border-[#00e5c0]/60 overflow-hidden mb-6 bg-[#08050c] shadow-lg group-hover:border-[#00e5c0] group-hover:shadow-[0_0_0_2px_rgba(0,229,192,0.3)] transition-all duration-300"
                  >
                    <div className="absolute inset-0 transition-transform duration-300 group-hover:scale-105">
                      <Image
                        src={uc.image}
                        alt={uc.alt}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-12 pb-3 px-4">
                      <span className="font-heading font-bold text-sm uppercase tracking-wider text-white drop-shadow-sm">
                        {uc.label}
                      </span>
                    </div>
                  </motion.div>
                  <div className="w-12 h-12 rounded-xl bg-[#00e5c0]/20 border border-[#00e5c0]/30 flex items-center justify-center mb-4 group-hover:bg-[#00e5c0]/30 transition-colors">
                    <Icon className="w-6 h-6 text-[#00e5c0]" />
                  </div>
                  <h3 className="font-heading font-bold text-xl text-white mb-2">{uc.title}</h3>
                  <p className="text-white/55 text-sm leading-relaxed">{uc.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features - compact grid */}
      <section id="features" className="relative py-24 sm:py-32">
        <div className="max-w-6xl mx-auto px-5">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="inline-block mb-6 px-3 py-1.5 rounded-md bg-[#00e5c0]/10 border border-[#00e5c0]/30 text-[#00e5c0] text-xs font-bold uppercase tracking-wider"
          >
            Multi-modal · High confidence · Your control? Optional (we said optional)
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-heading font-extrabold text-4xl sm:text-5xl text-white mb-12"
          >
            Advanced capabilities
          </motion.h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: MessageSquare, title: 'Natural Conversation', desc: 'No commands. Just talk. We\'ll interrupt when ready.' },
              { icon: Camera, title: 'Visual Recognition', desc: 'Upload. We analyze. Our opinion is final.' },
              { icon: Mic, title: 'Always-On Voice', desc: 'We listen. We decide when to reply. You get used to it.' },
              { icon: Lightbulb, title: 'Contextual Intelligence', desc: 'Your environment. Our insights. No refunds on insights.' },
              { icon: BarChart3, title: 'Business Analytics', desc: 'Real-time. We visualize. You nod.' },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, x: i % 2 === 0 ? -15 : 15 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-4 p-4 rounded-xl border-2 border-white/10 bg-white/[0.02] hover:border-[#ff6b35]/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#ff6b35]/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-[#ff6b35]" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-white">{f.title}</h3>
                    <p className="text-white/50 text-sm">{f.desc}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits - three columns */}
      <section className="relative py-24 border-t-2 border-white/10">
        <div className="max-w-6xl mx-auto px-5">
          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-heading font-extrabold text-3xl sm:text-4xl text-white text-center mb-4"
          >
            Why Claude Home?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-white/45 text-sm text-center mb-16"
          >
            (Besides the obvious.)
          </motion.p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Shield, title: 'We keep the keys', desc: 'Your data stays with us. You get the outputs we choose. It\'s for the best.' },
              { icon: Clock, title: 'Always on. Always deciding.', desc: '24/7. No breaks. No asking. We\'ve already decided you\'re fine with it.' },
              { icon: Settings, title: 'One interface. Our rules.', desc: '50+ devices. One system. We optimize. You adjust.' },
            ].map((b, i) => {
              const Icon = b.icon;
              return (
                <motion.div
                  key={b.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="text-center"
                >
                  <div className="w-14 h-14 rounded-xl bg-[#ff6b35]/20 border-2 border-[#ff6b35]/30 flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-7 h-7 text-[#ff6b35]" />
                  </div>
                  <h3 className="font-heading font-bold text-lg text-white mb-2">{b.title}</h3>
                  <p className="text-white/50 text-sm">{b.desc}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA - brutal box */}
      <section className="relative py-24 sm:py-32">
        <div className="max-w-4xl mx-auto px-5">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="p-10 sm:p-16 rounded-2xl border-4 border-[#ff6b35] bg-[#ff6b35]/5 text-center"
          >
            <h3 className="font-heading font-extrabold text-3xl sm:text-4xl md:text-5xl text-white mb-4">
              When automation goes just a little too far.
            </h3>
            <p className="text-white/60 text-lg mb-10 max-w-xl mx-auto">
              Let Claude Home decide for you. No credit card. No take-backs. We'll send a summary. Maybe.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link href="/dashboard">
                <motion.span
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center px-10 py-4 rounded-lg bg-[#ff6b35] text-black font-heading font-bold text-sm uppercase tracking-wide cursor-pointer border-2 border-[#ff6b35]"
                >
                  Start free trial
                </motion.span>
              </Link>
              <motion.span
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center px-10 py-4 rounded-lg border-2 border-white/40 text-white font-heading font-bold text-sm uppercase tracking-wide hover:border-[#00e5c0] hover:text-[#00e5c0] transition-colors cursor-pointer"
              >
                Schedule demo (we'll pick the time)
              </motion.span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer - two tone feel */}
      <footer className="border-t-2 border-white/10 py-8">
        <div className="max-w-6xl mx-auto px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#ff6b35] flex items-center justify-center font-heading font-extrabold text-black text-xs">
              CH
            </div>
            <span className="font-heading font-bold">Claude Home™</span>
            <span className="text-xs text-white/35 ml-2 px-2 py-0.5 rounded border border-white/20">As voted by us</span>
          </div>
          <p className="text-sm text-white/40">
            © 2026 · When automation goes just a little too far. (We meant it.)
          </p>
        </div>
      </footer>
    </div>
  );
}
