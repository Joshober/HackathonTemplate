'use client';

import { TravelStageProvider } from '@/lib/travelContext';
import { PlanningProvider } from '@/components/context/PlanningContext';
import { RootLayout } from '@/components/RootLayout';

export default function TravelLayout({ children }: { children: React.ReactNode }) {
  return (
    <TravelStageProvider>
      <PlanningProvider>
        <RootLayout>{children}</RootLayout>
      </PlanningProvider>
    </TravelStageProvider>
  );
}
