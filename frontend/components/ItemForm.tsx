'use client';

import { useState, FormEvent, ChangeEvent } from 'react';
import { api, Item } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface ItemFormProps {
  item?: Item;
  onSuccess?: () => void;
}

export default function ItemForm({ item, onSuccess }: ItemFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [selectedVideos, setSelectedVideos] = useState<File[]>([]);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>(item?.imageUrls || []);
  const [existingVideoUrls, setExistingVideoUrls] = useState<string[]>(item?.videoUrls || []);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [videoPreviewUrls, setVideoPreviewUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedImages([...selectedImages, ...files]);
      
      // Create preview URLs
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (reader.result) {
            setImagePreviewUrls([...imagePreviewUrls, reader.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const handleVideoChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedVideos([...selectedVideos, ...files]);
      
      // Create preview URLs for videos
      files.forEach((file) => {
        const url = URL.createObjectURL(file);
        setVideoPreviewUrls([...videoPreviewUrls, url]);
      });
    }
  };

  const removeImage = (index: number, isExisting: boolean = false) => {
    if (isExisting) {
      const newUrls = [...existingImageUrls];
      newUrls.splice(index, 1);
      setExistingImageUrls(newUrls);
    } else {
      const newImages = [...selectedImages];
      const newPreviews = [...imagePreviewUrls];
      newImages.splice(index, 1);
      newPreviews.splice(index, 1);
      setSelectedImages(newImages);
      setImagePreviewUrls(newPreviews);
    }
  };

  const removeVideo = (index: number, isExisting: boolean = false) => {
    if (isExisting) {
      const newUrls = [...existingVideoUrls];
      newUrls.splice(index, 1);
      setExistingVideoUrls(newUrls);
    } else {
      const newVideos = [...selectedVideos];
      const newPreviews = [...videoPreviewUrls];
      // Revoke object URL to free memory
      URL.revokeObjectURL(newPreviews[index]);
      newVideos.splice(index, 1);
      newPreviews.splice(index, 1);
      setSelectedVideos(newVideos);
      setVideoPreviewUrls(newPreviews);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (item?._id) {
        await api.updateItem(item._id, { 
          title, 
          description,
          images: selectedImages.length > 0 ? selectedImages : undefined,
          videos: selectedVideos.length > 0 ? selectedVideos : undefined,
          imageUrls: existingImageUrls,
          videoUrls: existingVideoUrls,
        });
      } else {
        await api.createItem({ 
          title, 
          description,
          images: selectedImages.length > 0 ? selectedImages : undefined,
          videos: selectedVideos.length > 0 ? selectedVideos : undefined,
        });
      }
      
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save item';
      setError(errorMessage);
      
      // If it's an authentication error, the fetchWithAuth will handle redirect
      // But we can also show a helpful message
      if (errorMessage.includes('Authentication') || errorMessage.includes('session')) {
        console.error('Authentication error:', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
          Title
        </label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Enter item title"
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Enter item description"
        />
      </div>

      <div>
        <label htmlFor="images" className="block text-sm font-medium text-gray-700 mb-1">
          Images (PNG, JPG, JPEG, GIF, WEBP)
        </label>
        <input
          type="file"
          id="images"
          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
          multiple
          onChange={handleImageChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        />
        {(existingImageUrls.length > 0 || imagePreviewUrls.length > 0) && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {existingImageUrls.map((url, index) => (
              <div key={`existing-${index}`} className="relative group">
                <div className="relative w-full h-32 rounded-lg overflow-hidden border-2 border-gray-300">
                  <Image
                    src={url}
                    alt={`Existing image ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeImage(index, true)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            {imagePreviewUrls.map((url, index) => (
              <div key={`new-${index}`} className="relative group">
                <div className="relative w-full h-32 rounded-lg overflow-hidden border-2 border-gray-300">
                  <Image
                    src={url}
                    alt={`Preview ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeImage(index, false)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="videos" className="block text-sm font-medium text-gray-700 mb-1">
          Videos (MP4, WEBM, OGG, MOV, AVI)
        </label>
        <input
          type="file"
          id="videos"
          accept="video/mp4,video/webm,video/ogg,video/quicktime,video/x-msvideo"
          multiple
          onChange={handleVideoChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
        />
        {(existingVideoUrls.length > 0 || videoPreviewUrls.length > 0) && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {existingVideoUrls.map((url, index) => (
              <div key={`existing-video-${index}`} className="relative group">
                <div className="relative w-full rounded-lg overflow-hidden border-2 border-gray-300">
                  <video
                    src={url}
                    controls
                    className="w-full h-auto"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeVideo(index, true)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            {videoPreviewUrls.map((url, index) => (
              <div key={`new-video-${index}`} className="relative group">
                <div className="relative w-full rounded-lg overflow-hidden border-2 border-gray-300">
                  <video
                    src={url}
                    controls
                    className="w-full h-auto"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeVideo(index, false)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex space-x-3">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-md font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {loading ? 'Saving...' : item?._id ? 'Update Item' : 'Create Item'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
