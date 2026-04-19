'use client';

import { Suspense } from 'react';
import StageCopilotChat from '@/components/travel/copilot/StageCopilotChat';

/** Demo URL: same Copilot as `/assistant`, stable path for slides. */
export default function AssistantChatPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <p className="text-[11px] text-travel-muted mb-2 shrink-0">Copilot · chat (same experience as /assistant)</p>
      <Suspense fallback={<div className="p-4 text-sm text-travel-muted">Loading Copilot…</div>}>
        <StageCopilotChat />
      </Suspense>
    </div>
  );
}
