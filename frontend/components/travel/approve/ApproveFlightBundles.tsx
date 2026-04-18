'use client';

export type FlightBundle = {
  id: string;
  label: string;
  badge: string;
  flightBand: string;
  hotelBand: string;
  total: number;
};

const DEFAULT_BUNDLES: FlightBundle[] = [
  {
    id: 'economy',
    label: 'Economy mix',
    badge: 'Lowest total',
    flightBand: '$420–$510',
    hotelBand: '$180/night',
    total: 1180,
  },
  {
    id: 'flex',
    label: 'Flexible fare',
    badge: 'Fewer changes',
    flightBand: '$510–$620',
    hotelBand: '$195/night',
    total: 1320,
  },
];

type Props = {
  bundles?: FlightBundle[];
  onFinalize?: (bundleIndex: number) => void | Promise<void>;
  busy?: boolean;
  footerNote?: string;
};

export default function ApproveFlightBundles({
  bundles = DEFAULT_BUNDLES,
  onFinalize,
  busy,
  footerNote = 'Estimates only — not live fares. Confirm with your travel desk before ticketing.',
}: Props) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-white">Flight & hotel bundles</h3>
        <p className="text-xs text-travel-muted mt-1">{footerNote}</p>
      </div>
      {bundles.map((b, i) => (
        <div key={b.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
          <div className="flex justify-between items-center gap-2">
            <span className="text-sm font-medium text-white">{b.label}</span>
            <span className="text-xs text-emerald-300/90 shrink-0">{b.badge}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-travel-muted">
            <div className="rounded-lg bg-black/20 p-2">Flight · {b.flightBand}</div>
            <div className="rounded-lg bg-black/20 p-2">Hotel · {b.hotelBand}</div>
          </div>
          <p className="text-sm text-white/80">
            Total est. ${b.total.toLocaleString()} · within typical policy band
          </p>
          {onFinalize ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onFinalize(i)}
              className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold"
            >
              {busy ? 'Saving…' : `Finalize with ${b.label}`}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}
