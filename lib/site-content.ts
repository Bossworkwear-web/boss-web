import { createSupabaseAdminClient } from "@/lib/supabase";

export const HOMEPAGE_HERO_LINE1_KEY = "homepage_hero_line1";
export const HOMEPAGE_HERO_LINE2_KEY = "homepage_hero_line2";
export const HOMEPAGE_HERO_SUBTEXT_KEY = "homepage_hero_subtext";

export const LEGAL_PAGE_SLUGS = ["terms", "privacy", "shipping", "returns"] as const;
export type LegalPageSlug = (typeof LEGAL_PAGE_SLUGS)[number];

export const LEGAL_PAGE_LABELS: Record<LegalPageSlug, string> = {
  terms: "Terms & Conditions",
  privacy: "Privacy Policy",
  shipping: "Shipping Policy",
  returns: "Returns Policy",
};

export const LEGAL_PAGE_PATHS: Record<LegalPageSlug, string> = {
  terms: "/terms-and-conditions",
  privacy: "/privacy-policy",
  shipping: "/shipping-policy",
  returns: "/returns-policy",
};

export function legalPageContentKey(slug: LegalPageSlug): string {
  return `legal:${slug}`;
}

export const DEFAULT_HOMEPAGE_HERO = {
  line1: "Trusted Workwear for Teams",
  line2: "That Keeps Industries Moving.",
  subtext:
    "From corporate polos to medical scrubs, we deliver professional uniforms designed for durability, comfort, and branding impact.",
} as const;

export type HomepageHeroContent = {
  line1: string;
  line2: string;
  subtext: string;
};

export async function getSiteContentValue(key: string): Promise<string | null> {
  const trimmedKey = key.trim();
  if (!trimmedKey) {
    return null;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("site_content").select("body").eq("key", trimmedKey).maybeSingle();
    if (error || !data) {
      return null;
    }
    const body = typeof data.body === "string" ? data.body : "";
    return body.trim() ? body : null;
  } catch {
    return null;
  }
}

export async function getHomepageHeroContent(): Promise<HomepageHeroContent> {
  const [line1, line2, subtext] = await Promise.all([
    getSiteContentValue(HOMEPAGE_HERO_LINE1_KEY),
    getSiteContentValue(HOMEPAGE_HERO_LINE2_KEY),
    getSiteContentValue(HOMEPAGE_HERO_SUBTEXT_KEY),
  ]);

  return {
    line1: line1?.trim() || DEFAULT_HOMEPAGE_HERO.line1,
    line2: line2?.trim() || DEFAULT_HOMEPAGE_HERO.line2,
    subtext: subtext?.trim() || DEFAULT_HOMEPAGE_HERO.subtext,
  };
}

export async function getLegalPageCmsHtml(slug: LegalPageSlug): Promise<string | null> {
  return getSiteContentValue(legalPageContentKey(slug));
}

export function mergeHomepageHeroContent(input: Partial<HomepageHeroContent>): HomepageHeroContent {
  return {
    line1: input.line1?.trim() || DEFAULT_HOMEPAGE_HERO.line1,
    line2: input.line2?.trim() || DEFAULT_HOMEPAGE_HERO.line2,
    subtext: input.subtext?.trim() || DEFAULT_HOMEPAGE_HERO.subtext,
  };
}
