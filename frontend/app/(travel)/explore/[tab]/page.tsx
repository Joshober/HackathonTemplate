'use client';

import { Suspense, use } from 'react';
import { notFound, redirect } from 'next/navigation';
import { ExplorerWorkspace, type ExploreTabId } from '@/components/travel/explorer/ExplorerWorkspace';

const TAB_IDS = new Set<ExploreTabId>([
  'flights',
  'hotels',
  'trip',
  'requirements',
  'policies',
  'destination',
  'packing',
  'post',
]);

export default function ExploreTabPage({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = use(params);
  if (tab === 'events') redirect('/explore/flights');
  if (!TAB_IDS.has(tab as ExploreTabId)) notFound();
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm text-travel-muted">Loading Explore…</div>}>
      <ExplorerWorkspace initialTab={tab as ExploreTabId} />
    </Suspense>
  );
}
