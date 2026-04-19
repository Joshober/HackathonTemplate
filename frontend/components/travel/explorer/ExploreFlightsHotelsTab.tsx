'use client';

import Link from 'next/link';
import type { Item } from '@/lib/api';
import type { ExplorerEventOption } from '@/lib/api';
import ApproveExplorerPlanningPanel from '@/components/travel/approve/ApproveExplorerPlanningPanel';
import ApprovedEventsLivePricing from '@/components/travel/approve/ApprovedEventsLivePricing';
import { TravelPricingOriginProvider } from '@/components/travel/approve/TravelPricingOriginContext';
type Props = {
  teamId: string | null;
  teamCities: string[];
  approvePipelineItems: Item[];
  approvePlanningWindow: { start: string; end: string } | null;
  approveOverlapPresets: { start: string; end: string }[];
  onApprovePlanningWindow: (w: { start: string; end: string } | null) => void;
  onApproveOverlapPresets: (windows: { start: string; end: string }[]) => void;
  onAddEventOption: (opt: ExplorerEventOption) => Promise<void>;
  busyId: string | null;
  toast: string | null;
  onFinalize: (bundleIndex: number) => Promise<void>;
  finalizeBusy: boolean;
  approveMsg: string | null;
  onQuotesPersisted?: () => void;
};

export default function ExploreFlightsHotelsTab({
  teamId,
  teamCities,
  approvePipelineItems,
  approvePlanningWindow,
  approveOverlapPresets,
  onApprovePlanningWindow,
  onApproveOverlapPresets,
  onAddEventOption,
  busyId,
  toast,
  onFinalize,
  finalizeBusy,
  approveMsg,
  onQuotesPersisted,
}: Props) {
  return (
    <TravelPricingOriginProvider originHintCities={teamCities}>
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Approve trips</h2>
          <p className="text-sm text-travel-muted mt-1">
            Work through home airport, team window, availability, and search — then load flight and hotel quotes in the
            grid. Trip windows, attendance, and prices appear once quotes have loaded; tap a date row to apply that
            window to every trip.
          </p>
        </div>

        <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-3 text-xs text-gray-800 space-y-2">
          <p className="font-semibold text-gray-900">Tradeoff patterns (estimates)</p>
          <ul className="list-disc list-inside space-y-1 text-travel-muted">
            <li>Non-refundable vs flexible — lower fare vs change fees if plans shift.</li>
            <li>Policy fit — confirm caps, cabin, and hotel tier with your org even when a quote looks cheaper.</li>
            <li>Time vs money — tighter connections or farther airports can change the true cost of a ticket.</li>
          </ul>
          <Link
            href="/assistant?prefill=For%20my%20current%20saved%20quotes%20in%20the%20app%2C%20explain%20the%20main%20tradeoffs%20between%20my%20top%202%20options%20on%20price%2C%20flexibility%2C%20and%20typical%20corporate%20policy%20fit."
            className="inline-flex font-semibold text-violet-800 hover:underline"
          >
            Explain tradeoffs in Copilot
          </Link>
        </div>

        <ApproveExplorerPlanningPanel
          teamId={teamId}
          teamCities={teamCities}
          pipelineItems={approvePipelineItems}
          onPlanningWindowChange={onApprovePlanningWindow}
          onOverlapPresetsChange={onApproveOverlapPresets}
          onAddEventOption={onAddEventOption}
          busyOptionId={busyId}
        />

        {toast ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{toast}</div>
        ) : null}

        <section id="approve-step-quotes" className="scroll-mt-28 space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 px-1">Quotes &amp; grid</h3>
          <ApprovedEventsLivePricing
            hideFlyingFrom
            items={approvePipelineItems}
            planningWindow={approvePlanningWindow}
            overlapPresets={approveOverlapPresets}
            originHintCities={teamCities}
            onFinalizeBooking={onFinalize}
            finalizeBusy={finalizeBusy}
            onQuotesPersisted={onQuotesPersisted}
          />
        </section>

        {approveMsg ? (
          <p className="text-xs text-center text-travel-muted border border-gray-200 bg-gray-50 rounded-lg py-2 px-3">
            {approveMsg}
          </p>
        ) : null}
      </div>
    </TravelPricingOriginProvider>
  );
}
