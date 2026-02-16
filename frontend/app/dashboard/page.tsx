'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, login, User } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import ItemList from '@/components/ItemList';
import ProfileCard from '@/components/ProfileCard';
import Link from 'next/link';

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        // Redirect to login
        await login();
        return;
      }
      setUser(currentUser);
    } catch (error) {
      console.error('Error loading user:', error);
      await login();
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Welcome back{user.name ? `, ${user.name.split(' ')[0]}` : ''}!
          </h1>
          <p className="text-gray-600">Manage your items and profile from here.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Items Section */}
            <div className="bg-white rounded-lg shadow p-6">
              <div className="mb-6 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">My Items</h2>
                <Link
                  href="/items/new"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md font-medium hover:bg-indigo-700 transition-colors"
                >
                  + Create New Item
                </Link>
              </div>
              <ItemList />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <ProfileCard />
            
            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Link
                  href="/items/new"
                  className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                >
                  Create New Item
                </Link>
                <Link
                  href="/profile"
                  className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                >
                  View Profile
                </Link>
                <Link
                  href="/profile/edit"
                  className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-50 rounded-md transition-colors"
                >
                  Edit Profile
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
