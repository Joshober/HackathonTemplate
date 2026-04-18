'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { TravelStageId } from '@/lib/travelTypes';
import { TRAVEL_STAGES } from '@/lib/travelTypes';

interface TravelStageContextValue {
  stage: TravelStageId;
  stageIndex: number;
  setStage: (s: TravelStageId) => void;
  goNext: () => void;
  goPrev: () => void;
  stages: typeof TRAVEL_STAGES;
}

const TravelStageContext = createContext<TravelStageContextValue | null>(null);

export function TravelStageProvider({ children }: { children: ReactNode }) {
  const [stage, setStageState] = useState<TravelStageId>('plan');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? window.localStorage.getItem('travelCompanionStage') : null;
    if (saved === 'plan' || saved === 'approve' || saved === 'travel' || saved === 'return') {
      setStageState(saved);
    }
  }, []);

  const stageIndex = useMemo(() => TRAVEL_STAGES.findIndex((s) => s.id === stage), [stage]);

  const setStage = useCallback((s: TravelStageId) => {
    setStageState(s);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('travelCompanionStage', s);
    }
  }, []);

  const goNext = useCallback(() => {
    setStageState((prev) => {
      const i = TRAVEL_STAGES.findIndex((x) => x.id === prev);
      const next = i >= 0 && i < TRAVEL_STAGES.length - 1 ? TRAVEL_STAGES[i + 1].id : prev;
      if (typeof window !== 'undefined') window.localStorage.setItem('travelCompanionStage', next);
      return next;
    });
  }, []);

  const goPrev = useCallback(() => {
    setStageState((prev) => {
      const i = TRAVEL_STAGES.findIndex((x) => x.id === prev);
      const next = i > 0 ? TRAVEL_STAGES[i - 1].id : prev;
      if (typeof window !== 'undefined') window.localStorage.setItem('travelCompanionStage', next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      stage,
      stageIndex: stageIndex < 0 ? 0 : stageIndex,
      setStage,
      goNext,
      goPrev,
      stages: TRAVEL_STAGES,
    }),
    [stage, stageIndex, setStage, goNext, goPrev]
  );

  return <TravelStageContext.Provider value={value}>{children}</TravelStageContext.Provider>;
}

export function useTravelStage() {
  const ctx = useContext(TravelStageContext);
  if (!ctx) {
    throw new Error('useTravelStage must be used within TravelStageProvider');
  }
  return ctx;
}
