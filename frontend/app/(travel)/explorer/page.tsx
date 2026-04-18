'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Search, SlidersHorizontal } from 'lucide-react';
import { useTravelStage } from '@/lib/travelContext';
import { useTravelAuth } from '@/components/travel/useTravelAuth';
import OpportunityCard from '@/components/travel/OpportunityCard';
import {
  api,
  TRAVEL_ACTIVE_TEAM_STORAGE_KEY,
  type CitySuggestion,
  type ExplorerAiHelpResponse,
  type ExplorerAvailabilityCoverage,
  type ExplorerEventOption,
  type ExplorerOpportunity,
  type ExplorerItineraryPackage,
  type Item,
  type TeamCalendarCoverage,
} from '@/lib/api';
import PolicyHint from '@/components/travel/PolicyHint';
import { dedupeItemsById, filterTeamTripIdeas } from '@/lib/travelTeamPipeline';
import { getTravelPayload, isTravelItem } from '@/lib/travelItem';
import { useApproveBookingPanel } from '@/components/travel/approve/useApproveBookingPanel';
import TravelDayItinerary from '@/components/travel/TravelDayItinerary';
import ApprovedEventsLivePricing from '@/components/travel/approve/ApprovedEventsLivePricing';
import ApproveExplorerPlanningPanel from '@/components/travel/approve/ApproveExplorerPlanningPanel';
import { TravelPricingOriginProvider } from '@/components/travel/approve/TravelPricingOriginContext';

const MAX_CITIES = 5;
const MAX_PER_CITY = 8;

function truncateSnippet(text: string, max = 140): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function sourceLabel(source?: ExplorerOpportunity['source']): string {
  if (source === 'ticketmaster') return 'ticketmaster-api';
  if (source === 'openstreetmap') return 'openstreetmap';
  return 'duckduckgo';
}

function isPricingPipelineStatus(status: string | undefined): boolean {
  return status === 'submitted' || status === 'pending' || status === 'approved' || status === 'needs_changes';
}

function cityFromItem(item: Item): string | null {
  const travel = item.travel;
  if (!travel || typeof travel !== 'object') return null;
  const raw = travel.location;
  if (typeof raw !== 'string') return null;
  const city = raw.split(',')[0]?.trim();
  return city ? city.slice(0, 80) : null;
}

function defaultIsoDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function approvalSignalForStatus(status: string | undefined): number {
  if (status === 'approved') return 1;
  if (status === 'pending') return 0.75;
  if (status === 'submitted') return 0.65;
  if (status === 'needs_changes') return 0.35;
  return 0.5;
}

export default function ExplorerPage() {
  const { stage } = useTravelStage();
  const { user, loading } = useTravelAuth();
  const [keyword, setKeyword] = useState('');
  const [maxBudget, setMaxBudget] = useState(5000);
  const [showFilters, setShowFilters] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [panelItems, setPanelItems] = useState<Item[]>([]);
  const [teamCities, setTeamCities] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [presetInput, setPresetInput] = useState('');
  const [presetSuggestions, setPresetSuggestions] = useState<CitySuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<CitySuggestion | null>(null);
  const [opportunities, setOpportunities] = useState<ExplorerOpportunity[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchedLabel, setSearchedLabel] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'relevance'>('date');
  const [maxPerCity, setMaxPerCity] = useState(MAX_PER_CITY);
  const [sourceTicketmaster, setSourceTicketmaster] = useState(true);
  const [sourceDuckduckgo, setSourceDuckduckgo] = useState(true);
  const [sourceOpenstreetmap, setSourceOpenstreetmap] = useState(true);
  const [eventTypes, setEventTypes] = useState<Array<'music' | 'sports' | 'arts' | 'film' | 'miscellaneous'>>([]);
  const [maxPrice, setMaxPrice] = useState('');
  const [expandedOpportunityIds, setExpandedOpportunityIds] = useState<Record<string, boolean>>({});
  const [requireAllMembersFree, setRequireAllMembersFree] = useState(false);
  const [availabilityStartDate, setAvailabilityStartDate] = useState('');
  const [availabilityEndDate, setAvailabilityEndDate] = useState('');
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarCoverage, setCalendarCoverage] = useState<TeamCalendarCoverage | null>(null);
  const [availabilityCoverage, setAvailabilityCoverage] = useState<ExplorerAvailabilityCoverage | null>(null);
  const [eventOptions, setEventOptions] = useState<ExplorerEventOption[]>([]);
  const [itineraryPackages, setItineraryPackages] = useState<ExplorerItineraryPackage[]>([]);
  const [resultsView, setResultsView] = useState<'events' | 'packages' | 'ai_help'>('events');
  const [manualStartDate, setManualStartDate] = useState('');
  const [manualEndDate, setManualEndDate] = useState('');
  const [manualAvailabilitySaving, setManualAvailabilitySaving] = useState(false);
  const [manualAvailabilityCount, setManualAvailabilityCount] = useState(0);
  const [approvePlanningWindow, setApprovePlanningWindow] = useState<{ start: string; end: string } | null>(null);
  const [approveOverlapPresets, setApproveOverlapPresets] = useState<{ start: string; end: string }[]>([]);
  const [teamFeedItems, setTeamFeedItems] = useState<Item[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiRefresh, setAiRefresh] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState<ExplorerAiHelpResponse | null>(null);

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
    if (stage === 'approve' || stage === 'travel') {
      void refreshPanelItems();
    }
  }, [stage, refreshPanelItems]);

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
      setSelectedCities([]);
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
        setSelectedCities((prev) => {
          if (prev.length) {
            return prev.filter((c) => unique.includes(c)).slice(0, MAX_CITIES);
          }
          return unique.slice(0, MAX_CITIES);
        });
      } catch {
        if (!mounted) return;
        setTeamCities([]);
        setSelectedCities([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [stage, user?.email]);

  useEffect(() => {
    if (!teamId) {
      setCalendarCoverage(null);
      setCalendarConnected(false);
      setManualAvailabilityCount(0);
      return;
    }
    void (async () => {
      try {
        const [status, coverage, availability] = await Promise.all([
          api.getGoogleCalendarStatus(),
          api.getTeamCalendarCoverage(teamId),
          api.getTeamAvailability(teamId),
        ]);
        setCalendarConnected(Boolean(status.connected));
        setCalendarCoverage(coverage);
        const mine = availability.members.find((m) => (m.email || '').toLowerCase() === (user?.email || '').toLowerCase());
        setManualAvailabilityCount(mine?.windows?.length || 0);
      } catch {
        setCalendarCoverage(null);
        setCalendarConnected(false);
        setManualAvailabilityCount(0);
      }
    })();
  }, [teamId, user?.email]);

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
      setSelectedCities((prev) => (prev.includes(city) || prev.length >= MAX_CITIES ? prev : [...prev, city]));
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
      setSelectedCities((prev) => prev.filter((c) => c !== city));
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Could not remove preset city');
    }
  };

  const approvePanel = useApproveBookingPanel(panelItems, refreshPanelItems);

  const runSearch = async () => {
    const query = keyword.trim();
    const cities = selectedCities.slice(0, MAX_CITIES);
    const sources: Array<'ticketmaster' | 'duckduckgo' | 'openstreetmap'> = [];
    if (sourceTicketmaster) sources.push('ticketmaster');
    if (sourceDuckduckgo) sources.push('duckduckgo');
    if (sourceOpenstreetmap) sources.push('openstreetmap');
    setSearchError(null);
    setToast(null);
    if (startDate && endDate && startDate > endDate) {
      setSearchError('Start date must be before end date.');
      return;
    }
    if (!sources.length) {
      setSearchError('Select at least one source.');
      return;
    }
    const parsedMaxPrice = maxPrice.trim() ? Number(maxPrice) : null;
    if (parsedMaxPrice != null && (!Number.isFinite(parsedMaxPrice) || parsedMaxPrice < 0)) {
      setSearchError('Max ticket price must be a valid positive number.');
      return;
    }
    if (requireAllMembersFree) {
      if (!teamId) {
        setSearchError('Select an active team to use calendar availability filtering.');
        return;
      }
      if (!availabilityStartDate || !availabilityEndDate) {
        setSearchError('Pick availability window dates to filter by team calendar.');
        return;
      }
      if (availabilityStartDate > availabilityEndDate) {
        setSearchError('Availability window start must be before end.');
        return;
      }
    }
    if (!query && !cities.length) {
      setSearchError('Enter a keyword or select at least one city.');
      setOpportunities([]);
      setSearchedLabel(null);
      return;
    }
    setSearchLoading(true);
    setSearchedLabel(
      [
        query ? `Keyword: ${query}` : null,
        cities.length ? `Cities: ${cities.join(', ')}` : 'All cities',
        startDate || endDate ? `Dates: ${startDate || 'Any'} to ${endDate || 'Any'}` : null,
        `Sort: ${sortBy}`,
        eventTypes.length ? `Types: ${eventTypes.join(', ')}` : null,
        parsedMaxPrice != null ? `Max price: $${parsedMaxPrice}` : null,
        requireAllMembersFree && availabilityStartDate && availabilityEndDate
          ? `Team free: ${availabilityStartDate} to ${availabilityEndDate}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    );
    try {
      const {
        opportunities: rows,
        availabilityCoverage: coverage,
        eventOptions: optionRows,
        itineraryPackages: packageRows,
      } = await api.searchExplorerOpportunities({
        ...(query ? { query } : {}),
        ...(cities.length ? { cities } : {}),
        maxPerCity,
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        sortBy,
        sources,
        ...(eventTypes.length ? { eventTypes } : {}),
        ...(parsedMaxPrice != null ? { maxPrice: parsedMaxPrice } : {}),
        ...(requireAllMembersFree && teamId ? { teamId } : {}),
        ...(requireAllMembersFree ? { requireAllMembersFree: true } : {}),
        ...(requireAllMembersFree && availabilityStartDate
          ? { availabilityWindowStart: `${availabilityStartDate}T00:00:00Z` }
          : {}),
        ...(requireAllMembersFree && availabilityEndDate
          ? { availabilityWindowEnd: `${availabilityEndDate}T23:59:59Z` }
          : {}),
      });
      setOpportunities(rows);
      setAvailabilityCoverage(coverage || null);
      setEventOptions(optionRows || []);
      setItineraryPackages(packageRows || []);
      if (!rows.length) {
        setSearchError('No matching events found. Try a broader keyword or fewer city filters.');
      }
    } catch (e) {
      setOpportunities([]);
      setAvailabilityCoverage(null);
      setEventOptions([]);
      setItineraryPackages([]);
      setSearchError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  const runAiHelp = async () => {
    const prompt = aiPrompt.trim();
    if (!prompt) {
      setAiError('Enter a question or goal for AI Help.');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const parsedAiMaxPrice = maxPrice.trim() ? Number(maxPrice) : null;
      const pricingStart =
        availabilityStartDate || startDate || approvePlanningWindow?.start || defaultIsoDate(14);
      const pricingEnd =
        availabilityEndDate || endDate || approvePlanningWindow?.end || defaultIsoDate(16);

      const pricingEvents = approvePipelineItems
        .filter((item) => {
          if (!isTravelItem(item)) return false;
          const t = getTravelPayload(item);
          return isPricingPipelineStatus(t?.opportunityStatus);
        })
        .slice(0, 8)
        .map((item) => {
          const t = getTravelPayload(item);
          const outbound = (typeof t?.startDate === 'string' && t.startDate.slice(0, 10)) || pricingStart;
          const inbound = (typeof t?.endDate === 'string' && t.endDate.slice(0, 10)) || pricingEnd;
          return {
            itemId: item._id || undefined,
            title: item.title,
            destinationQuery: t?.location || '',
            outboundDate: outbound,
            inboundDate: inbound,
            checkIn: outbound,
            checkOut: inbound,
            adults: 1,
            eventStartDate: typeof t?.startDate === 'string' ? t.startDate.slice(0, 10) : undefined,
            eventEndDate: typeof t?.endDate === 'string' ? t.endDate.slice(0, 10) : undefined,
            approvalSignal: approvalSignalForStatus(t?.opportunityStatus),
          };
        });

      const response = await api.getExplorerAiHelp({
        prompt,
        refresh: aiRefresh,
        context: {
          teamId,
          selectedCities,
          keyword: keyword.trim() || null,
          requireAllMembersFree,
          availabilityWindow:
            availabilityStartDate && availabilityEndDate
              ? { start: availabilityStartDate, end: availabilityEndDate }
              : null,
          availabilityCoverage,
          searchedLabel,
          eventOptions: eventOptions.slice(0, 20),
          itineraryPackages: itineraryPackages.slice(0, 10),
        },
        refreshSearchParams: {
          ...(keyword.trim() ? { query: keyword.trim() } : {}),
          ...(selectedCities.length ? { cities: selectedCities } : {}),
          maxPerCity,
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
          sortBy,
          sources: [
            ...(sourceTicketmaster ? (['ticketmaster'] as const) : []),
            ...(sourceDuckduckgo ? (['duckduckgo'] as const) : []),
            ...(sourceOpenstreetmap ? (['openstreetmap'] as const) : []),
          ],
          ...(eventTypes.length ? { eventTypes } : {}),
          ...(parsedAiMaxPrice != null && Number.isFinite(parsedAiMaxPrice) ? { maxPrice: parsedAiMaxPrice } : {}),
          ...(teamId ? { teamId } : {}),
          ...(requireAllMembersFree ? { requireAllMembersFree: true } : {}),
          ...(availabilityStartDate ? { availabilityWindowStart: `${availabilityStartDate}T00:00:00Z` } : {}),
          ...(availabilityEndDate ? { availabilityWindowEnd: `${availabilityEndDate}T23:59:59Z` } : {}),
        },
        ...(pricingEvents.length
          ? {
              refreshPricingParams: {
                originIata: 'ORD',
                events: pricingEvents,
              },
            }
          : {}),
      });
      setAiResponse(response);
      setResultsView('ai_help');
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'AI Help request failed');
    } finally {
      setAiLoading(false);
    }
  };

  const addToPlan = async (o: ExplorerOpportunity) => {
    if (!user?.email) return;
    setBusyId(o.id);
    setToast(null);
    const descLines = [
      `${o.title} — ${sourceLabel(o.source)} result for ${o.city}.`,
      o.snippet ? o.snippet : null,
      o.url ? `Source: ${o.url}` : null,
    ].filter(Boolean) as string[];
    try {
      const created = await api.createItem({
        title: o.title.slice(0, 200),
        description: descLines.join('\n\n'),
        imageUrls: o.imageUrl ? [o.imageUrl] : undefined,
        travel: {
          location: o.city,
          costEstimate: maxBudget,
          tags: ['events', sourceLabel(o.source), o.city],
          tripType: 'research',
          ...(o.imageUrl ? { imageUrl: o.imageUrl } : {}),
          sourceUrl: o.url,
          addedBy: user.email || 'You',
          opportunityStatus: 'draft',
        },
        ...(teamId ? { teamId } : {}),
      });
      if (teamId) {
        const voteMessage = `[SYSTEM_EVENT]${JSON.stringify({
          type: 'event_vote',
          itemId: created._id || null,
          title: o.title,
          city: o.city,
          description: o.snippet || '',
          imageUrl: o.imageUrl || '',
          sourceUrl: o.url || '',
        })}`;
        try {
          await api.sendTeamMessage(teamId, voteMessage, { invokeAssistant: false });
        } catch {
          // Do not fail item creation if chat post fails.
        }
      }
      setToast(`Added “${o.title}” to your plan.`);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Could not add');
    } finally {
      setBusyId(null);
    }
  };

  const toggleCity = (city: string) => {
    setSelectedCities((prev) => {
      if (prev.includes(city)) {
        return prev.filter((c) => c !== city);
      }
      if (prev.length >= MAX_CITIES) {
        return prev;
      }
      return [...prev, city];
    });
  };

  const toggleEventType = (type: 'music' | 'sports' | 'arts' | 'film' | 'miscellaneous') => {
    setEventTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  };

  const toggleOpportunityExpanded = (id: string) => {
    setExpandedOpportunityIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
          costEstimate: Math.round(opt.cost?.totalEstimated || maxBudget),
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

  const addPackageToPlan = async (pkg: ExplorerItineraryPackage) => {
    const first = pkg.options?.[0];
    if (!first) return;
    await addEventOptionToPlan(first);
  };

  const grouped = opportunities.reduce<Record<string, ExplorerOpportunity[]>>((acc, row) => {
    const city = row.city?.trim() || 'Other';
    if (!acc[city]) acc[city] = [];
    acc[city].push(row);
    return acc;
  }, {});
  const groupedCities = Object.keys(grouped).sort((a, b) => a.localeCompare(b));

  if (loading || !user) {
    return <div className="py-24 text-center text-travel-muted text-sm">Signing you in…</div>;
  }

  if (stage === 'approve') {
    return (
      <TravelPricingOriginProvider originHintCities={teamCities}>
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Approve trips</h2>
            <p className="text-sm text-travel-muted mt-1">
              Work through home airport, team window, availability, and search — then load flight and hotel quotes in the grid.
            </p>
          </div>

          <ApproveExplorerPlanningPanel
            teamId={teamId}
            teamCities={teamCities}
            pipelineItems={approvePipelineItems}
            onPlanningWindowChange={onApprovePlanningWindow}
            onOverlapPresetsChange={onApproveOverlapPresets}
            onAddEventOption={addEventOptionToPlan}
            busyOptionId={busyId}
          />

          {toast ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{toast}</div>
          ) : null}

          <section id="approve-step-quotes" className="scroll-mt-28 space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 px-1">5 · Quotes &amp; grid</h3>
            <ApprovedEventsLivePricing
              hideFlyingFrom
              items={approvePipelineItems}
              planningWindow={approvePlanningWindow}
              overlapPresets={approveOverlapPresets}
              originHintCities={teamCities}
              onFinalizeBooking={approvePanel.onFinalize}
              finalizeBusy={approvePanel.finalizeBusy}
              onQuotesPersisted={
                teamId
                  ? () => {
                      void api.getTeamReturnFeed(teamId).then(setTeamFeedItems);
                    }
                  : undefined
              }
            />
          </section>

          {approvePanel.approveMsg ? (
            <p className="text-xs text-center text-travel-muted border border-gray-200 bg-gray-50 rounded-lg py-2 px-3">
              {approvePanel.approveMsg}
            </p>
          ) : null}
        </div>
      </TravelPricingOriginProvider>
    );
  }

  if (stage === 'travel') {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Today & trip record</h2>
          <p className="text-sm text-travel-muted mt-1">Same trip record as Home — checklist and links from your saved pricing.</p>
        </div>
        <TravelDayItinerary items={panelItems} compact />
      </div>
    );
  }

  if (stage === 'return') {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Memory + content builder</h2>
        <p className="text-sm text-travel-muted">
          Upload trip photos in the full profile editor or paste context into the AI Assistant for captions and post ideas.
        </p>
        <ul className="text-sm text-gray-700 space-y-2 list-disc pl-4">
          <li>Instagram-ready captions</li>
          <li>LinkedIn post variants</li>
          <li>Export as plain text</li>
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Opportunity explorer</h2>
        <p className="text-sm text-travel-muted mt-1">
          Search events by keyword, then filter by your team&apos;s saved cities when needed.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-xs text-travel-muted flex flex-wrap items-center gap-1">
          <PolicyHint title="Policy filters would connect to your official travel policy in production.">
            Web results are unvetted — confirm with policy before booking.
          </PolicyHint>
        </p>

        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" aria-hidden />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void runSearch();
              }}
              placeholder="Search events, conferences, expos, attractions..."
              disabled={searchLoading}
              className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border-none rounded-2xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all placeholder:text-gray-400"
              aria-label="Event keyword"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center text-white hover:bg-gray-800 transition-all shadow-lg"
            aria-pressed={showFilters}
            aria-label="Toggle filters"
          >
            <SlidersHorizontal className="w-5 h-5" aria-hidden />
          </button>

          <button
            type="button"
            onClick={() => void runSearch()}
            disabled={searchLoading}
            className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center text-white hover:bg-gray-800 disabled:opacity-50 transition-all shadow-lg"
            aria-label="Search"
          >
            <ArrowRight className="w-5 h-5" aria-hidden />
          </button>
        </div>

        <div className="rounded-2xl bg-white border border-gray-200 px-4 py-3 shadow-sm">
          <p className="text-xs text-travel-muted mb-2">
            Team cities (choose up to {MAX_CITIES}, optional for global search)
          </p>
          <div className="flex gap-2 mb-2">
            <input
              value={presetInput}
              onChange={(e) => {
                setPresetInput(e.target.value);
                setSelectedPreset(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void addPresetCity();
                }
              }}
              placeholder="Add preset city (e.g. Chicago)"
              className="flex-1 rounded-xl bg-gray-50 border-none px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
              disabled={!teamId}
            />
            <button
              type="button"
              onClick={() => void addPresetCity()}
              disabled={!teamId || !presetInput.trim()}
              className="px-3 rounded-xl bg-gray-900 text-white text-xs font-medium disabled:opacity-50"
            >
              Add
            </button>
          </div>
          {teamId && presetInput.trim().length >= 2 ? (
            <div className="mb-2">
              {suggestLoading ? (
                <p className="text-[11px] text-travel-muted">Searching cities…</p>
              ) : presetSuggestions.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {presetSuggestions.map((s) => (
                    <button
                      key={`${s.city}-${s.label}`}
                      type="button"
                      onClick={() => {
                        setPresetInput(s.label);
                        setSelectedPreset(s);
                        setPresetSuggestions([]);
                      }}
                      className="text-[11px] px-2 py-1 rounded-md bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              ) : selectedPreset ? (
                <p className="text-[11px] text-emerald-700">Selected: {selectedPreset.label}</p>
              ) : (
                <p className="text-[11px] text-amber-700">No likely city matches.</p>
              )}
            </div>
          ) : null}
          {teamCities.length ? (
            <div className="flex flex-wrap gap-2">
              {teamCities.map((city) => {
                const active = selectedCities.includes(city);
                return (
                  <div key={city} className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleCity(city)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition ${
                        active
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                      aria-pressed={active}
                    >
                      {city}
                    </button>
                    {teamId ? (
                      <button
                        type="button"
                        onClick={() => void removePresetCity(city)}
                        className="text-[10px] px-1.5 py-1 rounded-md border border-gray-200 text-gray-500 hover:text-red-700 hover:border-red-200"
                        aria-label={`Remove ${city}`}
                      >
                        x
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-travel-muted">
              No team cities found yet. Add a preset city above or search globally.
            </p>
          )}
        </div>

        {showFilters ? (
          <div className="rounded-2xl bg-white border border-gray-200 px-4 py-3 shadow-sm space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs text-travel-muted">
                Start date
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-2 w-full rounded-xl bg-gray-50 border-none px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
                />
              </label>
              <label className="text-xs text-travel-muted">
                End date
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-2 w-full rounded-xl bg-gray-50 border-none px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
                />
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="text-xs text-travel-muted">
                Sort results
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy((e.target.value as 'date' | 'relevance') || 'date')}
                  className="mt-2 w-full rounded-xl bg-gray-50 border-none px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
                >
                  <option value="date">Date (soonest first)</option>
                  <option value="relevance">Relevance</option>
                </select>
              </label>
              <label className="text-xs text-travel-muted">
                Max results per city
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={1}
                  value={maxPerCity}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setMaxPerCity(Number.isFinite(n) ? Math.max(1, Math.min(10, n)) : MAX_PER_CITY);
                  }}
                  className="mt-2 w-full rounded-xl bg-gray-50 border-none px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
                />
              </label>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-travel-muted">Event types</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(['music', 'sports', 'arts', 'film', 'miscellaneous'] as const).map((type) => {
                    const active = eventTypes.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => toggleEventType(type)}
                        className={`px-3 py-1.5 rounded-full text-xs border transition ${
                          active
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                        aria-pressed={active}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="text-xs text-travel-muted">
                Max ticket price (USD)
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Any"
                  className="mt-2 w-full rounded-xl bg-gray-50 border-none px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
                />
              </label>
            </div>
            <div>
              <p className="text-xs text-travel-muted">Sources</p>
              <div className="mt-2 flex flex-wrap gap-3">
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={sourceTicketmaster}
                    onChange={(e) => setSourceTicketmaster(e.target.checked)}
                  />
                  Ticketmaster API
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={sourceDuckduckgo}
                    onChange={(e) => setSourceDuckduckgo(e.target.checked)}
                  />
                  DuckDuckGo fallback
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={sourceOpenstreetmap}
                    onChange={(e) => setSourceOpenstreetmap(e.target.checked)}
                  />
                  OpenStreetMap nearby
                </label>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-gray-700 font-medium">Team calendar availability</p>
                <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={requireAllMembersFree}
                    onChange={(e) => setRequireAllMembersFree(e.target.checked)}
                    disabled={!teamId}
                  />
                  Require everyone free
                </label>
              </div>
              {!teamId ? (
                <p className="text-[11px] text-amber-800">Pick an active team on the Team tab first.</p>
              ) : (
                <>
                  <p className="text-[11px] text-travel-muted">
                    Connected calendars: {calendarCoverage?.connectedMembers || 0}/{calendarCoverage?.totalMembers || 0}
                  </p>
                  <p className="text-[11px] text-travel-muted">
                    Manual availability submitted: {calendarCoverage?.manualAvailabilityMembers || 0}/{calendarCoverage?.totalMembers || 0}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void (async () => {
                          const { auth_url } = await api.getGoogleCalendarAuthUrl();
                          window.location.href = auth_url;
                        })()
                      }
                      className="text-[11px] px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white"
                    >
                      {calendarConnected ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
                    </button>
                    {calendarConnected ? (
                      <button
                        type="button"
                        onClick={() =>
                          void (async () => {
                            await api.disconnectGoogleCalendar();
                            setCalendarConnected(false);
                            if (teamId) {
                              const coverage = await api.getTeamCalendarCoverage(teamId);
                              setCalendarCoverage(coverage);
                            }
                          })()
                        }
                        className="text-[11px] px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 text-gray-700"
                      >
                        Disconnect
                      </button>
                    ) : null}
                  </div>
                  {requireAllMembersFree ? (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[11px] text-travel-muted">
                        Free window start
                        <input
                          type="date"
                          value={availabilityStartDate}
                          onChange={(e) => setAvailabilityStartDate(e.target.value)}
                          className="mt-1 w-full rounded-lg bg-white border border-gray-200 px-2 py-1.5 text-xs text-gray-900"
                        />
                      </label>
                      <label className="text-[11px] text-travel-muted">
                        Free window end
                        <input
                          type="date"
                          value={availabilityEndDate}
                          onChange={(e) => setAvailabilityEndDate(e.target.value)}
                          className="mt-1 w-full rounded-lg bg-white border border-gray-200 px-2 py-1.5 text-xs text-gray-900"
                        />
                      </label>
                    </div>
                  ) : null}
                  <div className="rounded-lg border border-gray-200 bg-white p-2 space-y-2">
                    <p className="text-[11px] text-gray-700 font-medium">
                      Manual availability for you ({manualAvailabilityCount} window{manualAvailabilityCount === 1 ? '' : 's'})
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-[11px] text-travel-muted">
                        Start
                        <input
                          type="date"
                          value={manualStartDate}
                          onChange={(e) => setManualStartDate(e.target.value)}
                          className="mt-1 w-full rounded-lg bg-white border border-gray-200 px-2 py-1.5 text-xs text-gray-900"
                        />
                      </label>
                      <label className="text-[11px] text-travel-muted">
                        End
                        <input
                          type="date"
                          value={manualEndDate}
                          onChange={(e) => setManualEndDate(e.target.value)}
                          className="mt-1 w-full rounded-lg bg-white border border-gray-200 px-2 py-1.5 text-xs text-gray-900"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      disabled={manualAvailabilitySaving || !manualStartDate || !manualEndDate || manualStartDate > manualEndDate}
                      onClick={() =>
                        void (async () => {
                          if (!teamId) return;
                          setManualAvailabilitySaving(true);
                          try {
                            const existing = await api.getTeamAvailability(teamId);
                            const mine = existing.members.find(
                              (m) => (m.email || '').toLowerCase() === (user?.email || '').toLowerCase()
                            );
                            const windows = [...(mine?.windows || []), { startDate: manualStartDate, endDate: manualEndDate }];
                            await api.setMyTeamAvailability(teamId, windows);
                            const [coverage, updated] = await Promise.all([
                              api.getTeamCalendarCoverage(teamId),
                              api.getTeamAvailability(teamId),
                            ]);
                            setCalendarCoverage(coverage);
                            const me = updated.members.find(
                              (m) => (m.email || '').toLowerCase() === (user?.email || '').toLowerCase()
                            );
                            setManualAvailabilityCount(me?.windows?.length || 0);
                            setManualStartDate('');
                            setManualEndDate('');
                          } finally {
                            setManualAvailabilitySaving(false);
                          }
                        })()
                      }
                      className="text-[11px] px-2.5 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white"
                    >
                      {manualAvailabilitySaving ? 'Saving…' : 'Add my manual availability'}
                    </button>
                  </div>
                </>
              )}
            </div>
            <label className="text-xs text-travel-muted block">
              Planning budget when adding (USD)
              <input
                type="number"
                min={200}
                step={50}
                value={maxBudget}
                onChange={(e) => setMaxBudget(Number(e.target.value) || 0)}
                className="mt-2 w-full rounded-xl bg-gray-50 border-none px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
              />
            </label>
          </div>
        ) : null}
      </div>
      {searchedLabel && !searchLoading ? (
        <p className="text-xs text-travel-muted">Last search: {searchedLabel}</p>
      ) : null}
      {availabilityCoverage ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
          Team calendars connected: {availabilityCoverage.connectedMembers}/{availabilityCoverage.totalMembers}
          {availabilityCoverage.removedByAvailability != null
            ? ` · Removed by availability: ${availabilityCoverage.removedByAvailability}`
            : ''}
          {availabilityCoverage.includedWithMissingEventTime != null &&
          availabilityCoverage.includedWithMissingEventTime > 0 ? (
            <span className="block mt-1 text-blue-950">
              {availabilityCoverage.includedWithMissingEventTime} result
              {availabilityCoverage.includedWithMissingEventTime === 1 ? '' : 's'} with no event time — included using your
              availability window (see labels on cards).
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setResultsView('events')}
          className={`px-3 py-1.5 rounded-full text-xs border ${
            resultsView === 'events' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'
          }`}
        >
          Event options
        </button>
        <button
          type="button"
          onClick={() => setResultsView('packages')}
          className={`px-3 py-1.5 rounded-full text-xs border ${
            resultsView === 'packages' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'
          }`}
        >
          Package options
        </button>
        <button
          type="button"
          onClick={() => setResultsView('ai_help')}
          className={`px-3 py-1.5 rounded-full text-xs border ${
            resultsView === 'ai_help' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'
          }`}
        >
          AI Help
        </button>
      </div>
      <div className="rounded-xl border border-gray-200 bg-white px-3 py-3 space-y-2">
        <p className="text-xs font-medium text-gray-900">AI Help</p>
        <p className="text-[11px] text-travel-muted">
          Ask for ranked recommendations by team window, attendance fit, and trip cost. Toggle refresh to run fresh live search/quotes first.
        </p>
        <textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="Example: Find the best low-cost option where everyone can attend and explain tradeoffs."
          rows={2}
          className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm text-gray-900"
        />
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-[11px] text-gray-700">
            <input type="checkbox" checked={aiRefresh} onChange={(e) => setAiRefresh(e.target.checked)} />
            Refresh live data before suggestions
          </label>
          <button
            type="button"
            onClick={() => void runAiHelp()}
            disabled={aiLoading}
            className="ml-auto px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold disabled:opacity-50"
          >
            {aiLoading ? 'Thinking…' : 'Ask AI Help'}
          </button>
        </div>
      </div>
      {searchError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{searchError}</div>
      ) : null}
      {aiError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{aiError}</div>
      ) : null}
      {toast ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{toast}</div>
      ) : null}
      <div className="space-y-4 pb-4">
        {resultsView === 'ai_help' ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">AI recommendations</h3>
            {aiResponse ? (
              <>
                <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 whitespace-pre-wrap">
                  {aiResponse.message}
                </div>
                {aiResponse.refreshApplied ? (
                  <p className="text-[11px] text-travel-muted">
                    Refreshed data: {aiResponse.searchRefresh?.opportunityCount ?? 0} opportunities
                    {aiResponse.pricingRefresh?.windowSummaries?.length
                      ? ` · ${aiResponse.pricingRefresh.windowSummaries.length} team windows priced`
                      : ''}
                    {aiResponse.model ? ` · model ${aiResponse.model}` : ''}
                  </p>
                ) : null}
                <div className="space-y-2">
                  {(aiResponse.recommendations || []).map((rec, i) => (
                    <div key={`${rec.title}-${i}`} className="rounded-xl border border-gray-200 bg-white px-3 py-2">
                      <p className="text-sm font-semibold text-gray-900">{rec.title}</p>
                      <p className="text-xs text-travel-muted mt-1">{rec.reasoning}</p>
                      <p className="text-xs text-gray-700 mt-1">
                        {rec.totalEstimated != null ? `Est. total $${Math.round(rec.totalEstimated)}` : 'Est. total unavailable'}
                        {rec.score != null ? ` · score ${Math.round(rec.score)}` : ''}
                      </p>
                      {rec.assumptions?.length ? (
                        <p className="text-[11px] text-amber-800 mt-1">Assumptions: {rec.assumptions.join(', ')}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-travel-muted">Ask AI Help above to get ranked suggestions.</p>
            )}
          </section>
        ) : null}
        {resultsView === 'events' && eventOptions.length ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Ranked event options</h3>
            {eventOptions.map((opt) => (
              <OpportunityCard
                key={opt.optionId}
                title={opt.title}
                subtitle={
                  opt.startAt
                    ? new Date(opt.startAt).toLocaleString()
                    : opt.eventTimeMissing || opt.availability?.eventTimeMissing
                      ? 'No event time on listing'
                      : opt.snippet
                }
                imageUrl={opt.imageUrl}
                footer={
                  <div className="space-y-1 text-xs text-travel-muted">
                    <p>
                      Availability: {opt.availability?.availableCount ?? 0}/{opt.availability?.totalMembers ?? 0}
                      {opt.availability?.evaluatedAgainst === 'availability_window' ? (
                        <span className="block text-amber-900 mt-0.5">
                          Checked vs window {opt.availability.evaluationWindowStart?.slice(0, 10)} →{' '}
                          {opt.availability.evaluationWindowEnd?.slice(0, 10)} (listing had no show time).
                        </span>
                      ) : null}
                    </p>
                    {opt.cost?.pricingUsedAvailabilityWindow ? (
                      <p className="text-amber-800">Estimate uses window start — not a confirmed event date.</p>
                    ) : null}
                    <p>Estimated total: ${Math.round(opt.cost?.totalEstimated || 0)}</p>
                  </div>
                }
                action={
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void addEventOptionToPlan(opt);
                    }}
                    disabled={busyId === opt.optionId}
                    className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold"
                  >
                    {busyId === opt.optionId ? 'Adding…' : 'Add option to plan'}
                  </button>
                }
              />
            ))}
          </section>
        ) : null}
        {resultsView === 'packages' && itineraryPackages.length ? (
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Ranked itinerary packages</h3>
            {itineraryPackages.map((pkg) => (
              <OpportunityCard
                key={pkg.packageId}
                title={pkg.title}
                subtitle={`${pkg.city} · score ${pkg.score ?? 0}`}
                imageUrl={pkg.options?.[0]?.imageUrl}
                footer={
                  <div className="space-y-1 text-xs text-travel-muted">
                    <p>
                      Availability: {pkg.availability?.availableCount ?? 0}/{pkg.availability?.totalMembers ?? 0}
                    </p>
                    <p>Estimated total: ${Math.round(pkg.cost?.totalEstimated || 0)}</p>
                  </div>
                }
                action={
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void addPackageToPlan(pkg);
                    }}
                    disabled={busyId === pkg.packageId}
                    className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-semibold"
                  >
                    {busyId === pkg.packageId ? 'Adding…' : 'Add package to plan'}
                  </button>
                }
              />
            ))}
          </section>
        ) : null}
        {!searchLoading && resultsView !== 'ai_help' && !opportunities.length && !searchError ? (
          <p className="text-sm text-travel-muted">Enter an event keyword and optionally choose city filters, then press Search.</p>
        ) : null}
        {resultsView !== 'ai_help' && groupedCities.map((city) => (
          <section key={city} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">{city}</h3>
              <span className="text-xs text-travel-muted">{grouped[city].length} results</span>
            </div>
            {grouped[city].map((o) => (
              (() => {
                const expanded = Boolean(expandedOpportunityIds[o.id]);
                return (
                  <OpportunityCard
                    key={o.id}
                    title={o.title}
                    subtitle={expanded ? truncateSnippet(o.snippet) : undefined}
                    imageUrl={o.imageUrl}
                    onClick={() => toggleOpportunityExpanded(o.id)}
                    footer={
                      expanded ? (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-1.5">
                            {['events', sourceLabel(o.source), city].map((t) => (
                              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-travel-muted">Tap to view details</p>
                      )
                    }
                    action={
                      expanded ? (
                        <button
                          type="button"
                          disabled={busyId === o.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            void addToPlan(o);
                          }}
                          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold"
                        >
                          {busyId === o.id ? 'Adding…' : 'Add to plan'}
                        </button>
                      ) : null
                    }
                  />
                );
              })()
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
