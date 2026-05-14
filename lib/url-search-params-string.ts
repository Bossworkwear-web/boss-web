/** Next.js `searchParams` values may be `string | string[] | undefined`. */
export function firstQueryString(v: string | string[] | undefined): string {
  if (v == null) {
    return "";
  }
  return (Array.isArray(v) ? String(v[0] ?? "") : String(v)).trim();
}
