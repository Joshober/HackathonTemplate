'use client';

import { CUSTOM_ORIGIN_VALUE, useTravelPricingOrigin } from '@/components/travel/approve/TravelPricingOriginContext';
import { TRAVEL_ORIGIN_AIRPORTS } from '@/lib/travelOriginAirports';

/** Origin airport selector — requires TravelPricingOriginProvider above. */
export default function PricingFlyingFromSection() {
  const {
    originIata,
    setOriginIata,
    originSuggestionNote,
    setOriginSuggestionNote,
    savedAirportOption,
    originSelectValue,
    persistOrigin,
  } = useTravelPricingOrigin();

  return (
    <div className="space-y-1.5">
      <label htmlFor="travel-pricing-origin" className="block text-xs font-medium text-gray-800">
        Home airport
      </label>
      <select
        id="travel-pricing-origin"
        value={originSelectValue}
        onChange={(e) => {
          const v = e.target.value;
          setOriginSuggestionNote(null);
          if (v === CUSTOM_ORIGIN_VALUE) {
            setOriginIata('');
            return;
          }
          setOriginIata(v);
          persistOrigin(v);
        }}
        className="w-full rounded-xl bg-white border border-gray-200 px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400"
      >
        {savedAirportOption ? (
          <option value={savedAirportOption.code}>{savedAirportOption.label}</option>
        ) : null}
        {TRAVEL_ORIGIN_AIRPORTS.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
          </option>
        ))}
        <option value={CUSTOM_ORIGIN_VALUE}>Other airport…</option>
      </select>
      {originSelectValue === CUSTOM_ORIGIN_VALUE ? (
        <div className="space-y-1">
          <label htmlFor="travel-pricing-origin-custom" className="sr-only">
            Other airport code
          </label>
          <input
            id="travel-pricing-origin-custom"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            maxLength={3}
            placeholder="3-letter code (e.g. DSM)"
            value={originIata}
            onChange={(e) => {
              setOriginSuggestionNote(null);
              setOriginIata(e.target.value.toUpperCase().replace(/[^A-Za-z]/g, '').slice(0, 3));
            }}
            onBlur={() => {
              const u = originIata.trim().toUpperCase();
              if (/^[A-Z]{3}$/.test(u)) persistOrigin(u);
            }}
            className="w-full rounded-xl bg-white border border-gray-200 px-3 py-2.5 text-sm text-gray-900 font-mono uppercase shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400"
          />
          <p className="text-[11px] text-travel-muted">Use the IATA code from your ticket or airline app.</p>
        </div>
      ) : null}
      {originSuggestionNote ? (
        <p className="text-[11px] text-emerald-900/90 bg-emerald-50/80 border border-emerald-100 rounded-lg px-2.5 py-1.5">
          {originSuggestionNote}
        </p>
      ) : null}
    </div>
  );
}
