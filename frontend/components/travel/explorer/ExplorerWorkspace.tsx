'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTravelAuth } from '@/components/travel/useTravelAuth';
import ExploreFlightsHotelsTab from '@/components/travel/explorer/ExploreFlightsHotelsTab';
import ExploreHotelsTab from '@/components/travel/explorer/ExploreHotelsTab';
import ExploreRequirementsTab from '@/components/travel/explorer/ExploreRequirementsTab';
import ExploreTripRecordTab from '@/components/travel/explorer/ExploreTripRecordTab';
import ExplorePostTripTab from '@/components/travel/explorer/ExplorePostTripTab';
import {
  api,
  TRAVEL_ACTIVE_TEAM_STORAGE_KEY,
  type CitySuggestion,
  type ExplorerEventOption,
  type Item,
} from '@/lib/api';
import { dedupeItemsById, filterTeamTripIdeas } from '@/lib/travelTeamPipeline';
import { useApproveBookingPanel } from '@/components/travel/approve/useApproveBookingPanel';
import TeamSelectorDropdown from '@/components/travel/TeamSelectorDropdown';

const DEFAULT_OPTION_ESTIMATE_USD = 5000;

function cityFromItem(item: Item): string | null {
  const travel = item.travel;
  if (!travel || typeof travel !== 'object') return null;
  const raw = travel.location;
  if (typeof raw !== 'string') return null;
  const city = raw.split(',')[0]?.trim();
  return city ? city.slice(0, 80) : null;
}

export type ExploreTabId =
  | 'flights'
  | 'hotels'
  | 'trip'
  | 'requirements'
  | 'policies'
  | 'destination'
  | 'packing'
  | 'post';

const EXPLORE_TAB_LABELS: { id: ExploreTabId; label: string }[] = [
  { id: 'flights', label: 'Approve trips' },
  { id: 'hotels', label: 'Hotels' },
  { id: 'trip', label: 'Trip record' },
  { id: 'requirements', label: 'Requirements' },
  { id: 'policies', label: 'Policies' },
  { id: 'destination', label: 'Destination' },
  { id: 'packing', label: 'Packing' },
  { id: 'post', label: 'Post-trip' },
];

function parseExploreTab(raw: string | null): ExploreTabId {
  if (raw === 'events') return 'flights';
  const allowed = new Set(EXPLORE_TAB_LABELS.map((t) => t.id));
  if (raw && allowed.has(raw as ExploreTabId)) return raw as ExploreTabId;
  return 'flights';
}

export function ExplorerWorkspace({ initialTab }: { initialTab?: ExploreTabId }) {
  const pathname = usePathname() || '/explorer';
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useTravelAuth();
  const [exploreTab, setExploreTabState] = useState<ExploreTabId>(initialTab ?? 'flights');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [panelItems, setPanelItems] = useState<Item[]>([]);
  const [teamCities, setTeamCities] = useState<string[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [presetInput, setPresetInput] = useState('');
  const [presetSuggestions, setPresetSuggestions] = useState<CitySuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<CitySuggestion | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [approvePlanningWindow, setApprovePlanningWindow] = useState<{ start: string; end: string } | null>(null);
  const [approveOverlapPresets, setApproveOverlapPresets] = useState<{ start: string; end: string }[]>([]);
  const [teamFeedItems, setTeamFeedItems] = useState<Item[]>([]);

  const onApprovePlanningWindow = useCallback((w: { start: string; end: string } | null) => {
    setApprovePlanningWindow(w);
  }, []);

  const onApproveOverlapPresets = useCallback((windows: { start: string; end: string }[]) => {
    setApproveOverlapPresets(windows);
  }, []);

  /** Same rows as Home Approve "Team trip ideas": team return-feed only, deduped, same status filter. */
  const approvePipelineItems = useMemo(
    () => filterTeamTripIdeas(dedupeItemsById(teamFeedItems)),
    [teamFeedItems],
  );

  const refreshPanelItems = useCallback(async () => {
    try {
      setPanelItems(await api.getItems());
    } catch {
      setPanelItems([]);
    }
  }, []);

  useEffect(() => {
    if (initialTab) {
      setExploreTabState(initialTab);
      return;
    }
    if (pathname?.startsWith('/explore/')) {
      const seg = pathname.split('/').filter(Boolean).pop() || '';
      setExploreTabState(parseExploreTab(seg === 'explore' ? null : seg));
      return;
    }
    setExploreTabState(parseExploreTab(searchParams.get('tab')));
  }, [initialTab, pathname, searchParams]);

  const setExploreTab = useCallback(
    (id: ExploreTabId) => {
      setExploreTabState(id);
      router.push(`/explore/${id}`);
    },
    [router]
  );

  useEffect(() => {
    if (exploreTab === 'flights' || exploreTab === 'trip' || exploreTab === 'hotels') {
      void refreshPanelItems();
    }
  }, [exploreTab, refreshPanelItems]);

  useEffect(() => {
    if (!teamId) {
      setTeamFeedItems([]);
      return;
    }
    let cancelled = false;
    void api
      .getTeamReturnFeed(teamId)
      .then((items) => {
        if (!cancelled) setTeamFeedItems(items);
      })
      .catch(() => {
        if (!cancelled) setTeamFeedItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  useEffect(() => {
    const activeTeamId = typeof window !== 'undefined' ? localStorage.getItem(TRAVEL_ACTIVE_TEAM_STORAGE_KEY) : null;
    setTeamId(activeTeamId);
    if (!activeTeamId) {
      setTeamCities([]);
      return;
    }
    let mounted = true;
    void (async () => {
      try {
        const [items, detail] = await Promise.all([api.getTeamReturnFeed(activeTeamId), api.getTeam(activeTeamId)]);
        if (!mounted) return;
        const fromItems = Array.from(
          new Set(
            items
              .map(cityFromItem)
              .filter((c): c is string => Boolean(c))
          )
        );
        const fromPresets = Array.from(new Set((detail.cityPresets || []).map((c) => c.trim()).filter(Boolean)));
        const unique = Array.from(new Set([...fromPresets, ...fromItems])).sort((a, b) => a.localeCompare(b)).slice(0, 30);
        setTeamCities(unique);
      } catch {
        if (!mounted) return;
        setTeamCities([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user?.email]);

  const savePresetCities = async (nextCities: string[]) => {
    if (!teamId) return;
    await api.setTeamCityPresets(teamId, nextCities);
  };

  const addPresetCity = async () => {
    const raw = presetInput.trim().replace(/\s+/g, ' ');
    let picked = selectedPreset;
    if (!picked) {
      let candidates = presetSuggestions;
      if (!candidates.length && raw.length >= 2) {
        try {
          const resp = await api.suggestExplorerCities(raw);
          candidates = resp.suggestions;
        } catch {
          candidates = [];
        }
      }
      picked =
        candidates.find((s) => s.label.toLowerCase() === raw.toLowerCase()) ||
        candidates.find((s) => s.city.toLowerCase() === raw.toLowerCase()) ||
        null;
    }
    if (!picked) {
      setSearchError('Choose a city from suggestions before adding.');
      return;
    }
    const city = picked.city;
    if (teamCities.some((c) => c.toLowerCase() === city.toLowerCase())) {
      setPresetInput('');
      return;
    }
      const next = [...teamCities, city].sort((a, b) => a.localeCompare(b)).slice(0, 30);
    try {
      await savePresetCities(next);
      setTeamCities(next);
      setPresetInput('');
      setPresetSuggestions([]);
      setSelectedPreset(null);
      setSearchError(null);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Could not save preset city');
    }
  };

  useEffect(() => {
    const q = presetInput.trim();
    if (q.length < 2 || !teamId || selectedPreset) {
      setPresetSuggestions([]);
      return;
    }
    let cancelled = false;
    setSuggestLoading(true);
    const timer = setTimeout(() => {
      void api
        .suggestExplorerCities(q)
        .then(({ suggestions }) => {
          if (!cancelled) setPresetSuggestions(suggestions);
        })
        .catch(() => {
          if (!cancelled) setPresetSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setSuggestLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [presetInput, teamId, selectedPreset]);

  const removePresetCity = async (city: string) => {
    const next = teamCities.filter((c) => c !== city);
    try {
      await savePresetCities(next);
      setTeamCities(next);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Could not remove preset city');
    }
  };

  const approvePanel = useApproveBookingPanel(panelItems, refreshPanelItems);

  const addEventOptionToPlan = async (opt: ExplorerEventOption) => {
    if (!user?.email) return;
    const title = `${opt.title}${opt.startAt ? ` (${opt.startAt})` : ''}`;
    const lines = [
      opt.snippet || null,
      opt.url ? `Source: ${opt.url}` : null,
      opt.cost?.totalEstimated != null ? `Estimated total: $${Math.round(opt.cost.totalEstimated)}` : null,
      opt.availability ? `Availability: ${opt.availability.availableCount}/${opt.availability.totalMembers}` : null,
    ].filter(Boolean) as string[];
    setBusyId(opt.optionId);
    try {
      await api.createItem({
        title: title.slice(0, 200),
        description: lines.join('\n\n') || 'Explorer option',
        imageUrls: opt.imageUrl ? [opt.imageUrl] : undefined,
        travel: {
          location: opt.city,
          costEstimate: Math.round(opt.cost?.totalEstimated || DEFAULT_OPTION_ESTIMATE_USD),
          tags: ['events', opt.source || 'explorer', opt.city],
          tripType: 'research',
          sourceUrl: opt.url,
          startDate: opt.startAt ? opt.startAt.slice(0, 10) : undefined,
          ...(opt.imageUrl ? { imageUrl: opt.imageUrl } : {}),
          addedBy: user.email || 'You',
          opportunityStatus: 'draft',
        },
        ...(teamId ? { teamId } : {}),
      });
      setToast(`Added option for “${opt.title}” to your plan.`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Could not add');
    } finally {
      setBusyId(null);
    }
  };

  if (loading || !user) {
    return <div className="py-24 text-center text-travel-muted text-sm">Signing you in…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2 mt-2">
        <TeamSelectorDropdown />
      </div>
      <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide border-b border-gray-200/80">
        {EXPLORE_TAB_LABELS.map((t) => {
          const active = exploreTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setExploreTab(t.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {exploreTab === 'hotels' ? <ExploreHotelsTab /> : null}

      {exploreTab === 'flights' ? (
        <ExploreFlightsHotelsTab
          teamId={teamId}
          teamCities={teamCities}
          approvePipelineItems={approvePipelineItems}
          approvePlanningWindow={approvePlanningWindow}
          approveOverlapPresets={approveOverlapPresets}
          onApprovePlanningWindow={onApprovePlanningWindow}
          onApproveOverlapPresets={onApproveOverlapPresets}
          onAddEventOption={addEventOptionToPlan}
          busyId={busyId}
          toast={toast}
          onFinalize={approvePanel.onFinalize}
          finalizeBusy={approvePanel.finalizeBusy}
          approveMsg={approvePanel.approveMsg}
          onQuotesPersisted={
            teamId
              ? () => {
                  void api.getTeamReturnFeed(teamId).then(setTeamFeedItems);
                }
              : undefined
          }
        />
      ) : null}

      {exploreTab === 'trip' ? <ExploreTripRecordTab panelItems={panelItems} /> : null}

      {exploreTab === 'requirements' ? <ExploreRequirementsTab /> : null}

      {exploreTab === 'policies' ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-3 text-sm text-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Policies</h2>
            <p className="text-travel-muted mt-1">
              Am I following policy? Use these checkpoints before you book, then ask Copilot to translate anything
              fuzzy into plain language.
            </p>
          </div>
          <ul className="list-disc list-inside space-y-1.5 text-xs text-travel-muted border border-gray-100 rounded-xl p-3 bg-gray-50/80">
            <li>Advance booking windows and fare caps (economy vs premium) for your route.</li>
            <li>Non-refundable vs flexible tickets — savings vs change protection under typical T&amp;E rules.</li>
            <li>Hotel tier and nightly limits; incidentals that need a receipt or per-diem note.</li>
            <li>When a policy exception needs written approval — attach context, not just the fare.</li>
          </ul>
          <Link
            href="/assistant?prefill=Explain%20what%20our%20typical%20corporate%20travel%20policy%20would%20care%20about%20for%20my%20trip."
            className="inline-flex text-xs font-semibold text-blue-700 hover:underline"
          >
            Run a policy pass in Copilot
          </Link>
        </div>
      ) : null}

      {exploreTab === 'destination' ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2 text-sm text-gray-700">
          <h2 className="text-lg font-semibold text-gray-900">Destination</h2>
          <p className="text-travel-muted">Weather, office locations, and local context appear here as you attach trips and documents.</p>
        </div>
      ) : null}

      {exploreTab === 'packing' ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 space-y-2 text-sm text-gray-700">
          <h2 className="text-lg font-semibold text-gray-900">Packing</h2>
          <p className="text-travel-muted">Use Home checklist and Copilot for outfit and packing suggestions vs destination weather.</p>
        </div>
      ) : null}

      {exploreTab === 'post' ? <ExplorePostTripTab /> : null}
    </div>
  );
}
