'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import TeamSupportPathsCard from '@/components/travel/team/TeamSupportPathsCard';

export default function TeamContactsPage() {
  return (
    <div className="space-y-4 py-2">
      <Link href="/team" className="inline-flex items-center gap-1 text-sm text-travel-muted hover:text-gray-900">
        <ChevronLeft className="w-4 h-4" aria-hidden />
        Back to Team hub
      </Link>
      <h1 className="text-lg font-semibold text-gray-900">Support contacts</h1>
      <p className="text-sm text-travel-muted">
        In production this lists your travel desk, manager, and emergency lines. Until then, use the same support paths
        as Home incidents and Copilot for wording.
      </p>
      <TeamSupportPathsCard />
      <Link
        href="/assistant?prefill=Who%20should%20I%20contact%20right%20now%20for%20a%20travel%20emergency%3F"
        className="inline-flex text-sm font-medium text-blue-600 hover:underline"
      >
        Ask Copilot who to contact
      </Link>
    </div>
  );
}
