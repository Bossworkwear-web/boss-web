/** Parse JSON text; returns null for empty/whitespace or invalid JSON (never throws). */
export function parseJsonOrNull(raw: string): unknown | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    return JSON.parse(s) as unknown;
  } catch {
    return null;
  }
}

/** Like {@link parseJsonOrNull} but accepts `sessionStorage` / `localStorage` null. */
export function parseStoredJsonOrNull(raw: string | null | undefined): unknown | null {
  if (raw == null) return null;
  return parseJsonOrNull(raw);
}

/** DB `placements` column from admin placements JSON text; invalid/empty → `[]`. */
export function parsePlacementsJsonValue(raw: string): unknown {
  const parsed = parseJsonOrNull(raw);
  return parsed ?? [];
}

/** Parse fetch body; empty or invalid JSON → `null` (never throws). */
export async function readResponseJson<T = unknown>(res: Response): Promise<T | null> {
  try {
    const text = await res.text();
    if (!text.trim()) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/** Re-throw Next.js `redirect()` / `notFound()` from server actions. */
export function isNextNavigationError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }
  const digest = String((error as { digest: unknown }).digest);
  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND");
}

/** `JSON.stringify` for hidden form fields; never returns undefined or empty string. */
export function stringifyJsonField(value: unknown, fallback = "{}"): string {
  try {
    const s = JSON.stringify(value);
    return s && s.length > 0 ? s : fallback;
  } catch {
    return fallback;
  }
}
