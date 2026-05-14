/**
 * Diagrams in `public/Logo_Location/` for storefront placement rows (see `PremiumWorkPoloClient` §4).
 * Filenames match supplier abbreviations: LC, RC, CC, BU, BM, FB, FC, LS, RS.
 */
const LOGO_LOCATION_PUBLIC_DIR = "/Logo_Location";

const PLACEMENT_ID_TO_FILE: Record<string, string> = {
  "left-chest": "LC.png",
  "right-chest": "RC.png",
  "center-chest": "CC.png",
  "back-upper": "BU.png",
  "back-middle": "BM.png",
  "full-back": "FB.png",
  /** Legacy ids */
  "front-full": "FB.png",
  "front-bottom": "FB.png",
  "full-chest": "FC.png",
  /** Legacy id */
  "front-collar": "FC.png",
  "left-sleeve": "LS.png",
  "right-sleeve": "RS.png",
};

const PLACEMENT_NAME_TO_FILE: Record<string, string> = {
  "left chest": "LC.png",
  "left-hand chest": "LC.png",
  "right chest": "RC.png",
  "center chest": "CC.png",
  "back upper": "BU.png",
  "back middle": "BM.png",
  "full back": "FB.png",
  "front full": "FB.png",
  "front bottom": "FB.png",
  "full chest": "FC.png",
  "front collar": "FC.png",
  /** Supplier-style codes used as DB labels */
  fb: "FB.png",
  fc: "FC.png",
  back: "BU.png",
  "left sleeve": "LS.png",
  "right sleeve": "RS.png",
};

/** Two-letter codes from placement names (matches `toShortCode` / diagram filenames). */
const PLACEMENT_ABBR_TO_FILE: Record<string, string> = {
  LC: "LC.png",
  RC: "RC.png",
  CC: "CC.png",
  BU: "BU.png",
  BM: "BM.png",
  FB: "FB.png",
  FC: "FC.png",
  LS: "LS.png",
  RS: "RS.png",
};

function publicLogoLocationUrl(file: string): string {
  return `${LOGO_LOCATION_PUBLIC_DIR}/${encodeURIComponent(file)}`;
}

function normalizedSpacedLabel(placementLabel: string): string {
  return placementLabel
    .normalize("NFC")
    .trim()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Last-resort match when DB labels use punctuation, Korean notes in parens, etc. */
function fileFromHeuristicPlacementLabel(placementLabel: string): string | undefined {
  const s = normalizedSpacedLabel(placementLabel);
  if (!s) {
    return undefined;
  }
  if (/\bfb\b/.test(s)) {
    return "FB.png";
  }
  if (/\bfc\b/.test(s)) {
    return "FC.png";
  }
  if (/\bfull chest\b/.test(s) || /\bchest full\b/.test(s)) {
    return "FC.png";
  }
  if (/\bfront\b/.test(s) && /\bcollar\b/.test(s)) {
    return "FC.png";
  }
  if (/\bfull back\b/.test(s) || /\bback full\b/.test(s)) {
    return "FB.png";
  }
  if (/\bfront\b/.test(s) && /\bfull\b/.test(s)) {
    return "FB.png";
  }
  if (/\bfront\b/.test(s) && /\bbottom\b/.test(s)) {
    return "FB.png";
  }
  return undefined;
}

function fileForPlacementName(placementLabel: string): string | undefined {
  const spaced = normalizedSpacedLabel(placementLabel);
  if (!spaced) {
    return undefined;
  }
  const compact = spaced.replace(/\s/g, "");
  const keys = [...new Set([spaced, compact])];
  for (const k of keys) {
    const hit = PLACEMENT_NAME_TO_FILE[k];
    if (hit) {
      return hit;
    }
  }
  return undefined;
}

export type PlacementLogoLocationOpts = {
  /** Two uppercase letters (e.g. FB, FC) when the DB label does not match `PLACEMENT_NAME_TO_FILE`. */
  diagramAbbr?: string | null;
};

/** Public URL for placement diagram, or null when no file is defined. */
export function placementLogoLocationSrc(
  placementId: string,
  placementLabel: string,
  opts?: PlacementLogoLocationOpts,
): string | null {
  const id = placementId.trim().toLowerCase();
  const fromId = PLACEMENT_ID_TO_FILE[id];
  if (fromId) {
    return publicLogoLocationUrl(fromId);
  }

  const fromName = fileForPlacementName(placementLabel);
  if (fromName) {
    return publicLogoLocationUrl(fromName);
  }

  const spaced = normalizedSpacedLabel(placementLabel);
  if (spaced) {
    const slugKey = spaced.replace(/\s+/g, "-");
    const fromSlug = PLACEMENT_ID_TO_FILE[slugKey];
    if (fromSlug) {
      return publicLogoLocationUrl(fromSlug);
    }
  }

  const abbr = opts?.diagramAbbr?.trim().toUpperCase() ?? "";
  if (abbr.length === 2) {
    const fromAbbr = PLACEMENT_ABBR_TO_FILE[abbr];
    if (fromAbbr) {
      return publicLogoLocationUrl(fromAbbr);
    }
  }

  const fromHeuristic = fileFromHeuristicPlacementLabel(placementLabel);
  if (fromHeuristic) {
    return publicLogoLocationUrl(fromHeuristic);
  }

  return null;
}
