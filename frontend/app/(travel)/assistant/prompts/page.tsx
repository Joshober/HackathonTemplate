'use client';

import { Suspense } from 'react';
import StageCopilotChat from '@/components/travel/copilot/StageCopilotChat';

/** Demo URL: quick prompts still come from journey stage — use `?prefill=` for a scripted opener. */
export default function AssistantPromptsPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <p className="text-[11px] text-travel-muted mb-2 shrink-0">
        Copilot · prompts view — stage chips in the header set Planning / Approval / Travel / Return modes.
      </p>
      <Suspense fallback={<div className="p-4 text-sm text-travel-muted">Loading Copilot…</div>}>
        <StageCopilotChat />
      </Suspense>
    </div>
  );
}
