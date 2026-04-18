"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  SlidersHorizontal,
  Heart,
  ArrowRight,
  Star,
  MapPin,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  ExternalLink,
  Ticket,
  Globe,
} from "lucide-react";
import { api, type ExplorerOpportunity } from "@/lib/api";
import { toast } from "sonner";
import { PageHeader } from "../../common/PageHeader";

// ─── Types ──────────────────────────────────────────────────────────────────

type Category = "All Types" | "Events" | "Places" | "Activities";

// Source label helpers
const SOURCE_LABELS: Record<string, string> = {
  ticketmaster: "Event",
  duckduckgo: "Web",
  openstreetmap: "Place",
};
const SOURCE_ICONS: Record<string, typeof Globe> = {
  ticketmaster: Ticket,
  duckduckgo: Globe,
  openstreetmap: MapPin,
};

// ─── Component ───────────────────────────────────────────────────────────────

export function Explorer() {
  const [selectedCategory, setSelectedCategory] = useState<Category>("All Types");
  const [searchQuery, setSearchQuery] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<{ label: string; city: string }[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);

  const [opportunities, setOpportunities] = useState<ExplorerOpportunity[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);
  const [selectedOpp, setSelectedOpp] = useState<ExplorerOpportunity | null>(null);

  const cityDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categories: Category[] = ["All Types", "Events", "Places", "Activities"];

  // ── City auto-suggest ────────────────────────────────────────────────────

  const handleCityInputChange = (val: string) => {
    setCityInput(val);
    if (cityDebounce.current) clearTimeout(cityDebounce.current);
    if (val.length < 2) {
      setCitySuggestions([]);
      return;
    }
    cityDebounce.current = setTimeout(async () => {
      try {
        const { suggestions } = await api.suggestExplorerCities(val);
        setCitySuggestions(suggestions.slice(0, 6));
        setShowCitySuggestions(true);
      } catch {
        // silent
      }
    }, 300);
  };

  const addCity = (city: string) => {
    const normalized = city.trim();
    if (!normalized || selectedCities.includes(normalized)) return;
    setSelectedCities((prev) => [...prev, normalized]);
    setCityInput("");
    setCitySuggestions([]);
    setShowCitySuggestions(false);
  };

  const removeCity = (city: string) =>
    setSelectedCities((prev) => prev.filter((c) => c !== city));

  // ── Live search ──────────────────────────────────────────────────────────

  const doSearch = useCallback(async (query: string, cities: string[], category: Category) => {
    setLoading(true);
    setSearched(true);
    try {
      const sources: Array<"ticketmaster" | "duckduckgo" | "openstreetmap"> =
        category === "Events"
          ? ["ticketmaster"]
          : category === "Places"
          ? ["openstreetmap"]
          : category === "Activities"
          ? ["duckduckgo"]
          : ["ticketmaster", "duckduckgo", "openstreetmap"];

      const { opportunities: results } = await api.searchExplorerOpportunities({
        cities: cities.length > 0 ? cities : undefined,
        query: query.trim() || undefined,
        maxPerCity: 12,
        sources,
      });
      setOpportunities(results);
    } catch (e) {
      toast.error("Search failed: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-search when category or cities change (if already searched once)
  useEffect(() => {
    if (searched) {
      doSearch(searchQuery, selectedCities, selectedCategory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, selectedCities]);

  // Debounce text search
  useEffect(() => {
    if (!searched && !searchQuery) return;
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      doSearch(searchQuery, selectedCities, selectedCategory);
    }, 500);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Initial load — search with no query to get popular suggestions
  useEffect(() => {
    doSearch("", [], "All Types");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Add to Plan ──────────────────────────────────────────────────────────

  const addToPlan = async (opp: ExplorerOpportunity) => {
    if (addedIds.has(opp.id)) {
      toast.info(`${opp.title} is already in your plan`);
      return;
    }
    setAddingId(opp.id);
    try {
      await api.createItem({
        title: opp.title,
        description: opp.snippet,
        travel: {
          location: opp.city,
          sourceUrl: opp.url,
          imageUrl: opp.imageUrl,
          explorerSource: opp.source,
        },
      });
      setAddedIds((prev) => new Set([...prev, opp.id]));
      toast.success(`✈️ "${opp.title}" added to your plan!`);
    } catch (e) {
      toast.error("Could not add to plan: " + (e instanceof Error ? e.message : "Unknown error"));
    } finally {
      setAddingId(null);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-md mx-auto h-full flex flex-col bg-gray-50">
      {/* Header */}
      <PageHeader subtitle="Discover amazing destinations" />

      <div className="px-6 pt-2 pb-4 space-y-4">
        {/* City chips + input */}
        <div className="relative">
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedCities.map((city) => (
              <span
                key={city}
                className="inline-flex items-center gap-1 px-3 py-1 bg-gray-900 text-white text-xs font-semibold rounded-full"
              >
                {city}
                <button onClick={() => removeCity(city)} className="ml-1 hover:opacity-80">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Add a city (e.g. Chicago)…"
                value={cityInput}
                onChange={(e) => handleCityInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCity(cityInput);
                }}
                onFocus={() => citySuggestions.length > 0 && setShowCitySuggestions(true)}
                onBlur={() => setTimeout(() => setShowCitySuggestions(false), 150)}
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
              />
            </div>
            <button
              onClick={() => addCity(cityInput)}
              disabled={!cityInput.trim()}
              className="px-4 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-700 disabled:opacity-40 transition-all"
            >
              Add
            </button>
          </div>

          {/* City suggestions dropdown */}
          {showCitySuggestions && citySuggestions.length > 0 && (
            <div className="absolute z-30 left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden">
              {citySuggestions.map((s, i) => (
                <button
                  key={`${s.city}-${i}`}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                  onMouseDown={() => addCity(s.city)}
                >
                  <span className="font-medium">{s.city}</span>
                  {s.label !== s.city && (
                    <span className="ml-2 text-gray-400">{s.label}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search events, places, activities…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 transition-all"
            />
          </div>
          <button
            onClick={() => doSearch(searchQuery, selectedCities, selectedCategory)}
            className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center text-white hover:bg-gray-800 transition-all shadow-lg"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <SlidersHorizontal className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Category pills */}
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide -mx-6 px-6">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? "bg-gray-900 text-white shadow-lg"
                  : "bg-white border border-gray-200 text-gray-700 hover:border-gray-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <div className="px-6 pb-3 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {loading
            ? "Searching…"
            : `${opportunities.length} ${opportunities.length === 1 ? "opportunity" : "opportunities"} found`}
        </p>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-auto px-6 pb-4">
        <div className="space-y-6">
          {opportunities.map((opp) => {
            const SourceIcon = SOURCE_ICONS[opp.source ?? ""] ?? Globe;
            const isAdded = addedIds.has(opp.id);
            const isAdding = addingId === opp.id;

            return (
              <div
                key={opp.id}
                className="relative rounded-[28px] overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 group cursor-pointer bg-white"
                onClick={() => setSelectedOpp(opp)}
              >
                {/* Image */}
                {opp.imageUrl ? (
                  <img
                    src={opp.imageUrl}
                    alt={opp.title}
                    className="w-full h-52 object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-52 bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center">
                    <SourceIcon className="w-16 h-16 text-white/40" />
                  </div>
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0 h-52 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                {/* Source badge */}
                <div className="absolute top-4 left-4">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 backdrop-blur-md rounded-full text-xs font-bold text-white">
                    <SourceIcon className="w-3.5 h-3.5" />
                    {SOURCE_LABELS[opp.source ?? ""] ?? "Web"}
                  </span>
                </div>

                {/* Add to plan heart */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void addToPlan(opp);
                  }}
                  disabled={isAdding}
                  className={`absolute top-4 right-4 w-11 h-11 backdrop-blur-md rounded-full flex items-center justify-center transition-all ${
                    isAdded
                      ? "bg-red-500/90"
                      : "bg-white/20 hover:bg-white/30"
                  }`}
                >
                  {isAdding ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <Heart
                      className={`w-5 h-5 ${isAdded ? "text-white fill-white" : "text-white"}`}
                    />
                  )}
                </button>

                {/* Bottom content */}
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full mb-2">
                    <MapPin className="w-3.5 h-3.5 text-white" />
                    <span className="text-xs font-semibold text-white">{opp.city}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white drop-shadow-sm line-clamp-2">
                    {opp.title}
                  </h3>
                </div>

                {/* Description + actions */}
                <div className="p-5">
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{opp.snippet}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        void addToPlan(opp);
                      }}
                      disabled={isAdding || isAdded}
                      className={`flex-1 py-3 rounded-full text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-sm ${
                        isAdded
                          ? "bg-green-100 text-green-800 border border-green-200"
                          : "bg-gray-900 text-white hover:bg-gray-700"
                      }`}
                    >
                      {isAdding ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isAdded ? (
                        <>✓ Added to Plan</>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" /> Add to Plan
                        </>
                      )}
                    </button>
                    {opp.url && (
                      <a
                        href={opp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-all"
                      >
                        <ExternalLink className="w-4 h-4 text-gray-700" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {!loading && opportunities.length === 0 && (
            <div className="text-center py-20">
              <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-lg font-bold text-gray-900 mb-1">No opportunities found</p>
              <p className="text-sm text-gray-500">
                Try adding a city or changing your search terms
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {selectedOpp && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setSelectedOpp(null)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* close */}
            <div className="flex justify-between items-center p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900 pr-8 line-clamp-1">
                {selectedOpp.title}
              </h2>
              <button
                onClick={() => setSelectedOpp(null)}
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {selectedOpp.imageUrl && (
              <img
                src={selectedOpp.imageUrl}
                alt={selectedOpp.title}
                className="w-full h-56 object-cover"
              />
            )}

            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <MapPin className="w-4 h-4" />
                <span>{selectedOpp.city}</span>
                {selectedOpp.source && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="capitalize">{selectedOpp.source}</span>
                  </>
                )}
              </div>

              <p className="text-sm text-gray-700 leading-relaxed">{selectedOpp.snippet}</p>

              <div className="flex gap-2">
                <button
                  onClick={() => void addToPlan(selectedOpp)}
                  disabled={addingId === selectedOpp.id || addedIds.has(selectedOpp.id)}
                  className={`flex-1 py-3.5 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                    addedIds.has(selectedOpp.id)
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-900 text-white hover:bg-gray-700"
                  }`}
                >
                  {addingId === selectedOpp.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : addedIds.has(selectedOpp.id) ? (
                    "✓ Added to Plan"
                  ) : (
                    <>
                      <Plus className="w-4 h-4" /> Add to Plan
                    </>
                  )}
                </button>
                {selectedOpp.url && (
                  <a
                    href={selectedOpp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-3.5 rounded-full bg-gray-100 text-gray-900 font-semibold text-sm flex items-center gap-2 hover:bg-gray-200 transition-all"
                  >
                    <ExternalLink className="w-4 h-4" /> View
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}