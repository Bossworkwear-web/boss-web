import fs from "node:fs";
import path from "node:path";

import { LOGO_SRC } from "@/app/generated/logo";

/** Absolute path to the storefront logo in `public/`, if the file exists. */
export function resolveTaxInvoiceLogoFilePath(): string | null {
  const rel = LOGO_SRC.replace(/^\//, "");
  const full = path.join(process.cwd(), "public", rel);
  return fs.existsSync(full) ? full : null;
}

/**
 * URL for `<img src>` on tax invoice HTML: site URL when set, otherwise inline data URI
 * so downloaded HTML still shows the logo offline.
 */
export function taxInvoiceLogoHtmlSrc(): string {
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ?? "";
  if (site) {
    return `${site}${LOGO_SRC}`;
  }
  const filePath = resolveTaxInvoiceLogoFilePath();
  if (!filePath) {
    return "";
  }
  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === ".png" ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${buf.toString("base64")}`;
}
