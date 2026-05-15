import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { publicStorageObjectUrl } from "@/lib/supabase-public-storage-url";

export const dynamic = "force-dynamic";

/** Repo-local fallback when Storage has no object (dev / before upload). */
function localAp2310BackAbsPath(): string {
  return join(
    /* turbopackIgnore: true */ process.cwd(),
    "data",
    "supplier",
    "Aussie Pacific",
    "2310_back.webp",
  );
}

/** `/api/supplier-media/aussie-pacific/2310_back.webp` */
function isAp2310BackMediaRequest(parts: string[]): boolean {
  if (parts.length < 2) return false;
  const sup = String(parts[0] ?? "").trim().toLowerCase();
  const file = String(parts[parts.length - 1] ?? "").trim().toLowerCase();
  if (file !== "2310_back.webp") return false;
  return sup === "aussie-pacific" || sup === "aussie pacific";
}

function tryLocalAp2310BackResponse(): Response | null {
  const fp = localAp2310BackAbsPath();
  if (!existsSync(fp)) {
    return null;
  }
  const buf = readFileSync(fp);
  return new Response(buf, {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}

const BUCKET = process.env.SUPPLIER_IMAGES_BUCKET ?? "supplier-product-images";

const MEDIA_PREFIX = "/api/supplier-media/";

/** Prefer pathname on the request — avoids Turbopack/param edge cases for `[...path]`. */
function pathSegmentsFromRequestUrl(requestUrl: string): string[] {
  let pathname: string;
  try {
    pathname = new URL(requestUrl).pathname;
  } catch {
    return [];
  }
  if (!pathname.startsWith(MEDIA_PREFIX)) {
    return [];
  }
  const tail = pathname.slice(MEDIA_PREFIX.length);
  return tail
    .split("/")
    .filter((s) => s.length > 0 && s !== "..")
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
}

function filenameFromParts(parts: string[]): string {
  return parts.length > 0 ? (parts[parts.length - 1] ?? "") : "";
}

function mimeFromFilename(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".avif")) return "image/avif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  return null;
}

function isAllowedImageContentType(ct: string, filename: string): boolean {
  const c = ct.split(";")[0]?.trim().toLowerCase() ?? "";
  if (c.startsWith("image/")) {
    return true;
  }
  if (c === "application/octet-stream" || c === "binary/octet-stream") {
    return mimeFromFilename(filename) != null;
  }
  return false;
}

function effectiveContentType(upstreamCt: string, filename: string): string {
  const base = upstreamCt.split(";")[0]?.trim() ?? "";
  if (base.toLowerCase().startsWith("image/")) {
    return base;
  }
  return mimeFromFilename(filename) ?? "application/octet-stream";
}

/**
 * Objects uploaded from macOS often use NFD (decomposed) Unicode in folder/file names; URLs and
 * Linux-backed Storage lookups are typically NFC. Try both so the same browser URL resolves.
 */
function storageObjectPathVariants(parts: string[]): string[] {
  const base = parts.filter(Boolean);
  if (base.length < 2) {
    return [];
  }
  const nfc = base.map((s) => s.normalize("NFC")).join("/").replace(/\/+/g, "/");
  const nfd = base.map((s) => s.normalize("NFD")).join("/").replace(/\/+/g, "/");
  return nfc === nfd ? [nfc] : [nfc, nfd];
}

function mergePathParts(req: Request, paramsPath: string[] | undefined): string[] {
  const fromReq = pathSegmentsFromRequestUrl(req.url);
  if (fromReq.length >= 2) {
    return fromReq;
  }
  const fromParams = Array.isArray(paramsPath) ? paramsPath.filter(Boolean) : [];
  return fromParams;
}

async function logStorageFetchFailure(res: Response, fetchUrl: string, bucketId: string): Promise<void> {
  if (process.env.NODE_ENV !== "development") {
    return;
  }
  const rawCt = res.headers.get("content-type") ?? "";
  let extra = "";
  if (rawCt.includes("application/json")) {
    try {
      const j = (await res.clone().json()) as { error?: string; message?: string };
      const msg = `${j?.error ?? ""} ${j?.message ?? ""}`.toLowerCase();
      if (msg.includes("bucket not found")) {
        extra = `\n  → Supabase has no Storage bucket id "${bucketId}". Create it: Dashboard → Storage → New bucket (public), id = ${bucketId}\n  → Or run SQL: supabase/migrations/20260401_supplier_product_images_bucket.sql\n  → If the bucket name differs, set SUPPLIER_IMAGES_BUCKET and NEXT_PUBLIC_SUPPLIER_IMAGES_BUCKET in .env.local\n  → Confirm NEXT_PUBLIC_SUPABASE_URL is the same project where the bucket exists.`;
      }
    } catch {
      /* ignore */
    }
  }
  console.error("[supplier-media] upstream", res.status, fetchUrl, extra || "");
}

/**
 * Stream catalogue images from Supabase Storage on the **same origin** as the storefront.
 * Replacing a 307 redirect avoids Chrome `net::ERR_BLOCKED_BY_ORB` on cross-origin image loads
 * after redirects (opaque / non-image error bodies, sniffing, etc.).
 */
export async function GET(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const resolved = await ctx.params;
  const parts = mergePathParts(req, resolved.path);
  const variants = storageObjectPathVariants(parts);
  if (variants.length === 0) {
    return new Response("Not found", { status: 404 });
  }

  const filename = filenameFromParts(parts);
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!baseUrl.trim()) {
    const localEarly = isAp2310BackMediaRequest(parts) ? tryLocalAp2310BackResponse() : null;
    if (localEarly) {
      return localEarly;
    }
    return new Response("Storage not configured", { status: 503 });
  }

  let upstream: Response | null = null;
  let triedUrl = "";
  for (const objectPath of variants) {
    triedUrl = publicStorageObjectUrl(BUCKET, objectPath);
    if (!triedUrl) {
      continue;
    }
    const res = await fetch(triedUrl, {
      method: "GET",
      redirect: "follow",
      headers: { Accept: "image/*,*/*;q=0.8" },
    });
    if (res.ok) {
      upstream = res;
      break;
    }
    await logStorageFetchFailure(res, triedUrl, BUCKET);
  }

  if (!upstream || !upstream.ok) {
    const local = isAp2310BackMediaRequest(parts) ? tryLocalAp2310BackResponse() : null;
    if (local) {
      return local;
    }
    return new Response("Not found", { status: 404 });
  }

  const rawCt = upstream.headers.get("content-type") ?? "";

  if (!isAllowedImageContentType(rawCt, filename)) {
    if (process.env.NODE_ENV === "development") {
      console.error("[supplier-media] rejected content-type", rawCt, triedUrl);
    }
    return new Response("Not found", { status: 404 });
  }

  const outType = effectiveContentType(rawCt, filename);
  const cache = upstream.headers.get("cache-control")?.trim();
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": outType,
      "Cache-Control":
        cache && cache.length > 0 ? cache : "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}

export async function HEAD(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const resolved = await ctx.params;
  const parts = mergePathParts(req, resolved.path);
  const variants = storageObjectPathVariants(parts);
  if (variants.length === 0) {
    return new Response(null, { status: 404 });
  }

  const filename = filenameFromParts(parts);
  if (!(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim()) {
    if (isAp2310BackMediaRequest(parts) && existsSync(localAp2310BackAbsPath())) {
      return new Response(null, {
        status: 200,
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }
    return new Response(null, { status: 503 });
  }

  let upstream: Response | null = null;
  let triedUrl = "";
  for (const objectPath of variants) {
    triedUrl = publicStorageObjectUrl(BUCKET, objectPath);
    if (!triedUrl) {
      continue;
    }
    const res = await fetch(triedUrl, {
      method: "HEAD",
      redirect: "follow",
    });
    if (res.ok) {
      upstream = res;
      break;
    }
    await logStorageFetchFailure(res, triedUrl, BUCKET);
  }

  if (!upstream || !upstream.ok) {
    if (isAp2310BackMediaRequest(parts) && existsSync(localAp2310BackAbsPath())) {
      return new Response(null, {
        status: 200,
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        },
      });
    }
    return new Response(null, { status: 404 });
  }

  const rawCt = upstream.headers.get("content-type") ?? "";
  if (rawCt && !isAllowedImageContentType(rawCt, filename)) {
    if (process.env.NODE_ENV === "development") {
      console.error("[supplier-media] HEAD rejected content-type", rawCt, triedUrl);
    }
    return new Response(null, { status: 404 });
  }

  const outType = rawCt ? effectiveContentType(rawCt, filename) : mimeFromFilename(filename) ?? "image/jpeg";
  const cache = upstream.headers.get("cache-control")?.trim();
  return new Response(null, {
    status: 200,
    headers: {
      "Content-Type": outType,
      "Cache-Control":
        cache && cache.length > 0 ? cache : "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
