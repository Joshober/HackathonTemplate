'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getCurrentUser, logout, User } from '@/lib/auth';

/** Optional top nav — Travel Companion only. */
export default function Navbar() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setUser(await getCurrentUser());
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const linkClass =
    'text-slate-400 hover:text-white px-3 py-2 text-sm font-medium transition-colors border-b-2 border-transparent hover:border-blue-400/50 pb-0.5';

  return (
    <nav className="bg-[#0c0e14]/95 backdrop-blur-sm border-b border-white/[0.06]">
      <div className="max-w-6xl mx-auto px-5 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-400">flight_takeoff</span>
          <span className="font-semibold text-white tracking-tight">Travel Companion</span>
        </Link>
        <div className="flex items-center gap-4">
          {!isLoading && user && (
            <>
              <Link href="/home" className={linkClass}>
                App
              </Link>
              <Link href="/profile" className={linkClass}>
                Profile
              </Link>
              <span className="text-slate-500 text-sm truncate max-w-[140px]">{user.name || user.email}</span>
              <button
                type="button"
                onClick={() => logout()}
                className="text-slate-400 hover:text-white px-4 py-2 text-sm font-medium border border-white/15 rounded-lg hover:bg-white/5 transition-colors"
              >
                Log out
              </button>
            </>
          )}
          {!isLoading && !user && (
            <Link
              href="/home"
              className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-semibold text-sm hover:bg-blue-500 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
