'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import type { Item } from '@/lib/api';
import { getTravelPayload } from '@/lib/travelItem';
import type { TravelOpportunityStatus } from '@/lib/travelTypes';

const SWIPE_THRESHOLD = 88;
const EXIT_X = 480;

function stripStatuses(st: TravelOpportunityStatus | undefined) {
  return st === 'approved' || st === 'booked' || st === 'completed';
}

function waitingStatuses(st: TravelOpportunityStatus | undefined) {
  const s = st || 'draft';
  return s === 'draft' || s === 'ready_for_approval';
}

function statusBadge(st: TravelOpportunityStatus | undefined) {
  const s = st || 'draft';
  const map: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    ready_for_approval: 'bg-blue-50 text-blue-800',
    submitted: 'bg-violet-50 text-violet-800',
    pending: 'bg-amber-50 text-amber-800',
    approved: 'bg-emerald-50 text-emerald-800',
    needs_changes: 'bg-red-50 text-red-800',
    booked: 'bg-emerald-100 text-emerald-900',
    completed: 'bg-orange-50 text-orange-800',
  };
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md ${map[s] || map.draft}`}
    >
      {s.replace(/_/g, ' ')}
    </span>
  );
}

function ApprovedEventsSlider({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-6 text-center shadow-sm">
        <p className="text-sm text-travel-muted">No approved trips yet.</p>
        <p className="text-xs text-gray-500 mt-1">
          Swipe right on a suggestion below to submit for approval, then finish sign-off in the Approve stage.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Approved & booked</p>
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory custom-scrollbar">
        {items.map((item) => {
          const t = getTravelPayload(item);
          const st = (t?.opportunityStatus || 'draft') as TravelOpportunityStatus;
          const img = t?.imageUrl || item.imageUrls?.[0];
          return (
            <div
              key={item._id}
              className="snap-center shrink-0 w-[min(220px,72vw)] rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm"
            >
              <div className="relative h-24 w-full bg-gray-100">
                {img ? (
                  <Image src={img} alt={item.title} fill className="object-cover" sizes="220px" unoptimized />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-emerald-100 to-gray-50" />
                )}
              </div>
              <div className="p-3 space-y-2">
                <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{item.title}</p>
                <div className="flex flex-wrap gap-1">{statusBadge(st)}</div>
                {t?.location ? <p className="text-[11px] text-travel-muted truncate">{t.location}</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopSwipeCard({
  item,
  busy,
  onSwipeRight,
  onSwipeLeft,
}: {
  item: Item;
  busy: boolean;
  onSwipeRight: () => Promise<void>;
  onSwipeLeft: () => void;
}) {
  const t = getTravelPayload(item);
  const st = (t?.opportunityStatus || 'draft') as TravelOpportunityStatus;
  const img = t?.imageUrl || item.imageUrls?.[0];
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-12, 12]);
  const likeOpacity = useTransform(x, [24, 100], [0, 1]);
  const nopeOpacity = useTransform(x, [-100, -24], [1, 0]);

  const commit = useCallback(
    async (dir: 'left' | 'right') => {
      if (busy) return;
      const target = dir === 'right' ? EXIT_X : -EXIT_X;
      await animate(x, target, { type: 'spring', stiffness: 420, damping: 34 });
      if (dir === 'right') await onSwipeRight();
      else onSwipeLeft();
      x.set(0);
    },
    [busy, onSwipeLeft, onSwipeRight, x],
  );

  const onDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    if (busy) return;
    const vx = typeof info.velocity?.x === 'number' ? info.velocity.x : 0;
    const ox = info.offset.x + vx * 0.12;
    if (ox > SWIPE_THRESHOLD) void commit('right');
    else if (ox < -SWIPE_THRESHOLD) void commit('left');
    else void animate(x, 0, { type: 'spring', stiffness: 500, damping: 38 });
  };

  return (
    <motion.div
      key={item._id}
      style={{ x, rotate }}
      drag={busy ? false : 'x'}
      dragElastic={0.9}
      onDragEnd={onDragEnd}
      className="absolute inset-0 touch-pan-x"
    >
      <article className="h-full rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-2xl shadow-gray-900/10 select-none cursor-grab active:cursor-grabbing">
        <div className="pointer-events-none absolute inset-0 z-10 flex items-start justify-center pt-6 gap-6">
          <motion.span
            style={{ opacity: nopeOpacity }}
            className="rounded-lg border-4 border-red-400/80 px-3 py-1 text-lg font-black uppercase tracking-widest text-red-700 rotate-[-12deg] bg-white/70 backdrop-blur-sm"
          >
            Veto
          </motion.span>
          <motion.span
            style={{ opacity: likeOpacity }}
            className="rounded-lg border-4 border-emerald-400/80 px-3 py-1 text-lg font-black uppercase tracking-widest text-emerald-700 rotate-[12deg] bg-white/70 backdrop-blur-sm"
          >
            Approve
          </motion.span>
        </div>
        {img ? (
          <div className="relative h-44 w-full bg-gray-100">
            <Image src={img} alt={item.title} fill className="object-cover" sizes="400px" unoptimized />
          </div>
        ) : (
          <div className="h-36 bg-gradient-to-br from-blue-200 to-violet-200" />
        )}
        <div className="p-4 space-y-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 leading-snug">{item.title}</h3>
            <p className="text-sm text-travel-muted mt-1">
              {[t?.location, t?.costEstimate != null ? `Est. $${t.costEstimate.toLocaleString()}` : null, t?.addedBy || 'You']
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge(st)}
            {t?.tags?.map((tag) => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                {tag}
              </span>
            ))}
          </div>
          <p className="text-xs text-travel-muted">
            Swipe right to approve (send to the Approve stage). Swipe left to veto (remove from this stack).
          </p>
        </div>
      </article>
    </motion.div>
  );
}

export default function PlanStagePanel({
  travelItems,
  onSubmitForApproval,
}: {
  travelItems: Item[];
  onSubmitForApproval: (item: Item) => Promise<void>;
}) {
  const waiting = useMemo(() => {
    return travelItems.filter((i) => {
      const st = (getTravelPayload(i)?.opportunityStatus || 'draft') as TravelOpportunityStatus;
      return waitingStatuses(st);
    });
  }, [travelItems]);

  const approvedStrip = useMemo(() => {
    return travelItems.filter((i) => stripStatuses(getTravelPayload(i)?.opportunityStatus));
  }, [travelItems]);

  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const deck = useMemo(
    () => waiting.filter((i) => i._id && !skipped.has(i._id)),
    [waiting, skipped],
  );

  const handleSwipeRight = useCallback(
    async (item: Item) => {
      if (!item._id) return;
      setBusyId(item._id);
      try {
        await onSubmitForApproval(item);
      } finally {
        setBusyId(null);
      }
    },
    [onSubmitForApproval],
  );

  const handleSwipeLeft = useCallback((item: Item) => {
    if (!item._id) return;
    setSkipped((prev) => new Set(prev).add(item._id!));
  }, []);

  if (waiting.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Copilot Dashboard</h2>
          <p className="text-sm text-travel-muted mt-1">Review suggestions and track trips that are already approved.</p>
        </div>

        {/* Pre-Trip Copilot Policy Brief */}
        <div className="rounded-xl border border-blue-400/30 bg-blue-900/40 p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-blue-300 uppercase tracking-wide">Copilot Pre-Trip Brief</span>
          </div>
          <ul className="text-sm text-blue-100 flex flex-col gap-1.5 list-disc pl-4">
            <li><strong>Company Policy:</strong> Flights max $500, Hotels max $200/night.</li>
            <li><strong>Requirements:</strong> Director approval needed for international destinations.</li>
            <li><strong>Action Items:</strong> Ensure passport is valid for 6+ months for London travel.</li>
          </ul>
        </div>

        <ApprovedEventsSlider items={approvedStrip} />
        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-travel-muted text-sm">
          Nothing new to review.{' '}
          <Link href="/explorer" className="text-blue-300 hover:underline">
            Browse Explorer
          </Link>{' '}
          and add a trip.
        </div>
      </div>
    );
  }

  const top = deck[0];
  const stackPreview = deck.slice(0, 3);

  return (
    <div className="space-y-6 relative">
      {toast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 max-w-[min(90vw,24rem)] -translate-x-1/2 rounded-xl border border-violet-400/30 bg-violet-950/95 px-4 py-3 text-center text-sm text-violet-50 shadow-lg shadow-black/40"
        >
          {toast}
        </div>
      ) : null}

      <div>
        <h2 className="text-lg font-semibold text-white">Copilot Dashboard</h2>
        <p className="text-sm text-travel-muted mt-1">Scroll approved trips, then swipe through new suggestions.</p>
      </div>

      {/* Pre-Trip Copilot Policy Brief */}
      <div className="rounded-xl border border-blue-400/30 bg-blue-900/40 p-4 relative overflow-hidden backdrop-blur-sm">
        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold text-blue-300 uppercase tracking-wide">Copilot Pre-Trip Brief</span>
        </div>
        <ul className="text-sm text-blue-100 flex flex-col gap-1.5 list-disc pl-4">
          <li><strong>Company Policy:</strong> Flights max $500, Hotels max $200/night.</li>
          <li><strong>Requirements:</strong> Director approval needed for international destinations.</li>
          <li><strong>Action Items:</strong> Ensure passport is valid for 6+ months for London travel.</li>
        </ul>
      </div>

      <ApprovedEventsSlider items={approvedStrip} />

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-travel-muted">Suggested for your plan</p>

        {!top ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-center space-y-3">
            <p className="text-sm text-travel-muted">You&apos;ve skipped everything in this batch.</p>
            <button
              type="button"
              onClick={() => setSkipped(new Set())}
              className="text-sm font-medium text-blue-300 hover:underline"
            >
              Show skipped suggestions again
            </button>
            <Link href="/explorer" className="block text-xs text-travel-muted hover:text-white/80">
              Or find more on Explorer →
            </Link>
          </div>
        ) : (
          <>
            <div className="relative mx-auto w-full max-w-md h-[min(420px,78vh)]">
              {stackPreview
                .slice()
                .reverse()
                .map((item, revIdx) => {
                  const depth = stackPreview.length - 1 - revIdx;
                  const isTop = depth === 0;
                  const scale = 1 - depth * 0.04;
                  const y = depth * 10;
                  if (isTop) {
                    return (
                      <div
                        key={item._id}
                        className="absolute inset-0"
                        style={{ transform: `translateY(${y}px) scale(${scale})`, zIndex: 20 + revIdx }}
                      >
                        <TopSwipeCard
                          key={item._id}
                          item={item}
                          busy={busyId === item._id}
                          onSwipeRight={() => handleSwipeRight(item)}
                          onSwipeLeft={() => handleSwipeLeft(item)}
                        />
                      </div>
                    );
                  }
                  const t = getTravelPayload(item);
                  const img = t?.imageUrl || item.imageUrls?.[0];
                  return (
                    <div
                      key={item._id}
                      className="absolute inset-0 pointer-events-none"
                      style={{ transform: `translateY(${y}px) scale(${scale})`, zIndex: 20 + revIdx }}
                    >
                      <article className="h-full rounded-2xl border border-white/[0.06] bg-travel-surface/80 overflow-hidden opacity-90">
                        {img ? (
                          <div className="relative h-44 w-full bg-white/5">
                            <Image src={img} alt="" fill className="object-cover opacity-80" sizes="400px" unoptimized />
                          </div>
                        ) : (
                          <div className="h-36 bg-gradient-to-br from-white/[0.06] to-transparent" />
                        )}
                        <div className="p-4">
                          <p className="text-sm font-medium text-white/70 line-clamp-2">{item.title}</p>
                        </div>
                      </article>
                    </div>
                  );
                })}
            </div>
            <p className="text-center text-[11px] text-travel-muted">
              {deck.length} suggestion{deck.length === 1 ? '' : 's'} left in this stack
            </p>
          </>
        )}
      </div>
    </div>
  );
}
