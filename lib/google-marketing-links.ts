import { getSiteUrl } from "@/lib/site-url";

/** Apex domain for Search Console `sc-domain:` resource (no www). */
export function getMarketingSiteDomain(): string {
  try {
    return new URL(getSiteUrl()).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "bossworkwear.au";
  }
}

/** GA4 admin — deep-links to property home when NEXT_PUBLIC_GA4_PROPERTY_ID is set. */
export function getGoogleAnalyticsAdminUrl(): string {
  const raw = process.env.NEXT_PUBLIC_GA4_PROPERTY_ID?.trim().replace(/^properties\//i, "") ?? "";
  if (/^\d+$/.test(raw)) {
    return `https://analytics.google.com/analytics/web/#/p${raw}/reports/intelligenthome`;
  }
  return "https://analytics.google.com/analytics/web/";
}

/** GA4 real-time report (optional deep link). */
export function getGoogleAnalyticsRealtimeUrl(): string {
  const raw = process.env.NEXT_PUBLIC_GA4_PROPERTY_ID?.trim().replace(/^properties\//i, "") ?? "";
  if (/^\d+$/.test(raw)) {
    return `https://analytics.google.com/analytics/web/#/p${raw}/reports/intelligenthome?params=_u..nav%3Dmaui-realtime`;
  }
  return "https://analytics.google.com/analytics/web/";
}

/** Search Console for domain property (sc-domain:example.com). */
export function getGoogleSearchConsoleUrl(): string {
  const domain = getMarketingSiteDomain();
  const resourceId = `sc-domain:${domain}`;
  return `https://search.google.com/search-console?resource_id=${encodeURIComponent(resourceId)}`;
}

export const GOOGLE_MARKETING_LINKS = {
  ga4: {
    label: "Google Analytics 4",
    description: "Site traffic, online orders (purchase), and bulk quote requests (quote_request).",
    href: getGoogleAnalyticsAdminUrl(),
  },
  searchConsole: {
    label: "Google Search Console",
    description: "Google Search visibility, queries, indexing, and sitemap status.",
    href: getGoogleSearchConsoleUrl(),
  },
} as const;
