'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Receipt, CheckCircle, RefreshCw, Sparkles, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { api, type Item, type TravelMetadata, TRAVEL_ACTIVE_TEAM_STORAGE_KEY } from '@/lib/api';
import type { User } from '@/lib/auth';
import OpportunityCard from '@/components/travel/OpportunityCard';
import { getTravelPayload, humanDescriptionLine, isTravelItem } from '@/lib/travelItem';
import type { TravelOpportunityStatus } from '@/lib/travelTypes';

function approvedStatuses(st: TravelOpportunityStatus | undefined) {
  const s = st || 'draft';
  return s === 'approved' || s === 'booked' || s === 'completed';
}

/** Return tab: post-trip moments + finalized trips only (not Explorer/Plan drafts). */
function isReturnFeedCard(item: Item): boolean {
  const t = getTravelPayload(item);
  if (!t) return false;
  if (t.tripType === 'post_trip') return true;
  return approvedStatuses(t.opportunityStatus);
}

function initialSavedTeamId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TRAVEL_ACTIVE_TEAM_STORAGE_KEY);
}

export default function ReturnStagePanel({ user }: { user: User }) {
  const [teamId, setTeamId] = useState<string | null>(initialSavedTeamId);
  const [feed, setFeed] = useState<Item[]>([]);
  const [personal, setPersonal] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [addBusy, setAddBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState<string | null>(null);
  const [capBusy, setCapBusy] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState<string | null>(null);

  const [expensesDone, setExpensesDone] = useState(false);
  const [expensing, setExpensing] = useState(false);

  // AI Trip Summary
  const [tripSummary, setTripSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryErr, setSummaryErr] = useState<string | null>(null);

  const generateTripSummary = async () => {
    if (summaryLoading) return;
    setSummaryLoading(true);
    setSummaryErr(null);
    try {
      const result = await api.chatCopilot({
        message:
          'Give me a concise trip summary (3-4 bullet points) covering: destinations visited, key meetings or events, any issues encountered, and outcome. Use information from my uploaded documents and trip data. Keep it professional and brief.',
        assistantMode: 'trip_companion',
        travelStage: 'return',
        messages: [],
      });
      setTripSummary(result.reply);
    } catch (e) {
      setSummaryErr(e instanceof Error ? e.message : 'Could not generate summary');
    } finally {
      setSummaryLoading(false);
    }
  };

  const readTeamFromStorage = useCallback(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TRAVEL_ACTIVE_TEAM_STORAGE_KEY);
  }, []);

  const refresh = useCallback(async () => {
    const tid = readTeamFromStorage();
    setTeamId(tid);
    setErr(null);
    setLoading(true);
    try {
      const mine = await api.getItems();
      setPersonal(mine.filter(isTravelItem));
      if (tid) {
        setFeed(await api.getTeamReturnFeed(tid));
      } else {
        setFeed([]);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not load Return feed');
      setFeed([]);
    } finally {
      setLoading(false);
    }
  }, [readTeamFromStorage]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === TRAVEL_ACTIVE_TEAM_STORAGE_KEY) void refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  useEffect(() => {
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const shareable = personal.filter((i) => {
    const t = getTravelPayload(i);
    if (!t || !i._id) return false;
    if (i.teamId) return false;
    return approvedStatuses(t.opportunityStatus);
  });

  const onShareToTeam = async (item: Item) => {
    const tid = readTeamFromStorage();
    if (!tid || !item._id) return;
    setShareBusy(item._id);
    try {
      await api.updateItem(item._id, { teamId: tid });
      showToast(`Shared “${item.title}” with your team.`);
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not share');
    } finally {
      setShareBusy(null);
    }
  };

  const onAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    const tid = readTeamFromStorage();
    if (!tid || addBusy) return;
    const loc = location.trim() || 'Post-trip';
    const tit = title.trim();
    const body = notes.trim();
    if (!tit) {
      showToast('Enter an event title.');
      return;
    }
    setAddBusy(true);
    try {
      await api.createItem({
        title: tit.slice(0, 200),
        description: body || `Post-trip memory: ${tit}`,
        teamId: tid,
        travel: {
          location: loc,
          costEstimate: 0,
          tags: ['return', 'post_trip'],
          tripType: 'post_trip',
          addedBy: user.email || 'You',
          opportunityStatus: 'completed',
          notes: body || undefined,
        },
      });
      setTitle('');
      setLocation('');
      setNotes('');
      showToast('Event added for your team.');
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add event');
    } finally {
      setAddBusy(false);
    }
  };

  const onPickPhotos = async (item: Item, files: FileList | null) => {
    if (!item._id || !files?.length) return;
    setUploadBusy(item._id);
    try {
      await api.updateItem(item._id, { images: Array.from(files) });
      showToast('Photos uploaded.');
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadBusy(null);
    }
  };

  const onGenerateCaption = async (item: Item) => {
    const tid = readTeamFromStorage();
    if (!tid || !item._id) return;
    setCapBusy(item._id);
    try {
      const { caption } = await api.generateInstagramCaption(tid, item._id);
      const t = getTravelPayload(item);
      const merged: TravelMetadata = {
        ...(t as unknown as TravelMetadata),
        instagramCaption: caption,
        instagramCaptionGeneratedAt: new Date().toISOString(),
      };
      await api.updateItem(item._id, { travel: merged });
      showToast('Caption saved to this event.');
      await refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Caption failed');
    } finally {
      setCapBusy(null);
    }
  };

  if (!teamId) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Post-trip team feed</h2>
          <p className="text-sm text-travel-muted mt-1">
            Choose an active team on the Team tab so everyone can see approved trips, add moments, and build
            Instagram captions together.
          </p>
        </div>
        <Link
          href="/team"
          className="block w-full text-center py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold"
        >
          Open Team tab
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-travel-muted text-sm">Loading Return feed…</div>
    );
  }

  const visibleFeed = feed.filter(isReturnFeedCard);

  return (
    <div className="space-y-6">
      {toast ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {toast}
        </div>
      ) : null}
      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{err}</div>
      ) : null}

      <div>
        <h2 className="text-lg font-semibold text-gray-900">Post-Trip Workspace</h2>
        <p className="text-sm text-travel-muted mt-1">
          Automate your expenses and build trip memories with your team.
        </p>
      </div>

      {/* AI TRIP SUMMARY */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <h4 className="text-sm font-bold text-blue-900">AI Trip Summary</h4>
          </div>
          {!tripSummary && (
            <button
              type="button"
              onClick={() => void generateTripSummary()}
              disabled={summaryLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
            >
              {summaryLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Generate
                </>
              )}
            </button>
          )}
        </div>

        {!tripSummary && !summaryLoading && (
          <p className="text-xs text-blue-700">
            Generate a professional summary of your completed trip — destinations, key outcomes, and next steps.
          </p>
        )}

        {summaryLoading && (
          <div className="flex items-center gap-2 text-xs text-blue-700">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Analyzing your trip documents and data…
          </div>
        )}

        {summaryErr && (
          <p className="text-xs text-red-700">{summaryErr}</p>
        )}

        {tripSummary && (
          <div className="space-y-2">
            <div className="bg-white rounded-xl border border-blue-100 px-4 py-3 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
              {tripSummary}
            </div>
            <button
              type="button"
              onClick={() => void generateTripSummary()}
              disabled={summaryLoading}
              className="text-xs text-blue-600 hover:underline"
            >
              Regenerate
            </button>
          </div>
        )}
      </div>

      {/* EXPENSE RECONCILIATION COPILOT (MOCK) */}
      {!expensesDone ? (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 space-y-3 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-violet-500" />
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-violet-600" />
            <h4 className="text-sm font-bold text-violet-900">Copilot Expense Assistant</h4>
          </div>
          <p className="text-xs text-violet-800">
            I've detected 3 unexpensed receipts from your recent travel totaling $214.50 (Uber, Starbucks, and Delta WiFi). 
          </p>
          <div className="bg-white/60 p-3 rounded-xl border border-violet-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-800">Ready to reconcile?</span>
            <button 
              onClick={() => {
                setExpensing(true);
                setTimeout(() => setExpensesDone(true), 2000);
              }}
              disabled={expensing}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50 flex items-center gap-2"
            >
              {expensing ? <RefreshCw className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Auto-Generate Report'}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-bold text-emerald-900">Expenses Submitted</span>
          </div>
          <p className="text-xs text-emerald-800">
            Copilot automatically generated the report and pushed it to Concur. Your manager has been notified.
          </p>
        </div>
      )}

      {shareable.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-travel-muted">Share with team</p>
          <p className="text-xs text-travel-muted">
            These approved trips are only yours until you attach them to the active team.
          </p>
          <div className="space-y-2">
            {shareable.map((item) => {
              const t = getTravelPayload(item);
              const img = t?.imageUrl || item.imageUrls?.[0];
              return (
                <div
                  key={item._id}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                    {t?.location ? <p className="text-xs text-travel-muted truncate">{t.location}</p> : null}
                  </div>
                  {img ? (
                    <div className="relative h-14 w-20 shrink-0 rounded-lg overflow-hidden border border-gray-200">
                      <Image src={img} alt="" fill className="object-cover" sizes="80px" unoptimized />
                    </div>
                  ) : null}
                  <button
                    type="button"
                    disabled={shareBusy === item._id}
                    onClick={() => void onShareToTeam(item)}
                    className="shrink-0 rounded-lg bg-gray-100 hover:bg-gray-200 border border-gray-200 px-3 py-2 text-xs font-medium text-gray-900 disabled:opacity-40"
                  >
                    {shareBusy === item._id ? '…' : 'Share with team'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <form onSubmit={(e) => void onAddEvent(e)} className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3 shadow-sm">
        <p className="text-sm font-medium text-gray-900">Add a post-trip event</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Event title"
          className="w-full rounded-xl bg-white border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm"
        />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City / venue (optional)"
          className="w-full rounded-xl bg-white border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What happened? (optional)"
          rows={3}
          className="w-full rounded-xl bg-white border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 resize-none shadow-sm"
        />
        <button
          type="submit"
          disabled={addBusy}
          className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold disabled:opacity-40"
        >
          {addBusy ? 'Adding…' : 'Add event for team'}
        </button>
      </form>

      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-travel-muted">Feed</p>
        {visibleFeed.length === 0 ? (
          <p className="text-sm text-travel-muted">
            {feed.length === 0
              ? 'No shared trips yet. Share an approved plan above or add a post-trip event.'
              : 'No approved or post-trip cards yet. Planning ideas stay on Home (Approve) until the team signs off.'}
          </p>
        ) : (
          visibleFeed.map((item) => {
            const t = getTravelPayload(item);
            const img = t?.imageUrl || item.imageUrls?.[0];
            const cap = t?.instagramCaption;
            const isOwner = Boolean(item.userId && user.sub && item.userId === user.sub);
            const byTeammate = Boolean(item.userId && user.sub && item.userId !== user.sub);
            return (
              <OpportunityCard
                key={item._id}
                title={item.title}
                subtitle={
                  (byTeammate ? 'From a teammate · ' : '') +
                  (t ? humanDescriptionLine(item, t) : item.description.slice(0, 120))
                }
                imageUrl={img}
                footer={
                  <div className="space-y-3 text-left">
                    {cap ? (
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-travel-muted mb-1">
                          Instagram draft
                        </p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{cap}</p>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <label className="cursor-pointer rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-800 hover:bg-gray-100">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          disabled={uploadBusy === item._id}
                          onChange={(e) => {
                            void onPickPhotos(item, e.target.files);
                            e.target.value = '';
                          }}
                        />
                        {uploadBusy === item._id ? 'Uploading…' : 'Add photos'}
                      </label>
                      <button
                        type="button"
                        disabled={capBusy === item._id || !(item.imageUrls?.length || t?.imageUrl)}
                        onClick={() => void onGenerateCaption(item)}
                        className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-900 hover:bg-violet-100 disabled:opacity-40"
                      >
                        {capBusy === item._id ? 'Generating…' : 'AI Instagram caption'}
                      </button>
                    </div>
                    {isOwner ? (
                      <p className="text-[10px] text-travel-muted">You created this card.</p>
                    ) : byTeammate ? (
                      <p className="text-[10px] text-travel-muted">Anyone on the team can add photos or captions.</p>
                    ) : null}
                  </div>
                }
              />
            );
          })
        )}
      </div>

      <button
        type="button"
        onClick={() => void refresh()}
        className="w-full py-2 rounded-xl border border-gray-200 bg-white text-xs text-travel-muted hover:text-gray-900 hover:bg-gray-50 shadow-sm"
      >
        Refresh feed
      </button>
    </div>
  );
}
