'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to student search page
    router.push('/studentsearch');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-xl p-8 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Graceland University
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Campus Navigation
        </p>
        <div className="text-gray-500">Loading...</div>
      </div>
    </div>
  );
}
