const LOGO_LINK_MAX = 2000;
const LOGO_LINKS_MAX_COUNT = 12;

/** Parse a JSON array string e.g. `["a","b"]` saved by mistake into a text column. */
function parseJsonArrayString(raw: string): string[] | null {
  const t = raw.trim();
  if (!t.startsWith("[")) return null;
  try {
    const parsed: unknown = JSON.parse(t);
    if (!Array.isArray(parsed)) return null;
    return parsed.map((v) => String(v ?? "").trim()).filter(Boolean);
  } catch {
    return null;
  }
}

/** Parse Postgres text[] literal e.g. `{a,b}` when returned as a string. */
function parsePostgresArrayString(raw: string): string[] | null {
  const t = raw.trim();
  if (!t.startsWith("{") || !t.endsWith("}")) return null;
  const inner = t.slice(1, -1).trim();
  if (!inner) return [];
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      const part = cur.trim();
      if (part) out.push(part);
      cur = "";
      continue;
    }
    cur += ch;
  }
  const tail = cur.trim();
  if (tail) out.push(tail);
  return out;
}

function expandLinkToken(raw: string): string[] {
  const t = raw.trim();
  if (!t) return [];
  return (
    parseJsonArrayString(t) ??
    parsePostgresArrayString(t) ??
    [t]
  );
}

/** Normalise a DB value (text[], legacy text, or JSON array string) into a trimmed string array. */
export function parseStoreOrderLogoFileLinks(value: unknown): string[] {
  if (Array.isArray(value)) {
    const out: string[] = [];
    for (const item of value) {
      out.push(...expandLinkToken(String(item ?? "")));
    }
    return out.filter(Boolean);
  }
  if (typeof value === "string") {
    return expandLinkToken(value);
  }
  return [];
}

/** Trim, cap length, drop empties, and limit count before persisting. */
export function sanitizeStoreOrderLogoFileLinks(links: string[]): string[] {
  const out: string[] = [];
  for (const raw of links ?? []) {
    for (const part of expandLinkToken(String(raw ?? ""))) {
      const t = part.slice(0, LOGO_LINK_MAX);
      if (t) out.push(t);
      if (out.length >= LOGO_LINKS_MAX_COUNT) return out;
    }
  }
  return out;
}

/** Production pack display: `link1, link2` (no brackets or quotes). */
export function formatStoreOrderLogoFileLinksForDisplay(links: string[]): string {
  return parseStoreOrderLogoFileLinks(links).join(", ");
}
