'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, login, User } from '@/lib/auth';
import TravelSubpageLayout from '@/components/travel/TravelSubpageLayout';
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-travel-muted text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <TravelSubpageLayout title="Create profile">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create profile</h1>
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <ProfileForm />
      </div>
    </TravelSubpageLayout>
  );
}
