'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { api, type Item } from '@/lib/api';
import { derivePrimaryTripItem } from '@/lib/travelDashboardDerive';
import { getTravelPayload } from '@/lib/travelItem';
import type { TravelOpportunityStatus } from '@/lib/travelTypes';

const SWIPE_THRESHOLD = 88;
const EXIT_X = 480;

function waitingStatuses(st: TravelOpportunityStatus | undefined) {
  const s = st || 'draft';
  return s === 'draft' || s === 'ready_for_approval';
}

function PreTripCopilotBrief({ travelItems }: { travelItems: Item[] }) {
  const primaryId = useMemo(() => derivePrimaryTripItem(travelItems)?._id, [travelItems]);
  const fingerprint = useMemo(
    () =>
      travelItems
        .map((i) => {
          const t = getTravelPayload(i);
          return `${i._id ?? ''}|${t?.opportunityStatus ?? ''}|${t?.location ?? ''}|${t?.startDate ?? ''}|${t?.endDate ?? ''}`;
        })
        .join(';'),
    [travelItems],
  );

  const [brief, setBrief] = useState<{
    companyPolicy: string;
    requirements: string;
    actionItems: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    void (async () => {
      try {
        const res = await api.generatePreTripBrief(primaryId ? { itemId: primaryId } : {});
        if (cancelled) return;
        setBrief({
          companyPolicy: res.companyPolicy,
          requirements: res.requirements,
          actionItems: res.actionItems,
        });
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Brief unavailable');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fingerprint, primaryId, tick]);

  return (
    <div className="rounded-xl border border-blue-400/30 bg-blue-900/40 p-4 relative overflow-hidden backdrop-blur-sm">
      <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-xs font-bold text-blue-300 uppercase tracking-wide">Copilot Pre-Trip Brief</span>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => setTick((n) => n + 1)}
          className="text-[11px] text-blue-200 hover:text-white disabled:opacity-50 font-medium"
        >
          {loading ? 'Generating…' : 'Refresh'}
        </button>
      </div>
      {err ? <p className="text-sm text-amber-200/95 pl-0.5">{err}</p> : null}
      {loading && !brief ? (
        <p className="text-sm text-blue-100/90 pl-0.5">Generating your brief from saved trips…</p>
      ) : null}
      {brief ? (
        <ul className="text-sm text-blue-100 flex flex-col gap-1.5 list-disc pl-4">
          <li>
            <strong className="text-blue-200">Company Policy:</strong> {brief.companyPolicy}
          </li>
          <li>
            <strong className="text-blue-200">Requirements:</strong> {brief.requirements}
          </li>
          <li>
            <strong className="text-blue-200">Action Items:</strong> {brief.actionItems}
          </li>
        </ul>
      ) : null}
    </div>
  );
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
            Swipe right to submit for team approval (Approve stage). Swipe left to veto (remove from this stack).
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
        <PreTripCopilotBrief travelItems={travelItems} />
        <div>
          <h2 className="text-lg font-semibold text-white">Copilot Dashboard</h2>
          <p className="text-sm text-travel-muted mt-1">Review suggestions for your trip.</p>
        </div>

        <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-travel-muted text-sm">
          Nothing new to review.{' '}
          <Link href="/home" className="text-blue-300 hover:underline">
            Return to Home
          </Link>{' '}
          and add a trip in Plan.
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

      <PreTripCopilotBrief travelItems={travelItems} />

      <div>
        <h2 className="text-lg font-semibold text-white">Copilot Dashboard</h2>
        <p className="text-sm text-travel-muted mt-1">Swipe through new suggestions below.</p>
      </div>

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
            <Link href="/assistant" className="block text-xs text-travel-muted hover:text-white/80">
              Need ideas? Ask Copilot →
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
