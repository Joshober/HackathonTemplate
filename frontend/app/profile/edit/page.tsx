'use client';

import { useEffect, useState, useCallback } from 'react';
import { getCurrentUser, login, User } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TravelSubpageLayout from '@/components/travel/TravelSubpageLayout';
import ProfileForm from '@/components/ProfileForm';
import { api, Profile } from '@/lib/api';

export default function EditProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
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

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await api.getProfile();
      setProfile(data);
    } catch (err) {
      if (err instanceof Error && err.message.includes('404')) {
        router.push('/profile/new');
      }
    } finally {
      setLoading(false);
    }
  }, [user, router]);

  useEffect(() => {
    if (user) loadProfile();
  }, [user, loadProfile]);

  if (isLoading || loading || !user) {
    return (
      <div className="min-h-screen bg-[#080a0f] flex items-center justify-center">
        <div className="text-travel-muted text-sm">Loading…</div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const handleProfileUpdate = () => {
    router.push('/profile');
  };

  return (
    <TravelSubpageLayout title="Edit profile">
      <div className="mb-6">
        <Link href="/profile" className="text-blue-300 hover:underline text-sm font-medium mb-4 inline-block">
          ← Back to profile
        </Link>
        <h1 className="text-2xl font-bold text-white">Edit profile</h1>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <ProfileForm profile={profile} onSuccess={handleProfileUpdate} />
      </div>
    </TravelSubpageLayout>
  );
}
