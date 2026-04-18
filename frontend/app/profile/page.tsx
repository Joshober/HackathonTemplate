'use client';

import { TravelStageProvider } from '@/lib/travelContext';
import TravelShell from '@/components/travel/TravelShell';
import TravelProfileBody from '@/components/travel/TravelProfileBody';

/** Root `/profile` page (required alongside `profile/edit` for Next.js). Uses the same Travel shell as the main app. */
export default function ProfilePage() {
  return (
    <TravelStageProvider>
      <TravelShell>
        <TravelProfileBody />
      </TravelShell>
    </TravelStageProvider>
  );
}
