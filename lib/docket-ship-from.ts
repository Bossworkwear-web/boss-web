/** Printable delivery docket — sender block when env is missing or still has placeholder text. */

export const DOCKET_DEFAULT_FROM_NAME = "Boss Workwear";

export const DOCKET_DEFAULT_FROM_ADDRESS =
  "Shop152 / 253 Walter Rd W\nPerth Western Australia 6062";

function looksLikeShipFromPlaceholderName(raw: string): boolean {
  const t = raw.toLowerCase();
  if (t.includes("set store_ship_from_name")) return true;
  if (/^ship\s+from\s*\(/.test(t)) return true;
  return false;
}

function looksLikeShipFromPlaceholderAddress(raw: string): boolean {
  const t = raw.toLowerCase();
  if (t.includes("edit store_ship_from_address")) return true;
  if (t.includes("your warehouse address")) return true;
  return false;
}

/** Use for docket only: real env wins; empty or placeholder → defaults. */
export function resolveDocketShipFromName(): string {
  const raw = process.env.STORE_SHIP_FROM_NAME?.trim() ?? "";
  if (!raw || looksLikeShipFromPlaceholderName(raw)) {
    return DOCKET_DEFAULT_FROM_NAME;
  }
  return raw;
}

export function resolveDocketShipFromAddress(): string {
  const raw = process.env.STORE_SHIP_FROM_ADDRESS?.trim() ?? "";
  if (!raw || looksLikeShipFromPlaceholderAddress(raw)) {
    return DOCKET_DEFAULT_FROM_ADDRESS;
  }
  return raw;
}
