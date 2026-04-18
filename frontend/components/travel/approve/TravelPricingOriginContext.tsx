'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { airportCodeFromCityHints, nearestTravelOriginCode, TRAVEL_ORIGIN_AIRPORTS } from '@/lib/travelOriginAirports';

export const ORIGIN_KEY = 'travel_explorer_origin_iata';
export const CUSTOM_ORIGIN_VALUE = '__custom__';

type Ctx = {
  originIata: string;
  setOriginIata: (v: string) => void;
  originSuggestionNote: string | null;
  setOriginSuggestionNote: (v: string | null) => void;
  savedAirportOption: { code: string; label: string } | null;
  originSelectValue: string;
  persistOrigin: (u: string) => void;
};

const TravelPricingOriginContext = createContext<Ctx | null>(null);

export function useTravelPricingOrigin(): Ctx {
  const v = useContext(TravelPricingOriginContext);
  if (!v) {
    throw new Error('useTravelPricingOrigin must be used within TravelPricingOriginProvider');
  }
  return v;
}

export function TravelPricingOriginProvider({
  children,
  originHintCities,
}: {
  children: ReactNode;
  originHintCities?: string[];
}) {
  const [originIata, setOriginIata] = useState('ORD');
  const [originSuggestionNote, setOriginSuggestionNote] = useState<string | null>(null);

  const persistOrigin = useCallback((u: string) => {
    try {
      sessionStorage.setItem(ORIGIN_KEY, u);
    } catch {
      /* ignore */
    }
  }, []);

  const teamCitiesKey = useMemo(
    () =>
      (originHintCities ?? [])
        .map((c) => c.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b))
        .join('|'),
    [originHintCities],
  );

  useEffect(() => {
    let cancelled = false;

    const readSessionCode = (): string | null => {
      try {
        const s = sessionStorage.getItem(ORIGIN_KEY);
        if (s && /^[A-Za-z]{3}$/.test(s)) return s.toUpperCase();
      } catch {
        /* ignore */
      }
      return null;
    };

    const applyFromSession = (code: string) => {
      if (cancelled) return;
      setOriginIata(code);
      setOriginSuggestionNote(null);
    };

    const applyAuto = (code: string, note: string, shouldPersist = true) => {
      if (cancelled) return;
      const u = code.toUpperCase();
      setOriginIata(u);
      if (shouldPersist) persistOrigin(u);
      setOriginSuggestionNote(note || null);
    };

    const sessionCode = readSessionCode();
    if (sessionCode) {
      applyFromSession(sessionCode);
      return () => {
        cancelled = true;
      };
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const code = nearestTravelOriginCode(pos.coords.latitude, pos.coords.longitude);
          applyAuto(code, 'Closest listed airport to your current location.');
        },
        () => {
          const team = airportCodeFromCityHints(originHintCities);
          if (team) {
            applyAuto(team, 'Suggested from a team preset city (location not shared).');
          } else {
            applyAuto('ORD', '', false);
          }
        },
        { enableHighAccuracy: false, timeout: 9000, maximumAge: 300_000 },
      );
    } else {
      const team = airportCodeFromCityHints(originHintCities);
      if (team) {
        applyAuto(team, 'Suggested from a team preset city (browser location unavailable).');
      } else {
        applyAuto('ORD', '', false);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [teamCitiesKey, originHintCities, persistOrigin]);

  const savedAirportOption = useMemo(() => {
    const u = originIata.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(u)) return null;
    if (TRAVEL_ORIGIN_AIRPORTS.some((o) => o.code === u)) return null;
    return { code: u, label: `${u} — saved` };
  }, [originIata]);

  const originSelectValue = useMemo(() => {
    const u = originIata.trim().toUpperCase();
    if (
      /^[A-Z]{3}$/.test(u) &&
      (TRAVEL_ORIGIN_AIRPORTS.some((o) => o.code === u) || savedAirportOption?.code === u)
    ) {
      return u;
    }
    return CUSTOM_ORIGIN_VALUE;
  }, [originIata, savedAirportOption]);

  const value = useMemo(
    () =>
      ({
        originIata,
        setOriginIata,
        originSuggestionNote,
        setOriginSuggestionNote,
        savedAirportOption,
        originSelectValue,
        persistOrigin,
      }) satisfies Ctx,
    [
      originIata,
      originSuggestionNote,
      savedAirportOption,
      originSelectValue,
      persistOrigin,
    ],
  );

  return <TravelPricingOriginContext.Provider value={value}>{children}</TravelPricingOriginContext.Provider>;
}
