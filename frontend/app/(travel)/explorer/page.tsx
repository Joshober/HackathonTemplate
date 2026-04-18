'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Search, SlidersHorizontal, Send, CheckCircle2, Loader2, Users } from 'lucide-react';
import { useTravelStage } from '@/lib/travelContext';
import { useTravelAuth } from '@/components/travel/useTravelAuth';
import OpportunityCard from '@/components/travel/OpportunityCard';
import { api, TRAVEL_ACTIVE_TEAM_STORAGE_KEY, type CitySuggestion, type ExplorerOpportunity, type Item } from '@/lib/api';
import PolicyHint from '@/components/travel/PolicyHint';
import ApproveFlightBundles from '@/components/travel/approve/ApproveFlightBundles';
import TravelCostCalculator from '@/components/travel/approve/TravelCostCalculator';
import { useApproveBookingPanel } from '@/components/travel/approve/useApproveBookingPanel';
import ApprovedEventsLivePricing from '@/components/travel/approve/ApprovedEventsLivePricing';
import TeamSelectorDropdown from '@/components/travel/TeamSelectorDropdown';

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

function cityFromItem(item: Item): string | null {
  const travel = item.travel;
  if (!travel || typeof travel !== 'object') return null;
  const raw = travel.location;
  if (typeof raw !== 'string') return null;
  const city = raw.split(',')[0]?.trim();
  return city ? city.slice(0, 80) : null;
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
  const [teamName, setTeamName] = useState<string | null>(null);
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

  // Send-to-Director modal state
  const [isRequestOpen, setIsRequestOpen] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  const openDirectorRequest = () => { setRequestStatus('idle'); setIsRequestOpen(true); };
  const closeDirectorRequest = () => { setIsRequestOpen(false); setTimeout(() => setRequestStatus('idle'), 300); };
  const sendDirectorRequest = async () => {
    setRequestStatus('sending');
    await new Promise((res) => setTimeout(res, 1500));
    setRequestStatus('sent');
  };
  const [sourceTicketmaster, setSourceTicketmaster] = useState(true);
  const [sourceDuckduckgo, setSourceDuckduckgo] = useState(true);
  const [sourceOpenstreetmap, setSourceOpenstreetmap] = useState(true);
  const [eventTypes, setEventTypes] = useState<Array<'music' | 'sports' | 'arts' | 'film' | 'miscellaneous'>>([]);
  const [maxPrice, setMaxPrice] = useState('');

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
    const activeTeamId = typeof window !== 'undefined' ? localStorage.getItem(TRAVEL_ACTIVE_TEAM_STORAGE_KEY) : null;
    setTeamId(activeTeamId);
    if (!activeTeamId) {
      setTeamCities([]);
      setSelectedCities([]);
      setTeamName(null);
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
        setTeamName(detail.name || null);
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
      ]
        .filter(Boolean)
        .join(' · ')
    );
    try {
      const { opportunities: rows } = await api.searchExplorerOpportunities({
        ...(query ? { query } : {}),
        ...(cities.length ? { cities } : {}),
        maxPerCity,
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        sortBy,
        sources,
        ...(eventTypes.length ? { eventTypes } : {}),
        ...(parsedMaxPrice != null ? { maxPrice: parsedMaxPrice } : {}),
      });
      setOpportunities(rows);
      if (!rows.length) {
        setSearchError('No matching events found. Try a broader keyword or fewer city filters.');
      }
    } catch (e) {
      setOpportunities([]);
      setSearchError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearchLoading(false);
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
      await api.createItem({
        title: o.title.slice(0, 200),
        description: descLines.join('\n\n'),
        travel: {
          location: o.city,
          costEstimate: maxBudget,
          tags: ['events', sourceLabel(o.source), o.city],
          tripType: 'research',
          sourceUrl: o.url,
          addedBy: user.email || 'You',
          opportunityStatus: 'draft',
        },
      });
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4 mt-2">
        <TeamSelectorDropdown />
      </div>
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
      {searchError ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{searchError}</div>
      ) : null}
      {toast ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{toast}</div>
      ) : null}
      <div className="space-y-4 pb-4">
        {!searchLoading && !opportunities.length && !searchError ? (
          <p className="text-sm text-travel-muted">Enter an event keyword and optionally choose city filters, then press Search.</p>
        ) : null}
        {groupedCities.map((city) => (
          <section key={city} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">{city}</h3>
              <span className="text-xs text-travel-muted">{grouped[city].length} results</span>
            </div>
            {grouped[city].map((o) => (
              <OpportunityCard
                key={o.id}
                title={o.title}
                subtitle={truncateSnippet(o.snippet)}
                imageUrl={o.imageUrl}
                footer={
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {['events', sourceLabel(o.source), city].map((t) => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {t}
                        </span>
                      ))}
                    </div>
                    {o.url ? (
                      <a
                        href={o.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline inline-block font-medium"
                      >
                        Open link
                      </a>
                    ) : null}
                  </div>
                }
                action={
                  <button
                    type="button"
                    disabled={busyId === o.id}
                    onClick={() => void addToPlan(o)}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold"
                  >
                    {busyId === o.id ? 'Adding…' : 'Add to plan'}
                  </button>
                }
              />
            ))}
          </section>
        ))}
      </div>

      {/* APPROVE STAGE UI APPENDED */}
      {stage === 'approve' && (
        <div className="space-y-6 pt-6 mt-8 border-t border-gray-200">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Approve Phase: Booking &amp; Cost Optimization</h2>
              <p className="text-sm text-travel-muted mt-1">
                Compare flight bundles and run the calculator while your group approvals are ongoing.
              </p>
            </div>

            {/* ── Send Request to Director ── */}
            <button
              onClick={openDirectorRequest}
              className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white px-5 py-3 rounded-2xl font-semibold text-sm shadow-md shadow-violet-500/30 hover:shadow-lg hover:shadow-violet-500/40 hover:scale-[1.02] active:scale-95 transition-all whitespace-nowrap"
            >
              <Send className="w-4 h-4" />
              Send Request to Director
            </button>
          </div>

          <ApprovedEventsLivePricing items={panelItems} />
          <ApproveFlightBundles busy={approvePanel.finalizeBusy} onFinalize={approvePanel.onFinalize} />
          <TravelCostCalculator
            key={approvePanel.eligibleFinalizeItem?._id ?? 'calc-ex'}
            initialFlightLow={approvePanel.eligiblePayload?.bookingEstimate?.flightLow ?? 420}
            initialFlightHigh={approvePanel.eligiblePayload?.bookingEstimate?.flightHigh ?? 510}
            initialHotelPerNight={approvePanel.eligiblePayload?.bookingEstimate?.hotelPerNight ?? 180}
            initialNights={approvePanel.eligiblePayload?.bookingEstimate?.nights ?? 2}
            busy={approvePanel.calcBusy}
            onApply={approvePanel.onApplyCalculator}
            applyLabel="Save estimate to first in-approval trip"
          />
          {approvePanel.approveMsg ? (
            <p className="text-xs text-center text-travel-muted border border-emerald-200 bg-emerald-50 rounded-lg py-2 px-3">
              {approvePanel.approveMsg}
            </p>
          ) : null}
        </div>
      )}

      {/* ── Send-to-Director modal ── */}
      {isRequestOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
            onClick={requestStatus !== 'sending' ? closeDirectorRequest : undefined}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-auto space-y-5 animate-in fade-in zoom-in duration-200">
            {requestStatus !== 'sent' ? (
              <>
                <button
                  onClick={closeDirectorRequest}
                  disabled={requestStatus === 'sending'}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center disabled:opacity-40 transition-colors"
                >
                  <span className="text-gray-500 text-lg leading-none">&times;</span>
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-100 to-blue-100 flex items-center justify-center flex-shrink-0">
                    <Send className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Send Request to Director</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Your director will be notified for approval</p>
                  </div>
                </div>

                {teamName && (
                  <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Selected Team</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#4472fa] to-[#a445f6] flex items-center justify-center flex-shrink-0">
                        <Users className="w-3 h-3 text-white" />
                      </div>
                      <p className="text-sm font-semibold text-gray-900">{teamName}</p>
                    </div>
                  </div>
                )}

                <p className="text-sm text-gray-600">
                  Your director will receive a notification to review and approve this team&apos;s travel plan. Once sent, they will be able to accept or request changes.
                </p>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={closeDirectorRequest}
                    disabled={requestStatus === 'sending'}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void sendDirectorRequest()}
                    disabled={requestStatus === 'sending'}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white text-sm font-semibold transition-all disabled:opacity-70 shadow-sm shadow-violet-500/30"
                  >
                    {requestStatus === 'sending' ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />Sending&hellip;</>
                    ) : (
                      <><Send className="w-4 h-4" />Send Request</>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center text-center py-4 space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Request Sent! 🎉</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Your director has been notified to review
                    {teamName ? <> <span className="font-semibold text-gray-700">{teamName}</span>&apos;s</> : null} travel plan.
                  </p>
                </div>
                <button
                  onClick={closeDirectorRequest}
                  className="w-full px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors shadow-sm"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
