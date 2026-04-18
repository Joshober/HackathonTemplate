'use client';

import { TravelStageProvider } from '@/lib/travelContext';
import { TeamPlanningProvider } from '@/lib/teamPlanningContext';
import TravelShell from '@/components/travel/TravelShell';

export default function TravelLayout({ children }: { children: React.ReactNode }) {
  return (
    <TravelStageProvider>
      <TeamPlanningProvider>
        <TravelShell>{children}</TravelShell>
      </TeamPlanningProvider>
    </TravelStageProvider>
  );
}
