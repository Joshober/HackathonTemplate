'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, login, User } from '@/lib/auth';
import Link from 'next/link';
import DashboardShell from '@/components/DashboardShell';
import { motion } from 'motion/react';
import { Clock, User as UserIcon, MessageCircle, Headphones, Mic, GraduationCap } from 'lucide-react';

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        await login();
        return;
      }
      setUser(currentUser);
    } catch {
      await login();
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#08050c] flex items-center justify-center">
        <div className="text-[#00e5c0]">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardShell>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="font-heading text-3xl font-extrabold mb-1">Overview</h2>
            <p className="text-slate-400">Your control center. We run it; you watch.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Clock className="w-4 h-4" />
            <span>Last updated: Just now</span>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          whileHover={{ y: -4, scale: 1.02 }}
          className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl border-2 border-white/10 p-6 hover:bg-white/[0.05] hover:border-[#ff6b35]/30 transition-all"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-gradient-to-br from-[#ff6b35]/20 to-[#00e5c0]/10 p-3 rounded-xl">
              <UserIcon className="w-6 h-6 text-[#ff6b35]" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Profile</h3>
              <p className="text-sm text-slate-400">View and edit your profile</p>
            </div>
          </div>
          <Link
            href="/profile"
            className="inline-flex items-center text-[#00e5c0] hover:text-[#5efad4] text-sm font-medium"
          >
            Go to Profile →
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          whileHover={{ y: -4, scale: 1.02 }}
          className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 hover:bg-white/[0.07] hover:border-[#00e5c0]/30 transition-all"
        >
          <h3 className="text-xl font-semibold mb-2">Welcome back{user.name ? `, ${user.name.split(' ')[0]}` : ''}</h3>
          <p className="text-slate-400 text-sm">{user.email}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.21 }}
          whileHover={{ y: -4, scale: 1.02 }}
          className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl border-2 border-white/10 p-6 hover:bg-white/[0.05] hover:border-[#ff6b35]/30 transition-all"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-gradient-to-br from-[#ff6b35]/20 to-amber-500/15 p-3 rounded-xl">
              <MessageCircle className="w-6 h-6 text-[#ff6b35]" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Chat Pipeline</h3>
              <p className="text-sm text-slate-400">Voice + text + images → AI → speech</p>
            </div>
          </div>
          <Link
            href="/chat"
            className="inline-flex items-center text-[#00e5c0] hover:text-[#5efad4] text-sm font-medium"
          >
            Go to Chat →
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.22 }}
          whileHover={{ y: -4, scale: 1.02 }}
          className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 hover:bg-white/[0.07] hover:border-[#00e5c0]/30 transition-all"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-gradient-to-br from-[#00e5c0]/20 to-cyan-500/15 p-3 rounded-xl">
              <Headphones className="w-6 h-6 text-[#00e5c0]" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">AI Tech Support</h3>
              <p className="text-sm text-slate-400">Chat with support, send emails, create tickets</p>
            </div>
          </div>
          <Link
            href="/support"
            className="inline-flex items-center text-[#00e5c0] hover:text-[#5efad4] text-sm font-medium"
          >
            Go to Tech Support →
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.23 }}
          whileHover={{ y: -4, scale: 1.02 }}
          className="bg-white/5 backdrop-blur-md border border-white/10 rounded-xl border-2 border-white/10 p-6 hover:bg-white/[0.05] hover:border-[#ff6b35]/30 transition-all"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-gradient-to-br from-amber-500/20 to-[#ff6b35]/15 p-3 rounded-xl">
              <Mic className="w-6 h-6 text-[#ff6b35]" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">AI Tutor (with Voice)</h3>
              <p className="text-sm text-slate-400">Ask by text or voice — Weekend Energy Tutor: fun line + real help</p>
            </div>
          </div>
          <Link
            href="/tutor"
            className="inline-flex items-center text-[#00e5c0] hover:text-[#5efad4] text-sm font-medium"
          >
            Go to AI Tutor →
          </Link>
        </motion.div>

      </div>
    </DashboardShell>
  );
}
