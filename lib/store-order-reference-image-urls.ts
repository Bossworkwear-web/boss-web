const STORAGE_PUBLIC_PATH = /https?:\/\/[^\s/]+\/storage\/v1\/object\/public\/[^\s<>"')]+/gi;

/** Public Supabase Storage URLs allowed on order line notes (logo / reference uploads). */
export function sanitizeStoreOrderReferenceImageUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  if (!base) {
    return [];
  }
  const prefix = `${base}/storage/v1/object/public/`;
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") {
      continue;
    }
    const t = x.trim();
    if (t.startsWith(prefix) && t.length < 2048 && !out.includes(t)) {
      out.push(t);
    }
  }
  return out;
}

export function mergeNotesWithReferenceImageUrls(
  notes: string | null | undefined,
  urls: string[],
): string | null {
  const safe = urls.filter(Boolean);
  const base = (notes ?? "").trim();
  if (safe.length === 0) {
    return base.length > 0 ? base : null;
  }
  const block = safe.join("\n");
  const merged = base ? `${base}\n\n${block}` : block;
  const max = 12000;
  return merged.length > max ? merged.slice(0, max) : merged;
}

export function storagePathFromProductionAssetsUrl(url: string): string | null {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  if (!base || !url.startsWith(base)) {
    return null;
  }
  const prefix = `${base}/storage/v1/object/public/production-order-assets/`;
  if (!url.startsWith(prefix)) {
    return null;
  }
  try {
    return decodeURIComponent(url.slice(prefix.length));
  } catch {
    return url.slice(prefix.length);
  }
}

export function extractReferenceImageUrlsFromNotes(text: string): string[] {
  const matches = text.match(STORAGE_PUBLIC_PATH);
  if (!matches) {
    return [];
  }
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  const prefix = `${base}/storage/v1/object/public/`;
  const out: string[] = [];
  for (const m of matches) {
    const t = m.trim();
    if (t.startsWith(prefix) && !out.includes(t)) {
      out.push(t);
    }
  }
  return out;
}
