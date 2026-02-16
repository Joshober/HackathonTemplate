'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, login, User } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
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
    } catch (error) {
      console.error('Error loading user:', error);
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
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const handleProfileUpdate = async () => {
    try {
      router.push('/profile');
    } catch (err) {
      // Handle error
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link
            href="/profile"
            className="text-indigo-600 hover:text-indigo-700 text-sm font-medium mb-4 inline-block"
          >
            ← Back to Profile
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Edit Profile</h1>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <ProfileForm profile={profile} onSuccess={handleProfileUpdate} />
        </div>
      </div>
    </div>
  );
}
