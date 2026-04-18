'use client';

import { useState, FormEvent, ChangeEvent } from 'react';
import { api, Profile } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface ProfileFormProps {
  profile?: Profile;
  onSuccess?: () => void;
}

export default function ProfileForm({ profile, onSuccess }: ProfileFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(profile?.profileImageUrl || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (profile?._id) {
        await api.updateProfile({
          displayName,
          bio,
          image: imageFile || undefined,
        });
      } else {
        await api.createProfile({
          displayName,
          bio,
          image: imageFile || undefined,
        });
      }

      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/home');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      <div>
        <label className={labelClass}>Profile Image</label>
        <div className="flex items-center gap-4">
          {imagePreview && (
            <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 flex-shrink-0">
              <Image
                src={imagePreview}
                alt="Profile preview"
                fill
                className="object-cover"
              />
            </div>
          )}
          <div className="flex-1">
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
              onChange={handleImageChange}
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-800 hover:file:bg-blue-100"
            />
            <p className="mt-1 text-xs text-gray-500">PNG, JPG, GIF or WEBP. Max 5MB.</p>
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="displayName" className={labelClass}>
          Display Name *
        </label>
        <input
          type="text"
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          className={inputClass}
          placeholder="Enter your display name"
        />
      </div>

      <div>
        <label htmlFor="bio" className={labelClass}>
          Bio
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={4}
          className={inputClass}
          placeholder="Tell us about yourself..."
        />
      </div>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          {loading ? 'Saving...' : profile?._id ? 'Update Profile' : 'Create Profile'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 bg-white transition-colors shadow-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
