'use client';

import { useTravelStage } from '@/lib/travelContext';

export default function StageStepper() {
  const { stages, stageIndex, setStage } = useTravelStage();

  return (
    <div className="px-4 pb-3 pt-1">
      <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
        {stages.map((s, index) => {
          const isCompleted = index < stageIndex;
          const isActive = index === stageIndex;
          return (
            <div key={s.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStage(s.id)}
                className={`text-sm font-semibold transition-all duration-300 ${
                  isActive ? 'text-gray-900' : isCompleted ? 'text-gray-600' : 'text-gray-400'
                }`}
              >
                {s.label}
              </button>
              {index < stages.length - 1 ? <span className="text-gray-400 text-xs select-none">→</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
