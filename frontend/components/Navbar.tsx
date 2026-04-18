'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Plane } from 'lucide-react';
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
    'text-gray-500 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors border-b-2 border-transparent hover:border-blue-400/50 pb-0.5';

  return (
    <nav className="glass-panel border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-5 py-4 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2 text-gray-900">
          <Plane className="w-6 h-6 text-blue-600 shrink-0" aria-hidden />
          <span className="font-semibold tracking-tight">Travel Companion</span>
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
              <span className="text-gray-400 text-sm truncate max-w-[140px]">{user.name || user.email}</span>
              <button
                type="button"
                onClick={() => logout()}
                className="text-gray-600 hover:text-gray-900 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors bg-white shadow-sm"
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
