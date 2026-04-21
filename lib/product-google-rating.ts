import productRatingsFile from "@/data/product-google-ratings.json";

export type ProductGoogleRating = {
  rating: number;
  userRatingsTotal: number;
  url?: string;
  /** `product` = entry in data/product-google-ratings.json; `business` = Google Places listing */
  scope: "product" | "business";
};

type FileEntry = {
  rating: number;
  userRatingsTotal?: number;
  url?: string;
};

type PlaceDetailsResult = {
  rating?: number;
  user_ratings_total?: number;
  url?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCuratedRating(slug: string): ProductGoogleRating | null {
  const map = productRatingsFile as Record<string, unknown>;
  const raw = map[slug];
  if (!isRecord(raw) || typeof raw.rating !== "number" || !Number.isFinite(raw.rating)) {
    return null;
  }
  if (raw.rating < 1 || raw.rating > 5) {
    return null;
  }
  const count =
    typeof raw.userRatingsTotal === "number" && Number.isFinite(raw.userRatingsTotal)
      ? Math.max(0, Math.round(raw.userRatingsTotal))
      : 0;
  const url = typeof raw.url === "string" && raw.url.trim().length > 0 ? raw.url.trim() : undefined;
  return {
    rating: raw.rating,
    userRatingsTotal: count,
    url,
    scope: "product",
  };
}

async function fetchBusinessRatingFromPlaces(
  placeId: string,
  apiKey: string,
): Promise<Omit<ProductGoogleRating, "scope"> | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("fields", "rating,user_ratings_total,url");
  url.searchParams.set("key", apiKey);

  try {
    const response = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as {
      status?: string;
      result?: PlaceDetailsResult;
    };
    if (data.status !== "OK" || !data.result || typeof data.result.rating !== "number") {
      return null;
    }
    const rating = data.result.rating;
    const total =
      typeof data.result.user_ratings_total === "number"
        ? Math.max(0, data.result.user_ratings_total)
        : 0;
    const mapsUrl =
      typeof data.result.url === "string" && data.result.url.trim().length > 0
        ? data.result.url.trim()
        : undefined;
    return {
      rating: Math.min(5, Math.max(1, rating)),
      userRatingsTotal: total,
      url: mapsUrl,
    };
  } catch {
    return null;
  }
}

/**
 * Resolves a rating to show under the product SKU.
 *
 * 1. `data/product-google-ratings.json` keyed by the product URL slug (curated per-product values).
 * 2. Else, if `GOOGLE_BUSINESS_PLACE_ID` and `GOOGLE_MAPS_API_KEY` are set, Google Places Details for that listing (store-wide).
 */
export async function getGoogleRatingForProductSlug(slug: string): Promise<ProductGoogleRating | null> {
  const curated = readCuratedRating(slug);
  if (curated) {
    return curated;
  }

  const placeId = process.env.GOOGLE_BUSINESS_PLACE_ID?.trim();
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!placeId || !apiKey) {
    return null;
  }

  const fromPlaces = await fetchBusinessRatingFromPlaces(placeId, apiKey);
  if (!fromPlaces) {
    return null;
  }

  return { ...fromPlaces, scope: "business" };
}
