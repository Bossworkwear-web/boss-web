function encodeStoragePathSegment(seg: string): string {
  if (!seg) return seg;
  try {
    return encodeURIComponent(decodeURIComponent(seg));
  } catch {
    return encodeURIComponent(seg);
  }
}

/** Build public object URL for Supabase Storage (`/object/public/...`). */
export function publicStorageObjectUrl(bucketId: string, objectPath: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  if (!base) {
    return "";
  }
  const path = objectPath
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeStoragePathSegment(seg))
    .join("/");
  return `${base}/storage/v1/object/public/${bucketId}/${path}`;
}
