'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, login, type User } from '@/lib/auth';

export function useTravelAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const u = await getCurrentUser();
        if (cancelled) return;
        if (!u) {
          await login();
          return;
        }
        setUser(u);
      } catch {
        if (!cancelled) await login();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, loading };
}
