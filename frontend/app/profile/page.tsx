'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, login, User } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ProfileForm from '@/components/ProfileForm';
import { api, Profile } from '@/lib/api';
import Image from 'next/image';
import Link from 'next/link';

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
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
    } catch (error) {
      console.error('Error loading user:', error);
      await login();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadProfile();
    }
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const data = await api.getProfile();
      setProfile(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error loading profile:', err);
      
      if (errorMessage.includes('404') || errorMessage.includes('not found') || errorMessage.includes('500')) {
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const retryData = await api.getProfile();
          setProfile(retryData);
        } catch (retryErr) {
          console.error('Retry failed:', retryErr);
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
      } catch (err) {
        if (err instanceof Error && err.message.includes('404')) {
          // Profile still doesn't exist
        }
      }
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

  if (!profile && !editing) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Profile</h1>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <p className="text-gray-600 mb-4">You haven't created a profile yet.</p>
            <button
              onClick={() => setEditing(true)}
              className="bg-indigo-600 text-white px-6 py-2 rounded-md font-medium hover:bg-indigo-700"
            >
              Create Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900">
              {profile ? 'Edit Profile' : 'Create Profile'}
            </h1>
            {profile && (
              <button
                onClick={() => setEditing(false)}
                className="text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
            )}
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <ProfileForm profile={profile || undefined} onSuccess={handleProfileUpdate} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-12">
            <div className="flex items-center space-x-6">
              {profile.profileImageUrl ? (
                <div className="relative w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg flex-shrink-0">
                  <Image
                    src={profile.profileImageUrl}
                    alt={profile.displayName}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <div className="w-32 h-32 rounded-full bg-white bg-opacity-20 flex items-center justify-center flex-shrink-0">
                  <span className="text-5xl text-white font-bold">
                    {profile.displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 text-white">
                <h1 className="text-4xl font-bold mb-2">{profile.displayName}</h1>
                {user?.email && (
                  <p className="text-indigo-100 text-lg">{user.email}</p>
                )}
              </div>
              <button
                onClick={() => setEditing(true)}
                className="bg-white text-indigo-600 px-6 py-2 rounded-md font-medium hover:bg-indigo-50 transition-colors"
              >
                Edit Profile
              </button>
            </div>
          </div>

          {/* Profile Content */}
          <div className="px-6 py-8">
            {profile.bio && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">About</h2>
                <p className="text-gray-700 leading-relaxed">{profile.bio}</p>
              </div>
            )}

            <div className="border-t border-gray-200 pt-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Member since</span>
                  <p className="text-gray-900 font-medium">
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
                  <p className="text-gray-900 font-medium">
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

            <div className="mt-8 flex space-x-4">
              <Link
                href="/dashboard"
                className="bg-indigo-600 text-white px-6 py-2 rounded-md font-medium hover:bg-indigo-700"
              >
                Go to Dashboard
              </Link>
              <button
                onClick={() => setEditing(true)}
                className="border border-gray-300 text-gray-700 px-6 py-2 rounded-md font-medium hover:bg-gray-50"
              >
                Edit Profile
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
