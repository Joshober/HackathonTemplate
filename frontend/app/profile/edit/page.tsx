'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, login, User } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardShell from '@/components/DashboardShell';
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
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        await login();
        return;
      }
      setUser(currentUser);
      loadProfile();
    } catch {
      await login();
    } finally {
      setIsLoading(false);
    }
  };

  const loadProfile = async () => {
    if (!user) return;
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
  };

  if (isLoading || loading || !user) {
    return (
      <div className="min-h-screen bg-[#0c0712] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
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
    <DashboardShell>
      <div className="mb-6">
        <Link
          href="/profile"
          className="text-orange-400 hover:text-teal-400 text-sm font-medium mb-4 inline-block"
        >
          ← Back to Profile
        </Link>
        <h1 className="text-3xl font-bold text-white">Edit Profile</h1>
      </div>
      <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8">
        <ProfileForm profile={profile} onSuccess={handleProfileUpdate} />
      </div>
    </DashboardShell>
  );
}
