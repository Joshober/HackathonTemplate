const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

/** Persisted when user picks a team on the Team tab; read by Return stage. */
export const TRAVEL_ACTIVE_TEAM_STORAGE_KEY = 'travelActiveTeamId';

/** Optional travel metadata persisted by `/api/items` (JSON body). */
export type TravelMetadata = Record<string, unknown>;

/** Structured data extracted from a parsed travel document. */
export interface ParsedTripDocument {
  destinations: string[];
  travelDates: {
    departureDate: string | null;
    returnDate: string | null;
    durationDays: number | null;
  };
  flights: Array<{
    flightNumber: string | null;
    from: string;
    to: string;
    departureTime: string | null;
    arrivalTime: string | null;
    date: string | null;
    airline: string | null;
  }>;
  hotels: Array<{
    name: string;
    city: string;
    checkIn: string | null;
    checkOut: string | null;
  }>;
  layovers: Array<{ city: string; duration: string | null }>;
  visaRequirements: Array<{ country: string; requirement: string; note: string | null }>;
  policyHighlights: string[];
  risks: string[];
  tripSummary: string;
}

export interface Item {
  _id?: string;
  userId?: string;
  teamId?: string;
  title: string;
  description: string;
  imageUrls?: string[];
  videoUrls?: string[];
  travel?: TravelMetadata;
  createdAt?: string;
  updatedAt?: string;
}

export interface Profile {
  _id?: string;
  userId?: string;
  displayName: string;
  bio: string;
  profileImageUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Resolved team trip (stored, inferred from linked items, or doc demo defaults). */
export interface TeamTripContext {
  focusTripItemId?: string | null;
  tripDestination?: string | null;
  tripStartDate?: string | null;
  tripEndDate?: string | null;
  tripContextSource?: 'user' | 'inferred' | 'demo_docs' | 'mixed' | string;
}

export interface TeamSummary {
  id: string;
  name: string;
  memberCount: number;
  tripContext?: TeamTripContext;
}

export interface TeamMember {
  userId: string;
  displayName?: string | null;
  email?: string | null;
  profileImageUrl?: string | null;
}

export interface TeamDetail {
  id: string;
  name: string;
  description?: string | null;
  createdBy?: string;
  members: TeamMember[];
  cityPresets?: string[];
  tripContext?: TeamTripContext;
}

export interface TeamCalendarCoverageMember {
  userId: string;
  displayName?: string | null;
  email?: string | null;
  connected: boolean;
  manualAvailability?: boolean;
}

export interface TeamCalendarCoverage {
  teamId: string;
  totalMembers: number;
  connectedMembers: number;
  manualAvailabilityMembers?: number;
  members: TeamCalendarCoverageMember[];
}

export interface TeamMemberAvailability {
  userId: string;
  displayName?: string | null;
  email?: string | null;
  windows: Array<{ startDate: string; endDate: string }>;
  budgetMin?: number | null;
  budgetMax?: number | null;
}

export interface TeamMessage {
  id: string;
  role: 'user' | 'assistant';
  userId?: string | null;
  content: string;
  authorDisplayName?: string | null;
  createdAt?: string | null;
}

export interface ExplorerOpportunity {
  id: string;
  title: string;
  snippet: string;
  url: string;
  city: string;
  imageUrl?: string;
  source?: 'ticketmaster' | 'duckduckgo' | 'openstreetmap';
}

export interface ExplorerSearchParams {
  cities?: string[];
  query?: string;
  maxPerCity?: number;
  startDate?: string;
  endDate?: string;
  sortBy?: 'date' | 'relevance';
  sources?: Array<'ticketmaster' | 'duckduckgo' | 'openstreetmap'>;
  eventTypes?: Array<'music' | 'sports' | 'arts' | 'film' | 'miscellaneous'>;
  maxPrice?: number;
  teamId?: string;
  requireAllMembersFree?: boolean;
  availabilityWindowStart?: string;
  availabilityWindowEnd?: string;
}

export interface ExplorerAvailabilityCoverage {
  teamId: string;
  totalMembers: number;
  connectedMembers: number;
  manualAvailabilityMembers?: number;
  requireAllMembersFree: boolean;
  total?: number;
  withEventTime?: number;
  removedByAvailability?: number;
  /** Kept after filter using team availability window (no specific event time on listing). */
  includedWithMissingEventTime?: number;
}

export interface ExplorerEventOption {
  eventKey: string;
  optionId: string;
  sourceEventId?: string;
  title: string;
  city: string;
  source?: string;
  url?: string;
  imageUrl?: string;
  snippet?: string;
  startAt?: string;
  endAt?: string;
  /** True when the source listing had no event time; availability used team search window. */
  eventTimeMissing?: boolean;
  availability?: {
    availableCount: number;
    totalMembers: number;
    conflictMemberIds: string[];
    availabilityScore: number;
    meetsMajority: boolean;
    eventTimeMissing?: boolean;
    evaluatedAgainst?: 'event_time' | 'availability_window' | null;
    evaluationWindowStart?: string | null;
    evaluationWindowEnd?: string | null;
  };
  cost?: {
    mode?: string;
    flightTotal?: number;
    hotelTotal?: number;
    ticketEstimate?: number;
    totalEstimated?: number;
    /** Flight/hotel estimate used first day of team window — not a confirmed event date. */
    pricingUsedAvailabilityWindow?: boolean;
  };
}

export interface ExplorerItineraryPackage {
  packageId: string;
  title: string;
  city: string;
  options: ExplorerEventOption[];
  availability?: ExplorerEventOption['availability'];
  cost?: ExplorerEventOption['cost'];
  score?: number;
}

export interface CitySuggestion {
  label: string;
  city: string;
  country?: string;
}

export interface TravelPricingFlightOfferSummary {
  grandTotal?: string;
  currency?: string;
  carrierSummary?: string;
  departureAt?: string;
  arrivalAt?: string;
  instantTicketingRequired?: boolean;
  lastTicketingDate?: string;
  numItineraries?: number;
  /** Present when offer came from Duffel */
  source?: string;
}

export interface TravelPricingMatrixFlightOption extends TravelPricingFlightOfferSummary {
  optionId?: string;
  outboundDepartureAt?: string;
  outboundArrivalAt?: string;
  returnDepartureAt?: string;
  returnArrivalAt?: string;
}

export interface TravelPricingHotelOfferRow {
  hotelId?: string;
  hotelName?: string;
  checkIn?: string;
  checkOut?: string;
  total?: string;
  currency?: string;
  boardType?: string;
  /** Minutes from Google Hotels nearby_places transit hints (approximate). */
  distanceMinutes?: number | null;
  distanceHint?: string | null;
  listingUrl?: string | null;
  source?: string;
}

export interface TravelPricingMatrixHotelOption extends TravelPricingHotelOfferRow {
  optionId?: string;
}

export interface TravelPricingBundleOption {
  bundleId: string;
  flightOptionId?: string;
  hotelOptionId?: string;
  flightSource?: string;
  hotelSource?: string;
  currency?: string;
  flightTotal?: number | null;
  hotelTotal?: number | null;
  totalEstimated?: number | null;
  score?: number;
  scoreBreakdown?: {
    attendance?: number;
    approval?: number;
    price?: number;
  };
}

export interface TravelPricingWindowSummary {
  windowStart: string;
  windowEnd: string;
  tripCount: number;
  cheapestFlight?: number | null;
  cheapestHotel?: number | null;
  cheapestBundle?: number | null;
  assumptionFlags?: string[];
}

export interface TravelPricingAttendance {
  canAttend?: boolean | null;
  score?: number;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
  assumedEventDate?: string | null;
  evaluation?: string | null;
}

export interface TravelPricingDeepLinks {
  googleFlightsSearch?: string | null;
  googleHotelsSearch?: string | null;
  googleFlightsShort?: string | null;
  kayakExploreHint?: string | null;
}

export interface TravelPricingScrapedOption {
  title: string;
  snippet: string;
  url: string;
  kind: string;
  sourceQuery: string;
  pageTitle?: string;
}

export interface TravelPricingEventResult {
  itemId?: string;
  title: string;
  destinationQuery: string;
  outboundDate?: string;
  inboundDate?: string;
  deepLinks: TravelPricingDeepLinks;
  resolvedDestination?: { iata: string | null; label: string | null } | null;
  attendance?: TravelPricingAttendance;
  flight: {
    offers: TravelPricingFlightOfferSummary[];
    error?: string | null;
    bookable?: boolean | null;
    reason?: string;
  };
  hotel: {
    offers: TravelPricingHotelOfferRow[];
    error?: string | null;
    bookable?: boolean | null;
    reason?: string;
    /** Average of per-listing distanceMinutes when from SerpAPI Google Hotels. */
    averageDistanceMinutes?: number | null;
    distanceSummary?: string | null;
  };
  flightOptions?: TravelPricingMatrixFlightOption[];
  hotelOptions?: TravelPricingMatrixHotelOption[];
  bundleOptions?: TravelPricingBundleOption[];
  assumptionFlags?: string[];
  matrixSummary?: {
    flightOptionsCount?: number;
    hotelOptionsCount?: number;
    bundleOptionsCount?: number;
    bestBundleTotal?: number | null;
    bestBundleScore?: number | null;
  };
  scrapedOptions: TravelPricingScrapedOption[];
  scrapeNote?: string | null;
  /** amadeus | duffel | none — which backend served flights for this row */
  flightSource?: string;
}

export interface TravelPricingPreviewResponse {
  mode: 'amadeus' | 'duffel' | 'links_only';
  /** Global preference resolution: amadeus | duffel | none */
  flightBackend?: string;
  flightBackends?: string[];
  scrapeEnabled: boolean;
  matrixCaps?: {
    flightOptions?: number;
    hotelOptions?: number;
    bundleOptions?: number;
  };
  windowSummaries?: TravelPricingWindowSummary[];
  tripEvaluations?: TravelPricingEventResult[];
  events: TravelPricingEventResult[];
}

export interface ExplorerAiHelpRecommendation {
  title: string;
  reasoning: string;
  totalEstimated?: number | null;
  score?: number | null;
  assumptions?: string[];
}

export interface ExplorerAiHelpResponse {
  message: string;
  recommendations: ExplorerAiHelpRecommendation[];
  refreshApplied?: boolean;
  searchRefresh?: {
    opportunityCount?: number;
    topOpportunities?: ExplorerOpportunity[];
  } | null;
  pricingRefresh?: {
    mode?: string;
    flightBackends?: string[];
    windowSummaries?: TravelPricingWindowSummary[];
    trips?: Array<{
      itemId?: string;
      title?: string;
      destinationQuery?: string;
      attendance?: TravelPricingAttendance;
      bestBundle?: TravelPricingBundleOption | null;
      assumptionFlags?: string[];
    }>;
  } | null;
  model?: string | null;
}

export interface TravelCopilotSuggestedAction {
  label: string;
  prompt: string;
}

export type TravelChecklistStatus = 'pending' | 'done' | 'blocked';

export interface TravelChecklistItem {
  id: string;
  label: string;
  status: TravelChecklistStatus;
  source: 'trip' | 'policy' | 'approval' | 'risk' | 'post_trip';
  note?: string;
}

export type TravelApprovalState = 'not_required' | 'required' | 'submitted' | 'pending' | 'approved' | 'needs_changes';

export interface TravelApprovalTimelineStep {
  step: string;
  status: 'done' | 'pending' | 'n/a' | 'blocked';
  detail: string;
}

export interface TravelApprovalDecision {
  status: TravelApprovalState;
  requiredBy: string[];
  reasons: string[];
  fixes: string[];
  timeline: TravelApprovalTimelineStep[];
  submittedAt?: string | null;
  decisionAt?: string | null;
}

export type TravelIssueType =
  | 'delay'
  | 'cancellation'
  | 'missed_connection'
  | 'hotel_issue'
  | 'policy_exception'
  | 'medical'
  | 'security'
  | 'other';

export type TravelEscalationLevel = 'none' | 'monitor' | 'travel_desk' | 'manager' | 'emergency';

export interface TravelIncidentOption {
  id: string;
  title: string;
  details: string;
  actionType: 'self_service' | 'rebook' | 'policy' | 'contact';
}

export interface TravelIncident {
  id: string;
  type: TravelIssueType;
  severity: 'low' | 'medium' | 'high';
  summary: string;
  createdAt: string;
  details?: string;
  options: TravelIncidentOption[];
  escalation: {
    level: TravelEscalationLevel;
    reason: string;
    contact: string;
    actionNow: string;
  };
}

export type TravelFollowUpStatus = 'open' | 'done' | 'skipped';

export interface TravelFollowUpTask {
  id: string;
  type: 'expense' | 'feedback' | 'compliance' | 'communication';
  label: string;
  dueDate: string;
  status: TravelFollowUpStatus;
  owner: 'traveler' | 'copilot' | 'manager';
}

export interface TravelPrivacyMeta {
  redactionApplied: boolean;
  retainedFields: string[];
  excludedFields: string[];
  note?: string;
}

/** Only these three AI Service modes are supported for the travel copilot. */
export type TravelAssistantMode = 'travel_coach' | 'personal_assistant' | 'analytics';

/** Backend-computed summary of trip context completeness (Mongo + UI hints). */
export interface TravelCopilotContextQuality {
  tripRef?: string;
  summaryLine?: string;
  completeness?: Record<string, boolean>;
  gaps?: string[];
}

export interface TravelCopilotResponse {
  reply: string;
  mode: string;
  stage?: 'plan' | 'approve' | 'travel' | 'return';
  tripId?: string;
  intent?: { intent: string; confidence: number; reason?: string };
  incidentDetected?: boolean;
  escalationRecommended?: boolean;
  privacyApplied?: boolean;
  contextUsed: Record<string, boolean>;
  contextQuality?: TravelCopilotContextQuality;
  suggestedActions: TravelCopilotSuggestedAction[];
  sourcesUsed?: Array<{ sourceType: string; label: string; documentType?: string; fields?: string[] }>;
  nextStep?: string;
  usage?: Record<string, unknown>;
}

/** AI Admin Solver — structured JSON from backend + optional pending confirmation. */
export interface AdminAiSolverStructured {
  responseType?: string;
  intent?: string;
  confidence?: number;
  requiresConfirmation?: boolean;
  reasoningSummary?: string;
  actionPayload?: Record<string, unknown> | null;
  userFacingMessage?: string;
  weatherDigest?: unknown;
  structuredRecommendations?: string[];
  validationErrors?: string[];
  pendingActionBlocked?: boolean;
}

export interface AdminAiSolverResponse {
  ok?: boolean;
  structured?: AdminAiSolverStructured;
  contextUsed?: Record<string, boolean>;
  pendingActionId?: string | null;
  usage?: Record<string, unknown>;
  error?: string;
}

export interface AdminMeResponse {
  email: string;
  isAdmin: boolean;
  isProfessor: boolean;
}

async function getAccessToken(): Promise<string | null> {
  try {
    const response = await fetch(`${API_URL}/api/auth/token`, {
      credentials: 'include', // Include cookies for session
    });
    if (response.ok) {
      const data = await response.json();
      return data.accessToken || null;
    } else {
      // 401 is expected when not logged in - return null silently
      // Don't log or throw errors for 401
      if (response.status === 401) {
        return null;
      }
      
      // Only log non-401 errors
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (response.status === 500) {
        console.error('Token endpoint configuration error:', errorData);
      }
      // Don't log other errors either - just return null
    }
  } catch {
    // Network errors - return null silently
    return null;
  }
  return null;
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  let token = await getAccessToken();
  
  // If token fetch failed, try once more after a short delay
  if (!token) {
    await new Promise(resolve => setTimeout(resolve, 500));
    token = await getAccessToken();
  }
  
  if (!token) {
    throw new Error('Unable to get access token. Please check your authentication configuration.');
  }
  
  const isFormData = options.body instanceof FormData;
  const headers: HeadersInit = {
    Authorization: `Bearer ${token}`,
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
    credentials: 'include', // Include cookies
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    const errorMessage = error.message || error.error || `HTTP error! status: ${response.status}`;
    
    throw new Error(errorMessage);
  }

  return response.json();
}

async function fetchPublic(url: string, options: RequestInit = {}) {
  const isFormData = options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const text = await response.text();
    let msg = `Error ${response.status}`;
    try {
      const error = JSON.parse(text);
      msg = error.error || error.message || msg;
    } catch {
      if (text.length < 200) msg = text || msg;
    }
    throw new Error(msg);
  }

  return response.json();
}

async function fetchPublicBlob(url: string, options: RequestInit = {}) {
  const isFormData = options.body instanceof FormData;
  const headers: HeadersInit = {
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'An error occurred' }));
    throw new Error(error.message || error.error || `HTTP error! status: ${response.status}`);
  }

  return response.blob();
}

export const api = {
  // Auth API
  async login(): Promise<{ auth_url: string }> {
    return fetchPublic('/api/auth/login');
  },

  async loginEmailPassword(email: string, password: string): Promise<{ user: Record<string, unknown>; message: string }> {
    return fetchPublic('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
  },

  async register(email: string, password: string, name?: string): Promise<{ user: Record<string, unknown>; message: string }> {
    return fetchPublic('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, name }),
    });
  },

  async logout(): Promise<{ logout_url?: string; message?: string }> {
    return fetchPublic('/api/auth/logout', { method: 'POST' });
  },

  async getCurrentUser(): Promise<Record<string, unknown>> {
    return fetchWithAuth('/api/auth/me');
  },

  async getItems(): Promise<Item[]> {
    return fetchWithAuth('/api/items');
  },

  async getItem(id: string): Promise<Item> {
    return fetchWithAuth(`/api/items/${id}`);
  },

  async searchExplorerOpportunities(params: ExplorerSearchParams): Promise<{
    opportunities: ExplorerOpportunity[];
    availabilityCoverage?: ExplorerAvailabilityCoverage | null;
    eventOptions?: ExplorerEventOption[];
    itineraryPackages?: ExplorerItineraryPackage[];
  }> {
    return fetchWithAuth('/api/explorer/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(params.cities != null ? { cities: params.cities } : {}),
        ...(params.query ? { query: params.query } : {}),
        ...(params.maxPerCity != null ? { maxPerCity: params.maxPerCity } : {}),
        ...(params.startDate ? { startDate: params.startDate } : {}),
        ...(params.endDate ? { endDate: params.endDate } : {}),
        ...(params.sortBy ? { sortBy: params.sortBy } : {}),
        ...(params.sources?.length ? { sources: params.sources } : {}),
        ...(params.eventTypes?.length ? { eventTypes: params.eventTypes } : {}),
        ...(params.maxPrice != null ? { maxPrice: params.maxPrice } : {}),
        ...(params.teamId ? { teamId: params.teamId } : {}),
        ...(params.requireAllMembersFree ? { requireAllMembersFree: params.requireAllMembersFree } : {}),
        ...(params.availabilityWindowStart ? { availabilityWindowStart: params.availabilityWindowStart } : {}),
        ...(params.availabilityWindowEnd ? { availabilityWindowEnd: params.availabilityWindowEnd } : {}),
      }),
    });
  },

  async getExplorerAiHelp(body: {
    prompt: string;
    refresh?: boolean;
    context?: Record<string, unknown>;
    refreshSearchParams?: ExplorerSearchParams;
    refreshPricingParams?: {
      originIata: string;
      events: Array<{
        itemId?: string;
        title?: string;
        destinationQuery?: string;
        location?: string;
        outboundDate: string;
        inboundDate?: string;
        checkIn?: string;
        checkOut?: string;
        adults?: number;
        eventStartDate?: string;
        eventEndDate?: string;
        approvalSignal?: number;
      }>;
    };
  }): Promise<ExplorerAiHelpResponse> {
    return fetchWithAuth('/api/explorer/ai-help', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  async getGoogleCalendarAuthUrl(): Promise<{ auth_url: string }> {
    return fetchWithAuth('/api/auth/google/calendar/login');
  },

  async getGoogleCalendarStatus(): Promise<{ connected: boolean }> {
    return fetchWithAuth('/api/auth/google/calendar/status');
  },

  async disconnectGoogleCalendar(): Promise<{ ok: boolean }> {
    return fetchWithAuth('/api/auth/google/calendar/disconnect', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  async suggestExplorerCities(query: string): Promise<{ suggestions: CitySuggestion[] }> {
    const q = query.trim();
    if (q.length < 2) return { suggestions: [] };
    return fetchWithAuth(`/api/explorer/cities/suggest?q=${encodeURIComponent(q)}`);
  },

  async fetchTravelPricingPreview(body: {
    originIata: string;
    events: Array<{
      itemId?: string;
      title?: string;
      destinationQuery?: string;
      location?: string;
      outboundDate: string;
      inboundDate?: string;
      checkIn?: string;
      checkOut?: string;
      adults?: number;
      eventStartDate?: string;
      eventEndDate?: string;
      approvalSignal?: number;
    }>;
  }): Promise<TravelPricingPreviewResponse> {
    return fetchWithAuth('/api/travel/pricing-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  async createItem(item: {
    title: string;
    description: string;
    imageUrls?: string[];
    videoUrls?: string[];
    images?: File[];
    videos?: File[];
    travel?: TravelMetadata;
    teamId?: string;
  }): Promise<Item> {
    const hasFiles = (item.images?.length ?? 0) > 0 || (item.videos?.length ?? 0) > 0;
    if (!hasFiles) {
      return fetchWithAuth('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: item.title,
          description: item.description,
          imageUrls: item.imageUrls,
          videoUrls: item.videoUrls,
          travel: item.travel,
          ...(item.teamId ? { teamId: item.teamId } : {}),
        }),
      });
    }

    const formData = new FormData();
    formData.append('title', item.title);
    formData.append('description', item.description);
    if (item.travel) {
      formData.append('travel', JSON.stringify(item.travel));
    }
    if (item.teamId) {
      formData.append('teamId', item.teamId);
    }

    if (item.images) {
      item.images.forEach((file) => {
        formData.append('images', file);
      });
    }

    if (item.videos) {
      item.videos.forEach((file) => {
        formData.append('videos', file);
      });
    }

    return fetchWithAuth('/api/items', {
      method: 'POST',
      body: formData,
    });
  },

  async updateItem(
    id: string,
    item: {
      title?: string;
      description?: string;
      images?: File[];
      videos?: File[];
      imageUrls?: string[];
      videoUrls?: string[];
      travel?: TravelMetadata;
      teamId?: string;
    }
  ): Promise<Item> {
    const hasFiles = (item.images?.length ?? 0) > 0 || (item.videos?.length ?? 0) > 0;
    if (!hasFiles && (item.imageUrls != null || item.videoUrls != null || item.travel != null || item.teamId != null)) {
      return fetchWithAuth(`/api/items/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: item.title,
          description: item.description,
          imageUrls: item.imageUrls,
          videoUrls: item.videoUrls,
          travel: item.travel,
          ...(item.teamId !== undefined ? { teamId: item.teamId } : {}),
        }),
      });
    }

    const formData = new FormData();
    if (item.title) formData.append('title', item.title);
    if (item.description) formData.append('description', item.description);
    if (item.travel) {
      formData.append('travel', JSON.stringify(item.travel));
    }

    if (item.images) {
      item.images.forEach((file) => {
        formData.append('images', file);
      });
    }

    if (item.videos) {
      item.videos.forEach((file) => {
        formData.append('videos', file);
      });
    }

    return fetchWithAuth(`/api/items/${id}`, {
      method: 'PUT',
      body: formData,
    });
  },

  async deleteItem(id: string): Promise<void> {
    return fetchWithAuth(`/api/items/${id}`, {
      method: 'DELETE',
    });
  },

  // Profile API
  async getProfile(): Promise<Profile> {
    return fetchWithAuth('/api/profiles');
  },

  async createProfile(profile: { displayName: string; bio: string; image?: File }): Promise<Profile> {
    const formData = new FormData();
    formData.append('displayName', profile.displayName);
    formData.append('bio', profile.bio);
    if (profile.image) {
      formData.append('image', profile.image);
    }
    return fetchWithAuth('/api/profiles', {
      method: 'POST',
      body: formData,
    });
  },

  async updateProfile(profile: { displayName?: string; bio?: string; image?: File }): Promise<Profile> {
    const formData = new FormData();
    if (profile.displayName) formData.append('displayName', profile.displayName);
    if (profile.bio !== undefined) formData.append('bio', profile.bio);
    if (profile.image) {
      formData.append('image', profile.image);
    }
    return fetchWithAuth('/api/profiles', {
      method: 'PUT',
      body: formData,
    });
  },

  async uploadImage(image: File): Promise<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append('image', image);
    return fetchWithAuth('/api/profiles/image', {
      method: 'POST',
      body: formData,
    });
  },

  // Voice API (public - text to speech: OpenAI TTS or Magic Hour)
  async generateVoice(params: {
    text: string;
    provider: 'openai' | 'magic_hour';
    voice?: string;
    model?: string;
    speed?: number;
    voice_name?: string;
    name?: string;
  }): Promise<Blob> {
    const body: Record<string, unknown> = {
      text: params.text,
      provider: params.provider,
    };
    if (params.provider === 'openai') {
      if (params.voice) body.voice = params.voice;
      if (params.model) body.model = params.model;
      if (params.speed != null) body.speed = params.speed;
    } else {
      if (params.voice_name) body.voice_name = params.voice_name;
      if (params.name) body.name = params.name;
    }
    return fetchPublicBlob('/api/voice/generate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  // Voice-to-Text API (Whisper - pipeline backend)
  async transcribeAudio(file: File, options?: { language?: string; model?: string }): Promise<{ text: string }> {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.language) formData.append('language', options.language);
    if (options?.model) formData.append('model', options.model);
    return fetchPublic('/api/transcribe', {
      method: 'POST',
      body: formData,
    });
  },

  // Chat Pipeline: STT -> Chat (text+images+video) -> TTS (travel assistant)
  async chatPipeline(options: {
    audio?: File;
    text?: string;
    images?: File[];
    video?: File;
    messages?: Array<{ role: string; content: string }>;
    tts?: boolean;
    voice?: string;
    tts_provider?: 'openai' | 'magic_hour';
    mode?: 'assistant' | 'roast' | 'support';
    model?: string;
    /** Optional personality / custom prompt (e.g. "Be funny and sarcastic.") for assistant mode. */
    personality?: string;
    /** Optional user location for "restaurants near me" etc. */
    latitude?: number;
    longitude?: number;
    /** Optional library occupancy count (from page load) for "how many people in the library" */
    libraryCount?: number;
    /** When 'voice-assistant', backend uses the Voice Assistant prompt (for /voice-assistant page). */
    source?: 'voice-assistant';
    /** Logged-in user's email; AI uses it for "email me" in support mode and voice assistant. */
    userEmail?: string;
    /** Logged-in user's ID (e.g. Auth0 sub); used for demo mode (e.g. password reset → email profile and delete). */
    userId?: string;
  }): Promise<{ message: string; transcribed_text?: string; audio_base64?: string; audio_format?: 'mp3' | 'wav'; tts_error?: string; usage?: Record<string, unknown>; demo_account_deleted?: boolean }> {
    const formData = new FormData();
    if (options.text) formData.append('text', options.text);
    if (options.messages?.length) {
      formData.append('messages', JSON.stringify(options.messages));
    }
    formData.append('tts', String(options.tts ?? false));
    if (options.voice) formData.append('voice', options.voice);
    if (options.tts_provider) formData.append('tts_provider', options.tts_provider);
    if (options.mode) formData.append('mode', options.mode);
    if (options.source) formData.append('source', options.source);
    if (options.userEmail?.trim()) formData.append('user_email', options.userEmail.trim());
    if (options.userId?.trim()) formData.append('user_id', options.userId.trim());
    if (options.model) formData.append('model', options.model);
    if (options.personality != null && options.personality.trim()) formData.append('personality', options.personality.trim());
    if (options.latitude != null && options.longitude != null) {
      formData.append('latitude', String(options.latitude));
      formData.append('longitude', String(options.longitude));
    }
    if (options.libraryCount != null && options.libraryCount >= 0) {
      formData.append('library_count', String(options.libraryCount));
    }
    if (options.audio) formData.append('audio', options.audio);
    if (options.images?.length) {
      options.images.forEach((f) => formData.append('images', f));
    }
    if (options.video) formData.append('video', options.video);
    return fetchPublic('/api/chat/pipeline', {
      method: 'POST',
      body: formData,
    });
  },

  /** Context-aware travel copilot (MongoDB + OpenRouter tools). Requires auth. */
  async chatTravelCopilot(params: {
    message: string;
    sessionId?: string;
    currentPage?: string;
    uiState?: Record<string, unknown>;
    assistantMode?: TravelAssistantMode;
    messages?: Array<{ role: string; content: string }>;
    personality?: string;
    model?: string;
  }): Promise<TravelCopilotResponse> {
    return fetchWithAuth('/api/chat/copilot', {
      method: 'POST',
      body: JSON.stringify({
        message: params.message,
        sessionId: params.sessionId,
        currentPage: params.currentPage,
        uiState: params.uiState,
        assistantMode: params.assistantMode ?? 'travel_coach',
        messages: params.messages,
        personality: params.personality,
        model: params.model,
      }),
    }) as Promise<TravelCopilotResponse>;
  },

  async generateTravelChecklist(body: {
    itemId?: string;
    destination?: string;
    startDate?: string;
    endDate?: string;
    tripType?: string;
    costEstimate?: number;
  }): Promise<{
    checklist: TravelChecklistItem[];
    summary: string;
    riskFlags: string[];
    tradeoffs: string[];
    privacy: TravelPrivacyMeta;
  }> {
    return fetchWithAuth('/api/travel/checklist/generate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async generatePreTripBrief(body?: {
    itemId?: string;
  }): Promise<{
    companyPolicy: string;
    requirements: string;
    actionItems: string;
    privacy: TravelPrivacyMeta;
    source?: string;
  }> {
    return fetchWithAuth('/api/travel/pretrip-brief/generate', {
      method: 'POST',
      body: JSON.stringify(body || {}),
    });
  },

  async classifyCopilotIntent(body: {
    message: string;
    journeyStage?: string;
  }): Promise<{
    intent: string;
    confidence: number;
    reason: string;
  }> {
    return fetchWithAuth('/api/copilot/classify-intent', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async copilotRequirementsCheck(body: {
    itemId?: string;
    tripId?: string;
    destination?: string;
    startDate?: string;
    endDate?: string;
    costEstimate?: number;
  }): Promise<{
    requiredItems: string[];
    missingItems: string[];
    warnings: string[];
    nextStep: string;
    privacy: TravelPrivacyMeta;
  }> {
    return fetchWithAuth('/api/copilot/requirements-check', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async prepareTravelApproval(body: {
    itemId?: string;
    destination?: string;
    startDate?: string;
    endDate?: string;
    costEstimate?: number;
    status?: string;
  }): Promise<{
    approval: TravelApprovalDecision;
    plainLanguageStatus: string;
    privacy: TravelPrivacyMeta;
  }> {
    return fetchWithAuth('/api/travel/approvals/prepare', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async triageTravelIncident(body: {
    itemId?: string;
    type: TravelIssueType;
    details?: string;
  }): Promise<{
    incident: TravelIncident;
    escalationRecommended: boolean;
    nextStep: string;
    privacy: TravelPrivacyMeta;
  }> {
    return fetchWithAuth('/api/travel/incidents/triage', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async generateTravelFollowUps(body: {
    itemId?: string;
  }): Promise<{
    followUps: TravelFollowUpTask[];
    summary: string;
    privacy: TravelPrivacyMeta;
  }> {
    return fetchWithAuth('/api/travel/followups/generate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async escalateTravelIssue(body: {
    itemId?: string;
    incidentId?: string;
    reason?: string;
    contactPreference?: 'travel_desk' | 'manager' | 'emergency';
  }): Promise<{
    escalationId: string;
    incidentId: string;
    status: string;
    contact: string;
    message: string;
    privacy: TravelPrivacyMeta;
  }> {
    return fetchWithAuth('/api/travel/escalate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async getTripContext(tripId: string): Promise<Record<string, unknown>> {
    return fetchWithAuth(`/api/trips/${encodeURIComponent(tripId)}/context`);
  },

  async getTripContacts(tripId: string): Promise<{
    tripId: string;
    contacts: Array<{ type: string; label: string; value: string; availability?: string }>;
  }> {
    return fetchWithAuth(`/api/trips/${encodeURIComponent(tripId)}/contacts`);
  },

  async getTripReminders(tripId: string): Promise<{
    tripId: string;
    reminders: Array<{ id: string; label: string; type: string; status: string; dueDate?: string }>;
  }> {
    return fetchWithAuth(`/api/trips/${encodeURIComponent(tripId)}/reminders`);
  },

  async getTripAiSources(tripId: string): Promise<{
    tripId: string;
    sources: Array<{ sourceType: string; label: string; documentType?: string; fields?: string[] }>;
  }> {
    return fetchWithAuth(`/api/audit/trips/${encodeURIComponent(tripId)}/ai-sources`);
  },

  async getAdminMe(): Promise<AdminMeResponse> {
    return fetchWithAuth('/api/admin/me') as Promise<AdminMeResponse>;
  },

  async adminAiSolver(params: {
    message: string;
    currentPage?: string;
    selectedTeamId?: string;
    selectedTripId?: string;
    selectedDateRange?: { start?: string; end?: string };
    uiState?: Record<string, unknown>;
    model?: string;
  }): Promise<AdminAiSolverResponse> {
    return fetchWithAuth('/api/admin/ai/solver', {
      method: 'POST',
      body: JSON.stringify({
        message: params.message,
        currentPage: params.currentPage,
        selectedTeamId: params.selectedTeamId,
        selectedTripId: params.selectedTripId,
        selectedDateRange: params.selectedDateRange,
        uiState: params.uiState,
        model: params.model,
      }),
    }) as Promise<AdminAiSolverResponse>;
  },

  async adminAiSolverConfirm(params: { pendingActionId: string }): Promise<{
    ok?: boolean;
    executed?: Record<string, unknown>;
    intent?: string;
    error?: string;
  }> {
    return fetchWithAuth('/api/admin/ai/solver/confirm', {
      method: 'POST',
      body: JSON.stringify({ pendingActionId: params.pendingActionId, confirm: true }),
    });
  },

  async createTicket(params: {
    title: string;
    description: string;
    user_email?: string;
    conversation_summary?: string;
    status?: string;
  }): Promise<{ _id: string; title: string; description: string; status: string; createdAt: string }> {
    return fetchPublic('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async syncUser(): Promise<{ ok: boolean; userId: string }> {
    return fetchWithAuth('/api/users/sync', { method: 'POST' });
  },

  async listTeams(): Promise<{ teams: TeamSummary[] }> {
    return fetchWithAuth('/api/teams');
  },

  async createTeam(body: {
    name: string;
    description?: string;
    focusTripItemId?: string | null;
    tripDestination?: string;
    tripStartDate?: string;
    tripEndDate?: string;
  }): Promise<{
    id: string;
    name: string;
    memberCount: number;
    createdBy: string;
  }> {
    return fetchWithAuth('/api/teams', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async getTeam(teamId: string): Promise<TeamDetail> {
    return fetchWithAuth(`/api/teams/${encodeURIComponent(teamId)}`);
  },

  async updateTeamTripPlan(
    teamId: string,
    body: Partial<{
      focusTripItemId: string | null;
      tripDestination: string | null;
      tripStartDate: string | null;
      tripEndDate: string | null;
    }>
  ): Promise<{ tripContext: TeamTripContext }> {
    return fetchWithAuth(`/api/teams/${encodeURIComponent(teamId)}/trip-plan`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  async getTeamCalendarCoverage(teamId: string): Promise<TeamCalendarCoverage> {
    return fetchWithAuth(`/api/teams/${encodeURIComponent(teamId)}/calendar-coverage`);
  },

  async setMyTeamAvailability(
    teamId: string,
    windows: Array<{ startDate: string; endDate: string }>,
    budget?: { min?: number | null; max?: number | null }
  ): Promise<{
    windows: Array<{ startDate: string; endDate: string }>;
    budgetMin?: number | null;
    budgetMax?: number | null;
  }> {
    return fetchWithAuth(`/api/teams/${encodeURIComponent(teamId)}/availability/me`, {
      method: 'PUT',
      body: JSON.stringify({
        windows,
        ...(budget?.min != null ? { budgetMin: budget.min } : { budgetMin: null }),
        ...(budget?.max != null ? { budgetMax: budget.max } : { budgetMax: null }),
      }),
    });
  },

  async getTeamAvailability(teamId: string): Promise<{ teamId: string; members: TeamMemberAvailability[] }> {
    return fetchWithAuth(`/api/teams/${encodeURIComponent(teamId)}/availability`);
  },

  async setTeamCityPresets(teamId: string, cities: string[]): Promise<{ cities: string[] }> {
    return fetchWithAuth(`/api/teams/${encodeURIComponent(teamId)}/city-presets`, {
      method: 'PUT',
      body: JSON.stringify({ cities }),
    });
  },

  async addTeamMember(teamId: string, email: string): Promise<{ members: TeamMember[]; message?: string }> {
    return fetchWithAuth(`/api/teams/${encodeURIComponent(teamId)}/members`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async leaveTeam(teamId: string): Promise<{ ok: boolean }> {
    return fetchWithAuth(`/api/teams/${encodeURIComponent(teamId)}/members/me`, {
      method: 'DELETE',
    });
  },

  async getTeamMessages(teamId: string, limit?: number): Promise<{ messages: TeamMessage[] }> {
    const q = limit != null ? `?limit=${encodeURIComponent(String(limit))}` : '';
    return fetchWithAuth(`/api/teams/${encodeURIComponent(teamId)}/messages${q}`);
  },

  async sendTeamMessage(
    teamId: string,
    content: string,
    opts?: { invokeAssistant?: boolean }
  ): Promise<{ userMessage: TeamMessage; assistantMessage: TeamMessage | null }> {
    const body: { content: string; invokeAssistant?: boolean } = { content };
    if (opts?.invokeAssistant !== undefined) {
      body.invokeAssistant = opts.invokeAssistant;
    }
    return fetchWithAuth(`/api/teams/${encodeURIComponent(teamId)}/messages`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async getTeamReturnFeed(teamId: string): Promise<Item[]> {
    const res = (await fetchWithAuth(`/api/teams/${encodeURIComponent(teamId)}/return-feed`)) as {
      items?: Item[];
    };
    return Array.isArray(res.items) ? res.items : [];
  },

  async generateInstagramCaption(teamId: string, itemId: string): Promise<{ caption: string }> {
    return fetchWithAuth(
      `/api/teams/${encodeURIComponent(teamId)}/items/${encodeURIComponent(itemId)}/instagram-caption`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    ) as Promise<{ caption: string }>;
  },

  // Document Intelligence: parse travel documents and store as copilot context
  async parseDocument(params: {
    text: string;
    documentName?: string;
    documentType?: 'itinerary' | 'policy' | 'booking' | 'other';
  }): Promise<{
    success: boolean;
    documentType: string;
    extracted: ParsedTripDocument;
    message: string;
  }> {
    return fetchWithAuth('/api/travel/documents/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  },

  async getTripDocuments(): Promise<{ documents: Array<{ documentType: string; documentName: string; extracted: ParsedTripDocument; updatedAt: string }> }> {
    return fetchWithAuth('/api/travel/documents');
  },

  async deleteTripDocument(documentType: string): Promise<{ success: boolean }> {
    return fetchWithAuth(`/api/travel/documents/${encodeURIComponent(documentType)}`, {
      method: 'DELETE',
    });
  },

  // Stage-aware copilot chat
  async chatCopilot(params: {
    message: string;
    assistantMode?: string;
    travelStage?: string;
    tripId?: string;
    messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
    sessionId?: string;
    uiState?: Record<string, unknown>;
    /** Extracted text from PDF / DOCX / TXT uploaded in this turn (server merges into prompt). */
    attachmentContext?: string;
    /** JPEG base64 strings for vision (PNG etc. should be converted client-side). */
    images?: string[];
  }): Promise<TravelCopilotResponse> {
    const body: Record<string, unknown> = {
      message: params.message,
      assistantMode: params.assistantMode ?? 'trip_companion',
      tripId: params.tripId,
      messages: params.messages ?? [],
      sessionId: params.sessionId,
      uiState: {
        ...(params.uiState ?? {}),
        journeyStage: params.travelStage ?? 'plan',
      },
    };
    if (params.attachmentContext?.trim()) body.attachmentContext = params.attachmentContext.trim();
    if (params.images?.length) body.images = params.images;
    return fetchWithAuth('/api/chat/copilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as Promise<TravelCopilotResponse>;
  },
};
