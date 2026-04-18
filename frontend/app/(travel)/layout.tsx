'use client';

import { TravelStageProvider } from '@/lib/travelContext';
import TravelShell from '@/components/travel/TravelShell';

export default function TravelLayout({ children }: { children: React.ReactNode }) {
  return (
    <TravelStageProvider>
      <TravelShell>{children}</TravelShell>
    </TravelStageProvider>
  );
}
