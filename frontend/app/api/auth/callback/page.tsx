'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function CallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Get the code from query params
    const code = searchParams.get('code');
    
    if (code) {
      // The backend callback route will handle the code exchange
      // We just need to wait a moment and then redirect to dashboard
      // The backend should have set the session cookie by now
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    } else {
      // No code, redirect to home
      router.push('/');
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-lg text-gray-600 mb-2">Completing authentication...</div>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
      </div>
    </div>
  );
}
