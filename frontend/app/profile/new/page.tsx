'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, login, User } from '@/lib/auth';
import DashboardShell from '@/components/DashboardShell';
import ProfileForm from '@/components/ProfileForm';

export default function NewProfilePage() {
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

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-[#0c0712] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <DashboardShell>
      <h1 className="text-3xl font-bold text-white mb-6">Create Profile</h1>
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8">
        <ProfileForm />
      </div>
    </DashboardShell>
  );
}
