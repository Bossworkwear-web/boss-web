"use client";

import { useEffect, useMemo, useState } from "react";

type AddressParts = {
  address1: string;
  address2: string;
  suburb: string;
  postcode: string;
  state: string;
  country: string;
};

type AddressSectionsProps = {
  deliveryParts: AddressParts;
  billingParts: AddressParts;
  defaultSameAsDelivery: boolean;
};

type NominatimAddress = {
  road?: string;
  house_number?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  postcode?: string;
  country?: string;
};

type NominatimSuggestion = {
  display_name: string;
  address?: NominatimAddress;
  placeId?: string;
};

function rankSuggestions(query: string, data: NominatimSuggestion[]) {
  const normalizedQuery = query.toLowerCase().trim();
  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);

  return [...data]
    .sort((a, b) => {
      const aText = a.display_name.toLowerCase();
      const bText = b.display_name.toLowerCase();
      const aStarts = aText.startsWith(normalizedQuery) ? 1 : 0;
      const bStarts = bText.startsWith(normalizedQuery) ? 1 : 0;
      if (aStarts !== bStarts) {
        return bStarts - aStarts;
      }

      const aTokenHits = queryTokens.reduce((sum, token) => sum + (aText.includes(token) ? 1 : 0), 0);
      const bTokenHits = queryTokens.reduce((sum, token) => sum + (bText.includes(token) ? 1 : 0), 0);
      if (aTokenHits !== bTokenHits) {
        return bTokenHits - aTokenHits;
      }

      return aText.length - bText.length;
    })
    .slice(0, 5);
}

function inputClass(disabled: boolean) {
  return `rounded-md border border-brand-navy/20 px-3 py-2 ${disabled ? "bg-slate-100 text-brand-navy/50" : ""}`;
}

export function AddressSections({
  deliveryParts,
  billingParts,
  defaultSameAsDelivery,
}: AddressSectionsProps) {
  const [sameAsDelivery, setSameAsDelivery] = useState(defaultSameAsDelivery);
  const [deliveryAddress1, setDeliveryAddress1] = useState(deliveryParts.address1);
  const [deliverySuburb, setDeliverySuburb] = useState(deliveryParts.suburb);
  const [deliveryPostcode, setDeliveryPostcode] = useState(deliveryParts.postcode);
  const [deliveryState, setDeliveryState] = useState(deliveryParts.state);
  const [deliveryCountry, setDeliveryCountry] = useState(deliveryParts.country);

  const [suggestions, setSuggestions] = useState<NominatimSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const billingContainerClass = useMemo(
    () =>
      `space-y-3 rounded-xl border border-brand-navy/10 p-4 transition ${
        sameAsDelivery ? "opacity-60" : "opacity-100"
      }`,
    [sameAsDelivery],
  );

  useEffect(() => {
    const query = deliveryAddress1.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setLoadingSuggestions(true);
        const googleResponse = await fetch(`/api/address-autocomplete?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const googleData = (await googleResponse.json()) as {
          suggestions?: { description: string; placeId: string }[];
        };
        const googleSuggestions =
          googleData.suggestions?.map((item) => ({
            display_name: item.description,
            placeId: item.placeId,
          })) ?? [];

        if (googleSuggestions.length > 0) {
          setSuggestions(googleSuggestions.slice(0, 5));
        } else {
          const url =
            "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=au&limit=20&dedupe=0&q=" +
            encodeURIComponent(`${query}, Australia`);
          const response = await fetch(url, {
            signal: controller.signal,
            headers: {
              Accept: "application/json",
            },
          });
          if (!response.ok) {
            throw new Error("Address lookup failed");
          }
          const data = (await response.json()) as NominatimSuggestion[];
          setSuggestions(Array.isArray(data) ? rankSuggestions(query, data) : []);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [deliveryAddress1]);

  async function applySuggestion(item: NominatimSuggestion) {
    if (item.placeId) {
      try {
        const response = await fetch(`/api/address-details?placeId=${encodeURIComponent(item.placeId)}`);
        const data = (await response.json()) as {
          ok?: boolean;
          address?: {
            address1?: string;
            suburb?: string;
            postcode?: string;
            state?: string;
            country?: string;
          };
        };
        if (data.ok && data.address) {
          setDeliveryAddress1(data.address.address1 || item.display_name.split(",")[0]?.trim() || "");
          setDeliverySuburb(data.address.suburb || "");
          setDeliveryPostcode(data.address.postcode || "");
          setDeliveryState(data.address.state || "");
          setDeliveryCountry(data.address.country || "");
          setShowSuggestions(false);
          return;
        }
      } catch {
        // Fallback to the parsing logic below.
      }
    }

    const addr = item.address ?? {};
    const roadLine = [addr.house_number, addr.road].filter(Boolean).join(" ").trim();

    setDeliveryAddress1(roadLine || item.display_name.split(",")[0]?.trim() || "");
    setDeliverySuburb(addr.suburb || addr.city || addr.town || addr.village || "");
    setDeliveryPostcode(addr.postcode || "");
    setDeliveryState(addr.state || "");
    setDeliveryCountry(addr.country || "");
    setShowSuggestions(false);
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-3 rounded-xl border border-brand-navy/10 p-4">
        <h2 className="text-sm font-medium uppercase tracking-[0.1em] text-brand-navy/75">Delivery Address</h2>
        <div className="relative grid gap-2">
          <label htmlFor="delivery_address1" className="text-sm font-semibold">Address 1 *</label>
          <input
            id="delivery_address1"
            name="delivery_address1"
            value={deliveryAddress1}
            onChange={(e) => {
              setDeliveryAddress1(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              window.setTimeout(() => setShowSuggestions(false), 120);
            }}
            autoComplete="off"
            className={inputClass(false)}
          />
          {showSuggestions && (loadingSuggestions || suggestions.length > 0 || deliveryAddress1.trim().length >= 3) && (
            <div className="absolute top-full z-20 mt-1 w-full rounded-md border border-brand-navy/20 bg-white shadow-lg">
              {loadingSuggestions && <p className="px-3 py-2 text-xs text-brand-navy/70">Searching addresses...</p>}
              {!loadingSuggestions &&
                suggestions.map((item, index) => (
                  <button
                    key={item.placeId ?? `${item.display_name}-${index}`}
                    type="button"
                    onMouseDown={() => {
                      void applySuggestion(item);
                    }}
                    className="block w-full border-b border-brand-navy/10 px-3 py-2 text-left text-xs text-brand-navy last:border-b-0 hover:bg-brand-surface"
                  >
                    {item.display_name}
                  </button>
                ))}
              {!loadingSuggestions && suggestions.length === 0 && (
                <p className="px-3 py-2 text-xs text-brand-navy/70">
                  No exact suggestion found. Keep typing or enter manually.
                </p>
              )}
            </div>
          )}
        </div>
        <div className="grid gap-2">
          <label htmlFor="delivery_suburb" className="text-sm font-semibold">Suburb *</label>
          <input
            id="delivery_suburb"
            name="delivery_suburb"
            value={deliverySuburb}
            onChange={(e) => setDeliverySuburb(e.target.value)}
            className={inputClass(false)}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <label htmlFor="delivery_postcode" className="text-sm font-semibold">Postcode *</label>
            <input
              id="delivery_postcode"
              name="delivery_postcode"
              value={deliveryPostcode}
              onChange={(e) => setDeliveryPostcode(e.target.value)}
              className={inputClass(false)}
              placeholder="6000"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="delivery_state" className="text-sm font-semibold">State *</label>
            <input
              id="delivery_state"
              name="delivery_state"
              value={deliveryState}
              onChange={(e) => setDeliveryState(e.target.value)}
              className={inputClass(false)}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <label htmlFor="delivery_country" className="text-sm font-semibold">Country *</label>
          <input
            id="delivery_country"
            name="delivery_country"
            value={deliveryCountry}
            onChange={(e) => setDeliveryCountry(e.target.value)}
            className={inputClass(false)}
          />
        </div>
      </div>

      <div className={billingContainerClass}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium uppercase tracking-[0.1em] text-brand-navy/75">Billing Address</h2>
          <label className="inline-flex items-center gap-2 text-xs font-semibold text-brand-navy/80">
            <input
              type="checkbox"
              name="billing_same_as_delivery"
              checked={sameAsDelivery}
              onChange={(e) => setSameAsDelivery(e.target.checked)}
              className="h-4 w-4 accent-brand-orange"
            />
            Same as delivery
          </label>
        </div>
        <div className="grid gap-2">
          <label htmlFor="billing_address1" className="text-sm font-semibold">Address 1 *</label>
          <input id="billing_address1" name="billing_address1" defaultValue={billingParts.address1} disabled={sameAsDelivery} className={inputClass(sameAsDelivery)} />
        </div>
        <div className="grid gap-2">
          <label htmlFor="billing_suburb" className="text-sm font-semibold">Suburb *</label>
          <input id="billing_suburb" name="billing_suburb" defaultValue={billingParts.suburb} disabled={sameAsDelivery} className={inputClass(sameAsDelivery)} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid gap-2">
            <label htmlFor="billing_postcode" className="text-sm font-semibold">Postcode *</label>
            <input id="billing_postcode" name="billing_postcode" defaultValue={billingParts.postcode} disabled={sameAsDelivery} className={inputClass(sameAsDelivery)} placeholder="6000" />
          </div>
          <div className="grid gap-2">
            <label htmlFor="billing_state" className="text-sm font-semibold">State *</label>
            <input id="billing_state" name="billing_state" defaultValue={billingParts.state} disabled={sameAsDelivery} className={inputClass(sameAsDelivery)} />
          </div>
        </div>
        <div className="grid gap-2">
          <label htmlFor="billing_country" className="text-sm font-semibold">Country *</label>
          <input id="billing_country" name="billing_country" defaultValue={billingParts.country} disabled={sameAsDelivery} className={inputClass(sameAsDelivery)} />
        </div>
      </div>
    </div>
  );
}
