'use client';

import { useState, useEffect } from 'react';
import { api, Item } from '@/lib/api';
import Link from 'next/link';

export default function ItemList() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await api.getItems();
      setItems(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load items');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) {
      return;
    }

    try {
      await api.deleteItem(id);
      setItems(items.filter(item => item._id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-500">Loading items...</div>;
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No items yet. Create your first item!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div
          key={item._id}
          className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {item.title}
              </h3>
              <p className="text-gray-600 mb-2">{item.description}</p>
              
              {/* Display Images */}
              {item.imageUrls && item.imageUrls.length > 0 && (
                <div className="mb-2">
                  <div className="flex flex-wrap gap-2">
                    {item.imageUrls.slice(0, 3).map((url, index) => (
                      <div key={index} className="relative w-20 h-20 rounded overflow-hidden border border-gray-300">
                        <img
                          src={url}
                          alt={`${item.title} image ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                    {item.imageUrls.length > 3 && (
                      <div className="w-20 h-20 rounded border border-gray-300 flex items-center justify-center bg-gray-100 text-gray-500 text-sm">
                        +{item.imageUrls.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Display Videos */}
              {item.videoUrls && item.videoUrls.length > 0 && (
                <div className="mb-2">
                  <div className="flex flex-wrap gap-2">
                    {item.videoUrls.slice(0, 2).map((url, index) => (
                      <div key={index} className="relative w-32 h-20 rounded overflow-hidden border border-gray-300 bg-black">
                        <video
                          src={url}
                          className="w-full h-full object-contain"
                          controls
                          preload="metadata"
                        />
                      </div>
                    ))}
                    {item.videoUrls.length > 2 && (
                      <div className="w-32 h-20 rounded border border-gray-300 flex items-center justify-center bg-gray-100 text-gray-500 text-sm">
                        +{item.videoUrls.length - 2}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {item.createdAt && (
                <p className="text-sm text-gray-400">
                  Created: {new Date(item.createdAt).toLocaleDateString()}
                </p>
              )}
            </div>
            <div className="flex space-x-2 ml-4">
              <Link
                href={`/items/${item._id}`}
                className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700"
              >
                Edit
              </Link>
              <button
                onClick={() => item._id && handleDelete(item._id)}
                className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
