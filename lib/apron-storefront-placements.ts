import type { StorefrontPlacementOption } from "@/lib/storefront-placement-options";

export type ApronPdpPlacementProfile = "al-am" | "sam-sab";

/** Chef → Apron PDPs with AL / AM placement diagrams. */
const APRON_AL_AM_STYLE_CODES = new Set([
  "2501",
  "5AVL",
  "5AV",
  "5AVBI",
  "5ACBP",
  "5BS",
  "5BSNP",
  "5ACBE",
  "5ACBB",
  "5ACBC",
  "5ACBD",
  "BA35",
  "BA40",
  "BA55",
  "BA95",
]);

/** Chef → Apron PDPs with SAM / SAB placement diagrams. */
const APRON_SAM_SAB_STYLE_CODES = new Set([
  "2302",
  "2301",
  "2402",
  "2401",
  "2202",
  "2201",
  "5A",
  "5PC",
  "5BA",
  "5ACW",
  "5ADW",
  "BA94",
  "BA54",
]);

const APRON_STYLE_CODE_TO_PROFILE = new Map<string, ApronPdpPlacementProfile>([
  ...[...APRON_AL_AM_STYLE_CODES].map((code) => [code, "al-am"] as const),
  ...[...APRON_SAM_SAB_STYLE_CODES].map((code) => [code, "sam-sab"] as const),
]);

const APRON_PLACEMENT_ROWS_BY_PROFILE = {
  "al-am": [
    { id: "apron-al", name: "Apron Left" },
    { id: "apron-am", name: "Apron Middle" },
  ],
  "sam-sab": [
    { id: "apron-sam", name: "Side Apron Middle" },
    { id: "apron-sab", name: "Side Apron Bottom" },
  ],
} as const satisfies Record<ApronPdpPlacementProfile, readonly { id: string; name: string }[]>;

function normalizeApronStyleCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/-CLEARANCE$/i, "");
}

function styleCodesFromSlug(slug: string): string[] {
  const slugLc = slug.trim().toLowerCase();
  if (!slugLc) {
    return [];
  }
  const out: string[] = [];
  const tail = /(?:^|-)([a-z0-9]{2,12})$/i.exec(slugLc)?.[1];
  if (tail) {
    out.push(normalizeApronStyleCode(tail));
  }
  const jb = /(?:^|-)jb-([a-z0-9][a-z0-9_-]*)$/i.exec(slugLc)?.[1];
  if (jb) {
    const parts = jb.split("-").filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) {
      out.push(normalizeApronStyleCode(last));
    }
  }
  const dnc = /(?:^|-)dnc-([a-z0-9][a-z0-9_-]*)$/i.exec(slugLc)?.[1];
  if (dnc) {
    out.push(normalizeApronStyleCode(dnc));
  }
  return out;
}

function apronStyleCodeCandidates(meta: {
  slug?: string | null;
  name?: string | null;
  displayProductCode?: string | null;
}): string[] {
  const candidates: string[] = [];
  const displayCode = String(meta.displayProductCode ?? "").trim();
  if (displayCode) {
    candidates.push(normalizeApronStyleCode(displayCode));
  }
  const fromName = String(meta.name ?? "")
    .trim()
    .match(/\s*\(([A-Za-z0-9][A-Za-z0-9/_-]*)\)\s*$/)?.[1];
  if (fromName) {
    candidates.push(normalizeApronStyleCode(fromName));
  }
  for (const code of styleCodesFromSlug(String(meta.slug ?? ""))) {
    candidates.push(code);
  }
  return candidates;
}

export function resolveApronPdpPlacementProfile(meta: {
  slug?: string | null;
  name?: string | null;
  displayProductCode?: string | null;
}): ApronPdpPlacementProfile | null {
  for (const code of apronStyleCodeCandidates(meta)) {
    const profile = APRON_STYLE_CODE_TO_PROFILE.get(code);
    if (profile) {
      return profile;
    }
  }
  return null;
}

export function resolveApronPdpStyleCode(meta: {
  slug?: string | null;
  name?: string | null;
  displayProductCode?: string | null;
}): string | null {
  for (const code of apronStyleCodeCandidates(meta)) {
    if (APRON_STYLE_CODE_TO_PROFILE.has(code)) {
      return code;
    }
  }
  return null;
}

export function isApronPdpPlacementProduct(meta: {
  slug?: string | null;
  name?: string | null;
  displayProductCode?: string | null;
}): boolean {
  return resolveApronPdpPlacementProfile(meta) != null;
}

export function apronPdpPlacementRowsForProfile(
  profile: ApronPdpPlacementProfile,
): readonly { id: string; name: string }[] {
  return APRON_PLACEMENT_ROWS_BY_PROFILE[profile];
}

export function buildApronStorefrontPlacementOptions(
  profile: ApronPdpPlacementProfile,
): StorefrontPlacementOption[] {
  if (profile === "sam-sab") {
    return [
      {
        id: "apron-sam",
        label: "Side Apron Middle",
        short: "SAM",
        diagramAbbr: "SAM",
        embroideryCost: 9.95,
        printingCost: 9.95,
      },
      {
        id: "apron-sab",
        label: "Side Apron Bottom",
        short: "SAB",
        diagramAbbr: "SAB",
        embroideryCost: 24.95,
        printingCost: 19.95,
      },
    ];
  }
  return [
    {
      id: "apron-al",
      label: "Apron Left",
      short: "AL",
      diagramAbbr: "AL",
      embroideryCost: 9.95,
      printingCost: 9.95,
    },
    {
      id: "apron-am",
      label: "Apron Middle",
      short: "AM",
      diagramAbbr: "AM",
      embroideryCost: 24.95,
      printingCost: 19.95,
    },
  ];
}
