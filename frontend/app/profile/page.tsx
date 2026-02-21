'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, login, User } from '@/lib/auth';
import Link from 'next/link';
import DashboardShell from '@/components/DashboardShell';
import ProfileForm from '@/components/ProfileForm';
import { api, Profile } from '@/lib/api';
import Image from 'next/image';

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

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

  useEffect(() => {
    if (user) loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const data = await api.getProfile();
      setProfile(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg.includes('404') || msg.includes('not found') || msg.includes('500')) {
        try {
          await new Promise((r) => setTimeout(r, 1000));
          const retryData = await api.getProfile();
          setProfile(retryData);
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleProfileUpdate = async () => {
    if (user) {
      try {
        const data = await api.getProfile();
        setProfile(data);
        setEditing(false);
      } catch {
        // ignore
      }
    }
  };

  if (isLoading || loading || !user) {
    return (
      <div className="min-h-screen bg-[#0E1117] flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!profile && !editing) {
    return (
      <DashboardShell>
        <h1 className="text-3xl font-bold mb-6">Profile</h1>
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-gray-400 mb-4">You haven&apos;t created a profile yet.</p>
          <button
            onClick={() => setEditing(true)}
            className="bg-[#4F8CFF] hover:bg-[#5A96FF] text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
          >
            Create Profile
          </button>
        </div>
      </DashboardShell>
    );
  }

  if (editing) {
    return (
      <DashboardShell>
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">{profile != null ? 'Edit Profile' : 'Create Profile'}</h1>
          {profile && (
            <button
              onClick={() => setEditing(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8">
          <ProfileForm profile={profile || undefined} onSuccess={handleProfileUpdate} />
        </div>
      </DashboardShell>
    );
  }

  if (!profile) return null;

  return (
    <DashboardShell>
      <div className="max-w-4xl">
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden">
          {/* Profile Header */}
          <div className="bg-gradient-to-br from-[#4F8CFF]/20 to-[#4F8CFF]/5 border-b border-white/10 px-8 py-12">
            <div className="flex items-center gap-6 flex-wrap">
              {profile.profileImageUrl ? (
                <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white/20 flex-shrink-0">
                  <Image
                    src={profile.profileImageUrl}
                    alt={profile.displayName}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-32 h-32 rounded-full bg-[#4F8CFF]/30 flex items-center justify-center flex-shrink-0 text-4xl font-bold text-white">
                  {profile.displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h1 className="text-4xl font-bold mb-2 text-white">{profile.displayName}</h1>
                {user?.email && <p className="text-gray-400 text-lg">{user.email}</p>}
              </div>
              <button
                onClick={() => setEditing(true)}
                className="bg-[#4F8CFF] hover:bg-[#5A96FF] text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
              >
                Edit Profile
              </button>
            </div>
          </div>

          {/* Profile Content */}
          <div className="px-8 py-8">
            {profile.bio && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-2">About</h2>
                <p className="text-gray-400 leading-relaxed">{profile.bio}</p>
              </div>
            )}

            <div className="border-t border-white/10 pt-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Member since</span>
                  <p className="text-gray-300 font-medium">
                    {profile.createdAt
                      ? new Date(profile.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Last updated</span>
                  <p className="text-gray-300 font-medium">
                    {profile.updatedAt
                      ? new Date(profile.updatedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-4">
              <Link
                href="/dashboard"
                className="bg-[#4F8CFF] hover:bg-[#5A96FF] text-white px-6 py-2.5 rounded-xl font-medium transition-colors inline-block"
              >
                Dashboard
              </Link>
              <button
                onClick={() => setEditing(true)}
                className="border border-white/20 text-gray-300 hover:bg-white/5 px-6 py-2.5 rounded-xl font-medium transition-colors"
              >
                Edit Profile
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
