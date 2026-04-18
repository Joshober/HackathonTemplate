'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { api, type Item, type TravelMetadata } from '@/lib/api';
import { useTravelAuth } from '@/components/travel/useTravelAuth';
import { getTravelPayload } from '@/lib/travelItem';
import type { TravelOpportunityStatus } from '@/lib/travelTypes';

function isApprovedOrBooked(status: TravelOpportunityStatus | undefined) {
  return status === 'approved' || status === 'booked' || status === 'completed';
}

export default function ApprovedEventsPage() {
  const { user, loading } = useTravelAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [activeItem, setActiveItem] = useState<Item | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editStatus, setEditStatus] = useState<TravelOpportunityStatus>('approved');
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setErr(null);
      const rows = await api.getItems();
      setItems(rows);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load events');
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void refresh();
  }, [user, refresh]);

  useEffect(() => {
    if (!activeItem) return;
    const t = getTravelPayload(activeItem);
    setEditTitle(activeItem.title || '');
    setEditDescription(activeItem.description || '');
    setEditLocation(t?.location || '');
    setEditImageUrl(t?.imageUrl || activeItem.imageUrls?.[0] || '');
    setEditStatus((t?.opportunityStatus || 'approved') as TravelOpportunityStatus);
    setErr(null);
  }, [activeItem]);

  const approved = useMemo(() => {
    return items.filter((item) => isApprovedOrBooked(getTravelPayload(item)?.opportunityStatus));
  }, [items]);

  if (loading || !user) {
    return <div className="py-24 text-center text-travel-muted text-sm">Signing you in…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Manage approved & booked</h2>
          <p className="text-sm text-travel-muted mt-1">Review, edit, and remove events from your approved/booked list.</p>
        </div>
        <Link href="/home" className="text-xs text-blue-600 hover:underline font-medium">
          Back to Home
        </Link>
      </div>
      {err ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{err}</div> : null}
      {!approved.length ? (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-travel-muted">
          No approved or booked events yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {approved.map((item) => {
            const t = getTravelPayload(item);
            const img = t?.imageUrl || item.imageUrls?.[0];
            return (
              <article key={item._id} className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
                <div className="relative h-36 w-full bg-gray-100">
                  {img ? (
                    <Image src={img} alt={item.title} fill className="object-cover" sizes="320px" unoptimized />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-gray-100 to-gray-50" />
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{item.title}</p>
                  <p className="text-[11px] text-travel-muted truncate">{t?.location || 'No location set'}</p>
                  <button
                    type="button"
                    onClick={() => setActiveItem(item)}
                    className="w-full rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs text-gray-700 py-1.5"
                  >
                    Review / edit
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {activeItem ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-gray-200 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 space-y-3">
              <h3 className="text-base font-semibold text-gray-900">Review event</h3>
              <label className="block text-xs text-travel-muted">
                Title
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white border border-gray-200 px-3 py-2 text-sm text-gray-900"
                />
              </label>
              <label className="block text-xs text-travel-muted">
                Description
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-xl bg-white border border-gray-200 px-3 py-2 text-sm text-gray-900"
                />
              </label>
              <label className="block text-xs text-travel-muted">
                Location
                <input
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white border border-gray-200 px-3 py-2 text-sm text-gray-900"
                />
              </label>
              <label className="block text-xs text-travel-muted">
                Image URL
                <input
                  value={editImageUrl}
                  onChange={(e) => setEditImageUrl(e.target.value)}
                  className="mt-1 w-full rounded-xl bg-white border border-gray-200 px-3 py-2 text-sm text-gray-900"
                />
              </label>
              <label className="block text-xs text-travel-muted">
                Status
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus((e.target.value || 'approved') as TravelOpportunityStatus)}
                  className="mt-1 w-full rounded-xl bg-white border border-gray-200 px-3 py-2 text-sm text-gray-900"
                >
                  <option value="approved">approved</option>
                  <option value="booked">booked</option>
                  <option value="completed">completed</option>
                </select>
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={saveBusy || removeBusy || !activeItem._id || !editTitle.trim()}
                  onClick={() => {
                    if (!activeItem._id) return;
                    const t = getTravelPayload(activeItem);
                    if (!t) return;
                    void (async () => {
                      setSaveBusy(true);
                      setErr(null);
                      try {
                        await api.updateItem(activeItem._id, {
                          title: editTitle.trim(),
                          description: editDescription.trim() || activeItem.description,
                          imageUrls: editImageUrl.trim() ? [editImageUrl.trim()] : activeItem.imageUrls,
                          travel: {
                            ...t,
                            location: editLocation.trim() || t.location,
                            opportunityStatus: editStatus,
                            ...(editImageUrl.trim() ? { imageUrl: editImageUrl.trim() } : {}),
                          } as unknown as TravelMetadata,
                        });
                        await refresh();
                        setActiveItem(null);
                      } catch (e) {
                        setErr(e instanceof Error ? e.message : 'Could not save changes');
                      } finally {
                        setSaveBusy(false);
                      }
                    })();
                  }}
                  className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5"
                >
                  {saveBusy ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  disabled={saveBusy || removeBusy || !activeItem._id}
                  onClick={() => {
                    if (!activeItem._id) return;
                    const ok = window.confirm(`Remove "${activeItem.title}" from your plan?`);
                    if (!ok) return;
                    void (async () => {
                      setRemoveBusy(true);
                      setErr(null);
                      try {
                        await api.deleteItem(activeItem._id!);
                        await refresh();
                        setActiveItem(null);
                      } catch (e) {
                        setErr(e instanceof Error ? e.message : 'Could not remove event');
                      } finally {
                        setRemoveBusy(false);
                      }
                    })();
                  }}
                  className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5"
                >
                  {removeBusy ? 'Removing…' : 'Remove'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setActiveItem(null)}
                disabled={saveBusy || removeBusy}
                className="w-full rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm text-gray-700 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
