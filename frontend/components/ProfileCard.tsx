'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, User } from '@/lib/auth';
import { api, Profile } from '@/lib/api';
import Link from 'next/link';
import Image from 'next/image';

export default function ProfileCard() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Load user first
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        setLoading(false);
        return;
      }
      setUser(currentUser);

      // Then load profile
      try {
        const profileData = await api.getProfile();
        setProfile(profileData);
        setError(null);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load profile';
        console.error('Error loading profile:', err);
        
        if (errorMessage.includes('Authentication') || errorMessage.includes('access token') || errorMessage.includes('401')) {
          // Retry after delay
          setTimeout(() => {
            if (currentUser) {
              loadProfile();
            }
          }, 2000);
          setError(null);
          setLoading(true);
        } else {
          setError(errorMessage);
        }
      }
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadProfile = async () => {
    try {
      const profileData = await api.getProfile();
      setProfile(profileData);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load profile';
      setError(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">Loading profile...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Profile</h2>
        <p className="text-gray-600">Please log in to view your profile.</p>
      </div>
    );
  }

  if (error && !error.includes('404')) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
        {error}
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Profile</h2>
        <p className="text-gray-600 mb-4">Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start space-x-4">
        {profile.profileImageUrl ? (
          <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-gray-300 flex-shrink-0">
            <Image
              src={profile.profileImageUrl}
              alt={profile.displayName}
              fill
              className="object-cover"
            />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl text-gray-500">
              {profile.displayName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-900 mb-1">{profile.displayName}</h2>
          {profile.bio && (
            <p className="text-gray-600 mb-3">{profile.bio}</p>
          )}
          <Link
            href="/profile"
            className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
          >
            View Profile
          </Link>
        </div>
      </div>
    </div>
  );
}
