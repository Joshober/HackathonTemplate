'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCurrentUser, logout, User } from '@/lib/auth';

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Error loading user:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const linkClass = 'text-slate-400 hover:text-primary px-3 py-2 text-sm font-medium transition-colors border-b-2 border-transparent hover:border-primary pb-0.5';

  return (
    <nav className="bg-background-dark/95 backdrop-blur-sm border-b border-primary/10">
      <div className="max-w-6xl mx-auto px-5 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center text-background-dark font-bold text-lg">
            <span className="material-symbols-outlined">terminal</span>
          </div>
          <span className="font-heading font-bold text-lg tracking-tight">Claude Home™</span>
        </Link>
        <div className="flex items-center gap-4">
          {!isLoading && user && (
            <>
              <Link href="/dashboard" className={linkClass}>Dashboard</Link>
              <Link href="/profile" className={linkClass}>Profile</Link>
              <Link href="/voice" className={linkClass}>Voice</Link>
              <Link href="/voice-assistant" className={linkClass}>Voice Assistant</Link>
              <span className="text-slate-500 text-sm truncate max-w-[140px]">
                {user.name || user.email}
              </span>
              <button
                onClick={handleLogout}
                className="text-slate-400 hover:text-primary px-4 py-2 text-sm font-medium border-2 border-primary/20 rounded-lg hover:border-primary/50 transition-colors"
              >
                Logout
              </button>
            </>
          )}
          {!isLoading && !user && (
            <>
              <Link href="/voice" className={linkClass}>Voice</Link>
              <Link href="/voice-assistant" className={linkClass}>Voice Assistant</Link>
              <Link href="/" className="px-5 py-2.5 rounded-lg bg-primary text-background-dark font-bold text-sm uppercase tracking-wide hover:bg-primary/90 transition-colors">
                Login
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
