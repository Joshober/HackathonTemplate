'use client';

import { useMemo, type ReactNode } from 'react';
import { useTravelStage } from '@/lib/travelContext';
import BottomNav from '@/components/travel/BottomNav';
import StageStepper from '@/components/travel/StageStepper';
import type { TravelStageId } from '@/lib/travelTypes';

function stageGradient(stage: TravelStageId): string {
  switch (stage) {
    case 'plan':
      return 'linear-gradient(165deg, var(--stage-plan-soft) 0%, transparent 52%)';
    case 'approve':
      return 'linear-gradient(165deg, var(--stage-approve-soft) 0%, transparent 52%)';
    case 'travel':
      return 'linear-gradient(165deg, var(--stage-travel-soft) 0%, transparent 52%)';
    case 'return':
      return 'linear-gradient(165deg, var(--stage-return-soft) 0%, transparent 52%)';
    default:
      return 'none';
  }
}

export default function TravelShell({ children }: { children: ReactNode }) {
  const { stage } = useTravelStage();
  const bg = useMemo(() => stageGradient(stage), [stage]);

  return (
    <div className="min-h-dvh flex flex-col bg-gray-50 text-gray-900 relative">
      <div className="pointer-events-none fixed inset-0 -z-10" style={{ background: bg }} />
      <div className="pointer-events-none fixed inset-0 -z-20 bg-gray-50" />
      <header className="shrink-0 relative glass-panel border-b border-gray-200">
        <div className="max-w-md mx-auto px-4 pt-3 pb-1">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">Lockton</p>
            <h1 className="text-lg font-semibold tracking-tight text-gray-900 truncate">Travel Companion</h1>
          </div>
        </div>
        <StageStepper />
      </header>

      <main className="flex-1 overflow-y-auto min-h-0 scrollbar-hide">
        <div className="max-w-md mx-auto w-full min-h-full px-4 py-4 pb-28">{children}</div>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto w-full pointer-events-none">
        <div className="pointer-events-auto bg-gray-50 pb-[max(1.25rem,env(safe-area-inset-bottom))] px-6 pt-1">
          <BottomNav />
        </div>
      </div>
    </div>
  );
}
