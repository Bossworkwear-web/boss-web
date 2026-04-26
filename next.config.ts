import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Absolute project root — avoids Turbopack mis-inferring `app/` when the repo path has spaces. */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));
/** On Vercel, forcing `turbopack.root` can break the deployed output (edge returns NOT_FOUND). Only use locally when needed. */
const useCustomTurbopackRoot = !process.env.VERCEL && projectRoot.includes(" ");

const nextConfig: NextConfig = {
  outputFileTracingExcludes: {
    "/api/supplier-media/[supplier]/[...path]": ["./data/supplier/**/*"],
  },
  async headers() {
    return [
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
    // Allow uploading larger files via Server Actions (default is 1MB).
    // Needed for Admin → Production file uploads.
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
