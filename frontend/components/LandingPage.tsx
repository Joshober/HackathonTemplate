'use client';

import { motion, useScroll, useTransform } from 'motion/react';
import Link from 'next/link';
import {
  Brain,
  ArrowRight,
  Check,
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
} from 'lucide-react';
import { useRef } from 'react';

const capabilities = [
  {
    icon: Briefcase,
    title: 'AI Business Assistant',
    description: 'Intelligent executive support for scheduling, email management, task prioritization, and strategic decision-making.',
    color: 'from-blue-500/20 to-blue-500/5',
    iconColor: 'text-blue-400',
  },
  {
    icon: GraduationCap,
    title: 'Visual Learning & Tutoring',
    description: 'Upload images, diagrams, or documents for instant AI-powered explanations and personalized tutoring.',
    color: 'from-purple-500/20 to-purple-500/5',
    iconColor: 'text-purple-400',
  },
  {
    icon: Home,
    title: 'Smart Device Intelligence',
    description: 'Ask questions about any connected device. Get instant diagnostics and optimization recommendations.',
    color: 'from-green-500/20 to-green-500/5',
    iconColor: 'text-green-400',
  },
  {
    icon: Zap,
    title: 'Intelligent Task Automation',
    description: 'Automate repetitive workflows and delegate routine tasks to AI. Optimize efficiency autonomously.',
    color: 'from-orange-500/20 to-orange-500/5',
    iconColor: 'text-orange-400',
  },
];

const stats = [
  { value: '99.2%', label: 'Response Accuracy' },
  { value: '24/7', label: 'Availability' },
  { value: '50+', label: 'Connected Devices' },
  { value: '10x', label: 'Productivity Gain' },
];

const useCases = [
  {
    title: 'For Executives',
    description: 'Manage your calendar, prioritize emails, prepare briefings—all through conversational AI.',
    icon: Briefcase,
  },
  {
    title: 'For Students',
    description: 'Take a photo of any problem or diagram. Get step-by-step explanations and personalized learning.',
    icon: GraduationCap,
  },
  {
    title: 'For Homeowners',
    description: 'Monitor and control every connected device. Ask about energy usage or climate settings instantly.',
    icon: Home,
  },
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

  const opacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95]);

  return (
    <div ref={containerRef} className="min-h-screen bg-[#0E1117] text-white">
      {/* Animated gradient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-gradient-to-b from-[#4F8CFF]/20 via-[#4F8CFF]/5 to-transparent rounded-full blur-3xl"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(79,140,255,0.03),transparent_50%)]" />
      </div>

      {/* Navigation */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="fixed top-0 left-0 right-0 z-50 bg-[#0E1117]/80 backdrop-blur-xl border-b border-white/5"
      >
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-[#4F8CFF] to-[#6BA0FF] rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold">Claude Home™</span>
          </div>
          <div className="flex items-center gap-8">
            <a href="#capabilities" className="text-sm text-gray-400 hover:text-white transition-colors">
              Capabilities
            </a>
            <a href="#features" className="text-sm text-gray-400 hover:text-white transition-colors">
              Features
            </a>
            <a href="#use-cases" className="text-sm text-gray-400 hover:text-white transition-colors">
              Use Cases
            </a>
            {children}
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <motion.div style={{ opacity, scale }} className="relative pt-40 pb-32">
        <div className="max-w-6xl mx-auto px-8 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-7xl md:text-8xl font-bold mb-8 leading-[1.1] tracking-tight"
          >
            Your AI Assistant for
            <br />
            <span className="bg-gradient-to-r from-white via-white to-white/60 bg-clip-text text-transparent">
              Everything, Everywhere
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-xl text-gray-400 max-w-3xl mx-auto mb-12 leading-relaxed"
          >
            Claude Home is your intelligent companion for business, learning, and home automation.
            Handle executive tasks, get instant tutoring, manage connected devices—all through natural conversation.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex gap-4 justify-center mb-20"
          >
            <Link href="/dashboard">
              <motion.span
                whileHover={{ scale: 1.02, boxShadow: '0 0 30px rgba(79, 140, 255, 0.4)' }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-2 bg-[#4F8CFF] hover:bg-[#5A96FF] px-8 py-4 rounded-xl font-medium transition-all shadow-lg shadow-[#4F8CFF]/20 cursor-pointer"
              >
                Start Free Trial
                <ArrowRight className="w-5 h-5" />
              </motion.span>
            </Link>
            <motion.span
              whileHover={{ scale: 1.02, backgroundColor: 'rgba(255, 255, 255, 0.08)' }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 px-8 py-4 rounded-xl font-medium transition-all cursor-pointer"
            >
              Watch Demo
            </motion.span>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="grid grid-cols-4 gap-8 max-w-4xl mx-auto"
          >
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.7 + index * 0.1 }}
                className="text-center"
              >
                <div className="text-4xl font-bold mb-2 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* Core Capabilities Section */}
      <div id="capabilities" className="relative py-32">
        <div className="max-w-7xl mx-auto px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
              Unified AI Platform
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              One intelligent system for business, learning, home automation, and workflow optimization
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {capabilities.map((capability, index) => {
              const Icon = capability.icon;
              return (
                <motion.div
                  key={capability.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  whileHover={{ y: -8, scale: 1.01 }}
                  className="group bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 hover:bg-white/8 hover:border-white/20 transition-all duration-300"
                >
                  <div className={`bg-gradient-to-br ${capability.color} p-4 rounded-xl inline-flex mb-6 group-hover:scale-110 transition-transform`}>
                    <Icon className={`w-8 h-8 ${capability.iconColor}`} />
                  </div>
                  <h3 className="text-2xl font-semibold mb-4">{capability.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{capability.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Use Cases Section */}
      <div id="use-cases" className="relative py-32 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent">
        <div className="max-w-7xl mx-auto px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
              Built for Everyone
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              From executives to students and homeowners—Claude Home adapts to your needs
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {useCases.map((useCase, index) => {
              const Icon = useCase.icon;
              return (
                <motion.div
                  key={useCase.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.6, delay: index * 0.15 }}
                  className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 hover:border-[#4F8CFF]/30 transition-all"
                >
                  <Icon className="w-12 h-12 text-[#4F8CFF] mb-6" />
                  <h3 className="text-2xl font-semibold mb-4">{useCase.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{useCase.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div id="features" className="relative py-32">
        <div className="max-w-7xl mx-auto px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8 }}
            className="text-center mb-20"
          >
            <div className="inline-flex items-center gap-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full px-4 py-2 mb-6">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-sm text-gray-300">Introducing Multi-Modal AI Assistant</span>
            </div>
            <h2 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
              Advanced Capabilities
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Powered by state-of-the-art AI with multi-modal understanding
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { icon: MessageSquare, title: 'Natural Conversation', description: 'Engage through natural language. No commands to memorize—just talk.' },
              { icon: Camera, title: 'Visual Recognition', description: 'Upload images for instant analysis. From homework help to product identification.' },
              { icon: Lightbulb, title: 'Contextual Intelligence', description: 'Understands your environment, preferences, and patterns for relevant insights.' },
              { icon: BarChart3, title: 'Business Analytics', description: 'Real-time insights and data visualization for informed decision-making.' },
            ].map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  whileHover={{ y: -8, scale: 1.01 }}
                  className="group bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 hover:bg-white/8 hover:border-white/20 transition-all duration-300"
                >
                  <div className="flex items-start gap-5">
                    <div className="bg-gradient-to-br from-[#4F8CFF]/20 to-[#4F8CFF]/5 p-4 rounded-xl">
                      <Icon className="w-7 h-7 text-[#4F8CFF]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-semibold mb-3">{feature.title}</h3>
                      <p className="text-gray-400 leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Benefits Section */}
      <div className="relative py-32 bg-gradient-to-b from-transparent via-white/[0.02] to-transparent">
        <div className="max-w-7xl mx-auto px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
              Why Claude Home?
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Shield, title: 'Enterprise-Grade Security', description: 'Bank-level encryption and privacy controls. Your data never leaves your environment.' },
              { icon: Clock, title: 'Always Available', description: '24/7 autonomous operation. No breaks, no downtime, consistent performance.' },
              { icon: Settings, title: 'Seamless Integration', description: 'Works with 50+ device types and platforms. One interface for everything.' },
            ].map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.6, delay: index * 0.15 }}
                  className="text-center"
                >
                  <div className="bg-gradient-to-br from-[#4F8CFF]/20 to-[#4F8CFF]/5 p-4 rounded-xl inline-flex mb-6">
                    <Icon className="w-8 h-8 text-[#4F8CFF]" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{benefit.title}</h3>
                  <p className="text-gray-400">{benefit.description}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative py-32">
        <div className="max-w-4xl mx-auto px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.8 }}
            className="bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-16"
          >
            <h3 className="text-5xl font-bold mb-6 tracking-tight">
              Transform Your Workflow Today
            </h3>
            <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
              Join thousands of professionals who&apos;ve automated their workflows with Claude Home.
              Start your free trial—no credit card required.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/dashboard">
                <motion.span
                  whileHover={{ scale: 1.02, boxShadow: '0 0 40px rgba(79, 140, 255, 0.5)' }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center bg-[#4F8CFF] hover:bg-[#5A96FF] px-10 py-5 rounded-xl text-lg font-medium transition-all shadow-lg shadow-[#4F8CFF]/20 cursor-pointer"
                >
                  Start Free Trial
                </motion.span>
              </Link>
              <motion.span
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center bg-white/5 backdrop-blur-sm border border-white/10 px-10 py-5 rounded-xl text-lg font-medium transition-all hover:bg-white/10 cursor-pointer"
              >
                Schedule Demo
              </motion.span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-[#4F8CFF] to-[#6BA0FF] rounded-lg flex items-center justify-center">
                <Brain className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold">Claude Home™</span>
            </div>
            <div className="text-sm text-gray-500">
              © 2026 Claude Home. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
