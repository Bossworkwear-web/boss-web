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

/** `JSON.stringify` for hidden form fields; never returns undefined or empty string. */
export function stringifyJsonField(value: unknown, fallback = "{}"): string {
  try {
    const s = JSON.stringify(value);
    return s && s.length > 0 ? s : fallback;
  } catch {
    return fallback;
  }
}
