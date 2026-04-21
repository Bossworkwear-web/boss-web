/** Build public object URL for Supabase Storage (`/object/public/...`). */
export function publicStorageObjectUrl(bucketId: string, objectPath: string): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  if (!base) {
    return "";
  }
  const path = objectPath
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${base}/storage/v1/object/public/${bucketId}/${path}`;
}
