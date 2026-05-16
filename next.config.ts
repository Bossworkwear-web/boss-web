import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute project root — avoids Turbopack mis-inferring `app/` when the repo path has spaces. */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
/** On Vercel, forcing `turbopack.root` can break the deployed output (edge returns NOT_FOUND). Only use locally when needed. */
const useCustomTurbopackRoot = !process.env.VERCEL && projectRoot.includes(" ");

const isProd = process.env.NODE_ENV === "production";

function supabaseImageRemotePatterns(): NonNullable<NextConfig["images"]>["remotePatterns"] {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) {
    return [];
  }
  try {
    const { hostname } = new URL(raw);
    return [{ protocol: "https", hostname, pathname: "/storage/v1/object/public/**" }];
  } catch {
    return [];
  }
}

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
];

const nextConfig: NextConfig = {
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
