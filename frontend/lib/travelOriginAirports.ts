/** Airports offered as pricing origins, with coordinates for nearest-hub logic. */

export type TravelOriginAirport = {
  code: string;
  label: string;
  lat: number;
  lon: number;
};

const RAW: TravelOriginAirport[] = [
  { code: 'ATL', label: 'Atlanta (ATL)', lat: 33.6407, lon: -84.4277 },
  { code: 'AUS', label: 'Austin (AUS)', lat: 30.1948, lon: -97.6701 },
  { code: 'BNA', label: 'Nashville (BNA)', lat: 36.1245, lon: -86.6782 },
  { code: 'BOS', label: 'Boston (BOS)', lat: 42.3656, lon: -71.0096 },
  { code: 'BWI', label: 'Baltimore (BWI)', lat: 39.1774, lon: -76.6684 },
  { code: 'CDG', label: 'Paris Charles de Gaulle (CDG)', lat: 49.0097, lon: 2.5479 },
  { code: 'CLT', label: 'Charlotte (CLT)', lat: 35.2144, lon: -80.9473 },
  { code: 'DCA', label: 'Washington Reagan (DCA)', lat: 38.8521, lon: -77.0377 },
  { code: 'DEN', label: 'Denver (DEN)', lat: 39.8561, lon: -104.6737 },
  { code: 'DFW', label: 'Dallas/Fort Worth (DFW)', lat: 32.8998, lon: -97.0403 },
  { code: 'DTW', label: 'Detroit (DTW)', lat: 42.2162, lon: -83.3554 },
  { code: 'EWR', label: 'Newark (EWR)', lat: 40.6895, lon: -74.1745 },
  { code: 'FLL', label: 'Fort Lauderdale (FLL)', lat: 26.0742, lon: -80.1506 },
  { code: 'HOU', label: 'Houston Hobby (HOU)', lat: 29.6454, lon: -95.2789 },
  { code: 'IAD', label: 'Washington Dulles (IAD)', lat: 38.9531, lon: -77.4565 },
  { code: 'IAH', label: 'Houston Intercontinental (IAH)', lat: 29.9844, lon: -95.3414 },
  { code: 'JFK', label: 'New York JFK (JFK)', lat: 40.6413, lon: -73.7781 },
  { code: 'LAS', label: 'Las Vegas (LAS)', lat: 36.084, lon: -115.1537 },
  { code: 'LAX', label: 'Los Angeles (LAX)', lat: 33.9416, lon: -118.4085 },
  { code: 'LGA', label: 'New York LaGuardia (LGA)', lat: 40.7769, lon: -73.874 },
  { code: 'LHR', label: 'London Heathrow (LHR)', lat: 51.47, lon: -0.4543 },
  { code: 'MCI', label: 'Kansas City (MCI)', lat: 39.2976, lon: -94.7139 },
  { code: 'MCO', label: 'Orlando (MCO)', lat: 28.4312, lon: -81.3081 },
  { code: 'MDW', label: 'Chicago Midway (MDW)', lat: 41.7868, lon: -87.7522 },
  { code: 'MIA', label: 'Miami (MIA)', lat: 25.7959, lon: -80.287 },
  { code: 'MSP', label: 'Minneapolis (MSP)', lat: 44.882, lon: -93.2218 },
  { code: 'MSY', label: 'New Orleans (MSY)', lat: 29.9934, lon: -90.258 },
  { code: 'ORD', label: "Chicago O'Hare (ORD)", lat: 41.9742, lon: -87.9073 },
  { code: 'PDX', label: 'Portland (PDX)', lat: 45.5898, lon: -122.5951 },
  { code: 'PHL', label: 'Philadelphia (PHL)', lat: 39.8721, lon: -75.2409 },
  { code: 'PHX', label: 'Phoenix (PHX)', lat: 33.4346, lon: -112.0086 },
  { code: 'SAN', label: 'San Diego (SAN)', lat: 32.7338, lon: -117.1933 },
  { code: 'SEA', label: 'Seattle (SEA)', lat: 47.4502, lon: -122.3088 },
  { code: 'SFO', label: 'San Francisco (SFO)', lat: 37.6213, lon: -122.379 },
  { code: 'SLC', label: 'Salt Lake City (SLC)', lat: 40.7899, lon: -111.9791 },
  { code: 'STL', label: 'St. Louis (STL)', lat: 38.7487, lon: -90.37 },
  { code: 'TPA', label: 'Tampa (TPA)', lat: 27.9755, lon: -82.5332 },
  { code: 'YVR', label: 'Vancouver (YVR)', lat: 49.1939, lon: -123.1844 },
  { code: 'YYZ', label: 'Toronto Pearson (YYZ)', lat: 43.6777, lon: -79.6248 },
];

/** Sorted by label for dropdown display. */
export const TRAVEL_ORIGIN_AIRPORTS: TravelOriginAirport[] = [...RAW].sort((a, b) =>
  a.label.localeCompare(b.label),
);

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return r * c;
}

export function nearestTravelOriginCode(lat: number, lon: number): string {
  let best = TRAVEL_ORIGIN_AIRPORTS[0];
  let bestKm = Infinity;
  for (const a of TRAVEL_ORIGIN_AIRPORTS) {
    const d = haversineKm(lat, lon, a.lat, a.lon);
    if (d < bestKm) {
      bestKm = d;
      best = a;
    }
  }
  return best.code;
}

/** Normalized city / metro hints → airport (first match wins). */
const CITY_HINT_TO_CODE: { keys: string[]; code: string }[] = [
  { keys: ['chicago'], code: 'ORD' },
  { keys: ['new york', 'nyc', 'manhattan', 'brooklyn', 'queens'], code: 'JFK' },
  { keys: ['los angeles', 'hollywood', 'burbank', 'pasadena'], code: 'LAX' },
  { keys: ['san francisco', 'bay area', 'oakland', 'san jose'], code: 'SFO' },
  { keys: ['boston', 'cambridge ma'], code: 'BOS' },
  { keys: ['washington', 'dc', 'arlington va', 'alexandria'], code: 'DCA' },
  { keys: ['atlanta'], code: 'ATL' },
  { keys: ['dallas', 'fort worth'], code: 'DFW' },
  { keys: ['houston'], code: 'IAH' },
  { keys: ['miami', 'fort lauderdale', 'boca raton'], code: 'MIA' },
  { keys: ['philadelphia', 'philly'], code: 'PHL' },
  { keys: ['phoenix', 'scottsdale', 'tempe'], code: 'PHX' },
  { keys: ['seattle', 'bellevue', 'tacoma'], code: 'SEA' },
  { keys: ['denver', 'boulder'], code: 'DEN' },
  { keys: ['detroit'], code: 'DTW' },
  { keys: ['minneapolis', 'st. paul', 'saint paul'], code: 'MSP' },
  { keys: ['charlotte'], code: 'CLT' },
  { keys: ['las vegas', 'vegas'], code: 'LAS' },
  { keys: ['orlando'], code: 'MCO' },
  { keys: ['tampa', 'st. petersburg', 'clearwater'], code: 'TPA' },
  { keys: ['nashville'], code: 'BNA' },
  { keys: ['austin'], code: 'AUS' },
  { keys: ['salt lake', 'provo'], code: 'SLC' },
  { keys: ['san diego'], code: 'SAN' },
  { keys: ['st. louis', 'saint louis'], code: 'STL' },
  { keys: ['kansas city'], code: 'MCI' },
  { keys: ['baltimore'], code: 'BWI' },
  { keys: ['new orleans', 'nola'], code: 'MSY' },
  { keys: ['london', 'uk'], code: 'LHR' },
  { keys: ['paris'], code: 'CDG' },
  { keys: ['toronto'], code: 'YYZ' },
  { keys: ['vancouver'], code: 'YVR' },
];

function normalizeCityHint(raw: string): string {
  return raw
    .toLowerCase()
    .split(',')[0]
    .trim()
    .replace(/\s+/g, ' ');
}

export function airportCodeFromCityHints(cities: string[] | undefined): string | null {
  if (!cities?.length) return null;
  for (const raw of cities) {
    const lower = raw.toLowerCase();
    if (lower.includes('washington') && (lower.includes('dc') || lower.includes('d.c'))) return 'DCA';
  }
  for (const raw of cities) {
    const lower = raw.toLowerCase();
    if (lower.includes('portland')) {
      if (lower.includes('me') || lower.includes('maine')) return 'BOS';
      return 'PDX';
    }
  }
  for (const raw of cities) {
    const hint = normalizeCityHint(raw);
    if (!hint) continue;
    for (const row of CITY_HINT_TO_CODE) {
      for (const k of row.keys) {
        if (hint === k || hint.includes(k) || k.includes(hint)) {
          return row.code;
        }
      }
    }
  }
  return null;
}
