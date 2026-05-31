import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

/** Absolute project root — avoids Turbopack mis-inferring `app/` when the repo path has spaces. */
function getProjectRoot(): string {
  if (process.env.VERCEL) {
    return process.cwd();
  }
  try {
    const url = import.meta.url;
    if (typeof url === "string" && url.length > 0) {
      return path.dirname(fileURLToPath(url));
    }
  } catch {
    // fall through
  }
  return process.cwd();
}

const projectRoot = getProjectRoot();
/** On Vercel, forcing `turbopack.root` can break the deployed output (edge returns NOT_FOUND). Only use locally when needed. */
const useCustomTurbopackRoot = !process.env.VERCEL && projectRoot.includes(" ");

const isProd = process.env.NODE_ENV === "production";

function supabaseImageRemotePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const patterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
    // Placeholder/fallback category hero images (DEFAULT_IMAGE_BY_SUB).
    { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
  ];
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (raw) {
    try {
      const { hostname } = new URL(raw);
      patterns.push({ protocol: "https", hostname, pathname: "/storage/v1/object/public/**" });
    } catch {
      // ignore malformed Supabase URL — same-origin proxy images still work.
    }
  }
  return patterns;
}

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
  // Empty string overrides NEXT_ADAPTER_PATH from defaultConfig (null/undefined are ignored).
  ...(isVercel ? { adapterPath: "" } : {}),
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  compiler: isProd
    ? {
        removeConsole: { exclude: ["error", "warn"] },
      }
    : undefined,
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: supabaseImageRemotePatterns(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/(.*)\\.(ico|png|jpg|jpeg|gif|webp|svg|woff|woff2)",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/quote/accept/:path*",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
  async redirects() {
    return [{ source: "/admin/delivery", destination: "/admin/dispatch", permanent: true }];
  },
  /** pdfkit loads AFM metrics from disk; bundling breaks at runtime. */
  serverExternalPackages: ["pdfkit"],
  ...(useCustomTurbopackRoot ? { turbopack: { root: projectRoot } } : {}),
  experimental: {
    optimizePackageImports: ["@supabase/supabase-js", "@supabase/ssr", "stripe"],
    // Allow uploading larger files via Server Actions (default is 1MB).
    // Needed for Admin → Production file uploads.
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
