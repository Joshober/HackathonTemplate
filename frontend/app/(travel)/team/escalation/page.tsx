'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import TeamSupportPathsCard from '@/components/travel/team/TeamSupportPathsCard';

export default function TeamEscalationPage() {
  return (
    <div className="space-y-4 py-2">
      <Link href="/team" className="inline-flex items-center gap-1 text-sm text-travel-muted hover:text-gray-900">
        <ChevronLeft className="w-4 h-4" aria-hidden />
        Back to Team hub
      </Link>
      <h1 className="text-lg font-semibold text-gray-900">Escalation</h1>
      <p className="text-sm text-travel-muted">
        When self-service or Copilot cannot resolve an issue, escalate with impact, urgency, and what you already tried
        — aligned with the issue workflow on Home (Travel stage).
      </p>
      <TeamSupportPathsCard />
      <Link href="/home" className="text-sm font-medium text-blue-600 hover:underline">
        Open Home and switch to Travel for incidents
      </Link>
    </div>
  );
}
