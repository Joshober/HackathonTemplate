'use client';

import { Explorer } from '@/components/stages/plan/Explorer';
import { useTravelAuth } from '@/components/travel/useTravelAuth';

export default function ExplorerPage() {
  const { user, loading } = useTravelAuth();

  if (loading || !user) {
    return <div className="py-24 text-center text-travel-muted text-sm">Signing you in…</div>;
  }

  return (
    <div className="h-full">
      <Explorer />
    </div>
  );
}
