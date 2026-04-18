'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      setTimeout(() => router.push('/home'), 1000);
    } else {
      router.push('/');
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-[#08050c] flex items-center justify-center">
      <div className="text-center">
        <div className="text-lg text-gray-400 mb-2">Completing authentication...</div>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff6b35] mx-auto" />
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#08050c] flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff6b35]" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
