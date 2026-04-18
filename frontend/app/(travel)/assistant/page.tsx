'use client';

import { Suspense } from 'react';
import AssistantInner from './AssistantInner';

export default function AssistantPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-sm text-travel-muted">Loading assistant…</div>}>
      <AssistantInner />
    </Suspense>
  );
}
