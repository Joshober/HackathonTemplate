'use client';

import { useTravelStage } from '@/lib/travelContext';
import type { TravelStageId } from '@/lib/travelTypes';

const stageColor: Record<TravelStageId, string> = {
  plan: 'var(--stage-plan)',
  approve: 'var(--stage-approve)',
  travel: 'var(--stage-travel)',
  return: 'var(--stage-return)',
};

export default function StageStepper() {
  const { stages, stage, stageIndex, setStage } = useTravelStage();

  return (
    <div className="px-4 pt-3 pb-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-travel-muted mb-2">Journey</p>
      <div className="flex rounded-xl overflow-hidden border border-white/[0.06] bg-travel-surface/80 p-0.5 gap-0.5">
        {stages.map((s, i) => {
          const active = s.id === stage;
          const done = i < stageIndex;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStage(s.id)}
              className={`flex-1 min-w-0 py-2 px-1 rounded-lg text-[11px] font-medium transition-all ${
                active ? 'text-white shadow-sm' : done ? 'text-white/70' : 'text-travel-muted'
              }`}
              style={{
                background: active ? stageColor[s.id] : done ? 'rgba(255,255,255,0.06)' : 'transparent',
              }}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
