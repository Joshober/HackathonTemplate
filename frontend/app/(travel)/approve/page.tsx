import { Suspense } from 'react';
import ApprovePlanInner from './ApprovePlanInner';

export default function ApprovePage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-sm text-gray-400">Loading approval page…</div>}>
      <ApprovePlanInner />
    </Suspense>
  );
}
