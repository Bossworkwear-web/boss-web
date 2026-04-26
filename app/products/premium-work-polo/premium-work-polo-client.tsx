"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { CalculatorIcon, PlacementIcon, UploadIcon } from "@/app/components/icons";
import { isPpeStorefrontProduct } from "@/lib/catalog";
import { STOREFRONT_RETAIL_GST_RATE } from "@/lib/product-price";
import { storefrontLeadingSupplierBrand } from "@/lib/product-display-name";
import { STORE_MAIN_SHELL_CLASS } from "@/lib/store-main-shell";
import { SITE_PAGE_INSET_X_CLASS } from "@/lib/site-layout";
import { uploadStoreCheckoutReferenceImages } from "@/app/orders/actions";
import { addCartItem, getCartItems, removeCartItem, updateCartItem, type CartItem } from "@/lib/cart";
import { productPathSegment } from "@/lib/product-path-slug";
import { productCardDisplayLines, productDetailDescriptionBody } from "@/lib/product-card-copy";
import {
  getSizeGuideBundle,
  inferSizeGuideKind,
  sizeGuideToPlainText,
  type SizeGuideBundle,
} from "@/lib/product-size-guide";
import {
  appendSupplierLinksToPlainText,
  resolveSupplierSizeChartLinks,
  type SupplierSizeChartLink,
} from "@/lib/supplier-size-chart-links";
import { placementLogoLocationSrc } from "@/lib/placement-logo-location";
import { syncSidebarNavFromProductIfNeeded } from "@/lib/sidebar-nav";
import type { ProductGoogleRating } from "@/lib/product-google-rating";

type ServiceType = "Plain" | "Embroidery" | "Printing";

type PlacementOption = {
  id: string;
  label: string;
  short: string;
  /** Two-letter code for diagram asset (RC stays `RC` even when `short` is “RC for Names”). */
  diagramAbbr: string;
  embroideryCost: number;
  printingCost: number;
};

type DecoratedServiceType = Exclude<ServiceType, "Plain">;

/** §3 Service Type — raster artwork in `public/button/` (idle). */
const SERVICE_TYPE_BUTTON_IMAGE: Record<ServiceType, string> = {
  Plain: "/button/Button_Plain.png",
  Embroidery: "/button/Buttom_Emb.png",
  Printing: "/button/Button_Print.png",
};

/** Pressed / selected: same folder, `*_2.png` (pressed artwork). */
const SERVICE_TYPE_BUTTON_IMAGE_SELECTED: Record<ServiceType, string> = {
  Plain: "/button/Button_Plain_2.png",
  Embroidery: "/button/Buttom_Emb_2.png",
  Printing: "/button/Button_Print_2.png",
};

/** Soft drop shadow behind each §3 artwork button (idle). */
const SERVICE_TYPE_BUTTON_SHADOW_IDLE: Record<ServiceType, string> = {
  Plain:
    "shadow-[0_5px_18px_-5px_rgba(0,31,63,0.22),0_2px_8px_-2px_rgba(0,31,63,0.12)]",
  Embroidery:
    "shadow-[0_5px_18px_-5px_rgba(255,133,27,0.26),0_2px_8px_-2px_rgba(255,133,27,0.13)]",
  Printing:
    "shadow-[0_5px_18px_-5px_rgba(59,130,246,0.28),0_2px_8px_-2px_rgba(59,130,246,0.14)]",
};

type LogoAttachmentRow = {
  key: string;
  file: File;
  /** Object URL for image previews only; empty for PDF / AI. */
  previewUrl: string;
};

const MAX_LOGO_FILES = 8;
const MAX_LOGO_BYTES = 20 * 1024 * 1024;

function isAllowedLogoFile(file: File): boolean {
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("image/")) {
    return true;
  }
  if (t === "application/pdf") {
    return true;
  }
  if (t === "application/postscript" || t.includes("illustrator") || t.includes("eps")) {
    return true;
  }
  const n = file.name.toLowerCase();
  return /\.(pdf|ai|eps)$/i.test(n);
}

function logoAttachmentsFlushReducer(prev: LogoAttachmentRow[]): LogoAttachmentRow[] {
  for (const r of prev) {
    if (r.previewUrl) {
      URL.revokeObjectURL(r.previewUrl);
    }
  }
  return [];
}

export type PlacementData = {
  id: string;
  name: string;
};

export type ProductDetailData = {
  id: string;
  name: string;
  category: string;
  /** Store / URL slug when present (e.g. syzmik in sku slug). */
  slug?: string | null;
  /** `products.supplier_name` — shown on Admin → Supplier orders. */
  supplierName?: string;
  description: string;
  basePrice: number;
  originalPrice?: number;
  imageUrls: string[];
  colorOptions: string[];
  sizeOptions: string[];
  /** From `data/product-google-ratings.json` or Google Places (store listing). */
  googleRating?: ProductGoogleRating;
  /** `products.features` — bullet-style selling points (plain text). */
  features?: string;
  /** `products.specifications` — fabric, sizing detail, etc. (plain text). */
  specifications?: string;
};

export type PremiumWorkPoloClientProps = {
  product: ProductDetailData;
  placements: PlacementData[];
};

function parseCartServiceFlags(serviceType: string): { emb: boolean; prn: boolean } {
  const s = serviceType.trim();
  if (s === "Plain" || s.length === 0) {
    return { emb: false, prn: false };
  }
  return {
    emb: s.includes("Embroidery"),
    prn: s.includes("Printing"),
  };
}

/** Full Back (FB) and Full Chest (FC): printing only — no embroidery option on the PDP. */
function isEmbroideryOfferedForPlacement(diagramAbbr: string): boolean {
  const a = diagramAbbr.trim().toUpperCase();
  return a !== "FB" && a !== "FC";
}

function placementAssignmentsFromCartLines(
  placementLines: string[],
  options: { id: string; label: string; diagramAbbr: string }[],
): Record<string, DecoratedServiceType | null> {
  const out: Record<string, DecoratedServiceType | null> = {};
  for (const raw of placementLines) {
    const m = raw.match(/^(Embroidery|Printing):\s*(.+)$/);
    if (!m) {
      continue;
    }
    const svc = m[1] as DecoratedServiceType;
    const label = m[2].trim();
    const opt = options.find((o) => o.label === label);
    if (opt && (svc === "Embroidery" || svc === "Printing")) {
      if (svc === "Embroidery" && !isEmbroideryOfferedForPlacement(opt.diagramAbbr)) {
        continue;
      }
      out[opt.id] = svc;
    }
  }
  return out;
}

const servicePricing: Record<ServiceType, number> = {
  Plain: 0,
  Embroidery: 0,
  Printing: 0,
};

/** Embroidery add-ons by placement (supplier-style codes: LC, RC, CC, BU, BM, FB, FC, LS, RS). */
const defaultEmbroideryPlacementPricing: Record<string, number> = {
  "left chest": 9.95,
  "left-hand chest": 9.95,
  "right chest": 7.95,
  "center chest": 24.95,
  "full back": 18,
  "front full": 18,
  "front bottom": 18,
  "full chest": 18,
  "front collar": 18,
  "back upper": 7.95,
  "back middle": 24.95,
  "left sleeve": 8.95,
  "right sleeve": 8.95,
};

/** Per-placement add-on when Printing is chosen (LC, RC, CC, BU, BM, FB, FC, LS, RS). */
const defaultPrintingPlacementPricing: Record<string, number> = {
  "left chest": 8.95,
  "left-hand chest": 8.95,
  "right chest": 6.95,
  "center chest": 14.95,
  "full back": 17.95,
  "front full": 17.95,
  "front bottom": 18,
  "full chest": 17.95,
  "front collar": 18,
  "back upper": 7.95,
  "back middle": 14.95,
  "left sleeve": 7.95,
  "right sleeve": 7.95,
};

const PLACEMENT_FALLBACK_EMBROIDERY = 2.0;
const PLACEMENT_FALLBACK_PRINTING = 1.5;

function toCurrency(amount: number) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function toCurrencyExact(amount: number) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function cents(n: number) {
  return Math.round((Number.isFinite(n) ? n : 0) * 100);
}

/** Matches supplier filenames like `…_Product_MidBlue_01.jpg` (see sync-supplier-catalog). */
function humanizeColorInFilename(raw: string) {
  return raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
}

function compactColorKey(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Single URL vs colour — same rules as gallery hero pick (for reverse lookup from thumbnails). */
function scoreGalleryUrlForColor(color: string, url: string): number {
  const trimmed = color.trim();
  if (!trimmed) {
    return 0;
  }
  const colorCompact = compactColorKey(trimmed);
  const colorLower = trimmed.toLowerCase();
  const colorWords = colorLower.split(/\s+/).filter((w) => w.length > 1);

  const file = decodeURIComponent(url.split("/").pop() ?? url);
  const pathLower = url.toLowerCase();
  let score = 0;

  const shotMatch = file.match(/_(?:Product|Talent)_([A-Za-z0-9_-]+)_/i);
  if (shotMatch) {
    const fromFile = humanizeColorInFilename(shotMatch[1]);
    const fileCompact = compactColorKey(fromFile);
    if (fromFile.toLowerCase() === colorLower) {
      score += 120;
    } else if (fileCompact === colorCompact) {
      score += 120;
    } else if (fileCompact.includes(colorCompact) || colorCompact.includes(fileCompact)) {
      score += 70;
    } else {
      for (const w of colorWords) {
        if (w.length > 2 && fileCompact.includes(w)) {
          score += 25;
        }
      }
    }
    if (/Product/i.test(file)) {
      score += 45;
    } else if (/Talent/i.test(file)) {
      score -= 35;
    }
  }

  if (!shotMatch) {
    for (const w of colorWords) {
      if (pathLower.includes(w)) {
        score += 15;
      }
    }
    if (colorCompact.length >= 3 && compactColorKey(file).includes(colorCompact)) {
      score += 40;
    }
  }

  if (/[_-]0?1\.(jpg|jpeg|png|webp)/i.test(file)) {
    score += 4;
  }

  return score;
}

/**
 * Pick the hero image for a colour from gallery URLs (`_Product_` / `_Talent_` tokens).
 * Prefers flat `_Product_` shots so the colour swatch matches the garment, not on-model `_Talent_` marketing.
 * JB's Wear: when `import-jbswear-xlsx` tagged the gallery with `#jbpc=N`, use index order (see `parseJbGalleryUrls`).
 */
function pickPrimaryImageForColor(color: string, urls: string[], opts?: GalleryColorPickOpts): string {
  if (!urls.length) {
    return "";
  }
  const trimmed = color.trim();
  if (!trimmed) {
    return urls[0];
  }

  const pc = opts?.jbPrefixCount ?? 0;
  const colOpts = opts?.colorOptions;
  if (
    opts?.isJbWear &&
    pc > 0 &&
    colOpts &&
    pc === colOpts.length &&
    urls.length >= pc
  ) {
    const i = colOpts.indexOf(color);
    if (i >= 0 && i < pc) {
      return urls[i] ?? urls[0];
    }
  }

  const scored = urls.map((url) => ({
    url,
    score: scoreGalleryUrlForColor(trimmed, url),
  }));

  scored.sort((a, b) => b.score - a.score);
  if (scored[0].score > 0) {
    return scored[0].url;
  }
  return urls[0];
}

function extractColorTokenFromGalleryFilename(fileNoQuery: string): string | null {
  const shot = fileNoQuery.match(/_(?:Product|Talent)_([A-Za-z0-9_-]+)_/i);
  if (shot?.[1]) {
    return shot[1];
  }
  const generic = fileNoQuery.match(/^[A-Za-z0-9]+_([A-Za-z0-9_-]+)_(?:\d{1,3})\.[A-Za-z0-9]+$/i);
  if (generic?.[1]) {
    return generic[1];
  }
  const tail = fileNoQuery.match(/_([A-Za-z0-9_-]+)_(?:\d{1,3})\.[A-Za-z0-9]+$/i);
  if (tail?.[1]) {
    return tail[1];
  }
  return null;
}

/** Score how well a storefront colour label matches a supplier filename colour token. */
function scoreColorLabelAgainstFileToken(colorLabel: string, tokenRaw: string): number {
  const fromFile = humanizeColorInFilename(tokenRaw);
  const fileCompact = compactColorKey(fromFile);
  const labelCompact = compactColorKey(colorLabel);
  if (!fileCompact || !labelCompact) {
    return 0;
  }
  if (labelCompact === fileCompact) {
    return 100;
  }
  if (fileCompact.includes(labelCompact) || labelCompact.includes(fileCompact)) {
    return 80;
  }
  let s = 0;
  const labelWords = colorLabel
    .toLowerCase()
    .split(/[\s/]+/)
    .map((w) => w.replace(/[^a-z0-9]+/g, ""))
    .filter((w) => w.length > 1);
  for (const w of labelWords) {
    if (fileCompact.includes(w)) {
      s += 35;
    }
  }
  const fileWords = fromFile
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]+/g, ""))
    .filter((w) => w.length > 1);
  for (const w of fileWords) {
    if (labelCompact.includes(w)) {
      s += 30;
    }
  }
  return s;
}

/**
 * Which catalogue colour best matches this gallery URL (thumbnail / hero → 1. Colour).
 * Uses URL scoring, then canonical primary URL per colour, then raw filename token vs labels.
 */
function inferBestColorForGalleryImage(
  imageUrl: string,
  colors: readonly string[],
  galleryUrls: readonly string[],
  pickOpts?: GalleryColorPickOpts,
): string | null {
  if (colors.length === 0) {
    return null;
  }
  if (colors.length === 1) {
    return colors[0];
  }

  const pc = pickOpts?.jbPrefixCount ?? 0;
  if (
    pickOpts?.isJbWear &&
    pc > 0 &&
    pc === colors.length &&
    galleryUrls.length >= pc
  ) {
    const idx = galleryUrls.indexOf(imageUrl);
    if (idx >= 0 && idx < pc) {
      return colors[idx] ?? null;
    }
  }

  let best: { color: string; score: number } | null = null;
  for (const c of colors) {
    const s = scoreGalleryUrlForColor(c, imageUrl);
    if (best == null || s > best.score) {
      best = { color: c, score: s };
    }
  }
  if (best && best.score > 0) {
    return best.color;
  }

  const urls = [...galleryUrls];
  for (const c of colors) {
    if (pickPrimaryImageForColor(c, urls, pickOpts) === imageUrl) {
      return c;
    }
  }

  const file = decodeURIComponent(imageUrl.split("/").pop() ?? imageUrl);
  const fileNoQuery = (file.split("?")[0] ?? file).trim();
  const token = extractColorTokenFromGalleryFilename(fileNoQuery);
  if (token) {
    let tokenBest: { color: string; score: number } | null = null;
    for (const c of colors) {
      const s = scoreColorLabelAgainstFileToken(c, token);
      if (tokenBest == null || s > tokenBest.score) {
        tokenBest = { color: c, score: s };
      }
    }
    if (tokenBest && tokenBest.score >= 30) {
      return tokenBest.color;
    }
  }

  return null;
}

function toShortCode(label: string) {
  const words = label
    .split(/[\s/|]+/)
    .map((w) => w.trim())
    .filter(Boolean);
  if (!words.length) {
    return "OP";
  }
  return words
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const PLACEHOLDER_GALLERY_IMAGE =
  "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1600&q=80";

/** Fragment on first gallery URL from `import-jbswear-xlsx.mjs` when every colour has an XLSX hero image. */
const JB_GALLERY_PREFIX_HASH_RE = /#jbpc=(\d+)$/i;

export type GalleryColorPickOpts = {
  colorOptions?: readonly string[];
  /** From `#jbpc=N` after stripping; N === colorOptions.length means first N images align with colour order. */
  jbPrefixCount?: number;
  isJbWear?: boolean;
};

function parseJbGalleryUrls(raw: readonly string[]): { urls: string[]; prefixCount: number } {
  if (!raw.length) {
    return { urls: [], prefixCount: 0 };
  }
  let prefixCount = 0;
  const urls = raw.map((u) => {
    const m = JB_GALLERY_PREFIX_HASH_RE.exec(u);
    if (m) {
      const n = parseInt(m[1] ?? "", 10);
      if (Number.isFinite(n) && n > 0) {
        prefixCount = n;
      }
      return u.slice(0, m.index);
    }
    return u;
  });
  return { urls, prefixCount };
}

function isJbWearStorefrontProduct(slug: string | null | undefined, supplierName: string | undefined): boolean {
  const s = (slug ?? "").trim().toLowerCase();
  if (s.startsWith("jb-")) {
    return true;
  }
  const sup = (supplierName ?? "").trim().toLowerCase();
  return (
    sup === "jb's wear" ||
    sup === "jbs wear" ||
    sup === "jbswear" ||
    /\bjbs\s*wear\b/i.test(supplierName ?? "")
  );
}

function galleryForUrls(urls: string[]) {
  return urls.length > 0 ? urls : [PLACEHOLDER_GALLERY_IMAGE];
}

function emptySizeQuantities(sizes: string[]): Record<string, number> {
  return Object.fromEntries(sizes.map((s) => [s, 0]));
}

function emptyColorSizeQuantities(colors: string[], sizes: string[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const c of colors) {
    out[c] = emptySizeQuantities(sizes);
  }
  return out;
}

function readBrowserCookie(name: string): string {
  if (typeof document === "undefined") {
    return "";
  }
  const key = `${name}=`;
  const found = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(key));
  return found ? decodeURIComponent(found.slice(key.length)) : "";
}

function ProductGoogleRatingRow({ info }: { info: ProductGoogleRating }) {
  const link = info.url;
  const isStoreWide = info.scope === "business";
  return (
    <div className="space-y-0.5">
      <p className="product-detail-google-rating text-[1.2rem] font-light leading-snug text-brand-navy/85">
        <span className="font-medium tabular-nums text-brand-orange">{info.rating.toFixed(1)}</span>
        <span className="text-brand-orange" aria-hidden>
          {" "}
          ★
        </span>
        <span className="text-brand-navy/50"> · </span>
        <span className="tabular-nums">{info.userRatingsTotal.toLocaleString("en-US")} reviews</span>
        <span className="text-brand-navy/45"> · </span>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-brand-navy underline decoration-brand-orange/50 underline-offset-2 hover:text-brand-orange"
          >
            Google
          </a>
        ) : (
          <span className="text-brand-navy/50">Google</span>
        )}
      </p>
      {isStoreWide ? (
        <p className="text-[1.02rem] font-light text-brand-navy/55">
          Based on Google reviews for our store (all products share this score).
        </p>
      ) : null}
    </div>
  );
}

function downloadSizeGuideText(
  filenameBase: string,
  bundle: SizeGuideBundle,
  externalLinks: SupplierSizeChartLink[],
) {
  const body = sizeGuideToPlainText(bundle);
  const text = appendSupplierLinksToPlainText(body, externalLinks);
  const safe = filenameBase.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "product";
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `size-guide-${safe}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function SizeGuideDialog({
  open,
  onClose,
  bundle,
  downloadSlug,
  externalLinks,
}: {
  open: boolean;
  onClose: () => void;
  bundle: SizeGuideBundle;
  downloadSlug: string;
  externalLinks: SupplierSizeChartLink[];
}) {
  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close size guide"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="size-guide-title"
        className="relative z-10 flex max-h-[min(85vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-brand-navy/15 bg-white shadow-2xl sm:m-4 sm:rounded-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-brand-navy/10 px-4 py-3 sm:px-5 sm:py-4">
          <h2 id="size-guide-title" className="text-[1.62rem] font-medium text-brand-navy">
            {bundle.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-[1.26rem] font-semibold text-brand-navy/70 hover:bg-brand-surface hover:text-brand-navy"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5 sm:py-4">
          <p className="whitespace-pre-wrap text-[1.26rem] leading-relaxed text-brand-navy/80">{bundle.intro}</p>
          {externalLinks.length > 0 ? (
            <div className="mt-4 rounded-xl border border-brand-orange/30 bg-brand-orange/10 px-3 py-3 sm:px-4">
              <p className="mb-2 text-[1.08rem] font-medium uppercase tracking-[0.08em] text-brand-navy/65">
                Official supplier size charts
              </p>
              <ul className="space-y-2">
                {externalLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[1.26rem] font-semibold text-brand-navy underline decoration-brand-orange/70 underline-offset-2 hover:text-brand-orange"
                    >
                      {link.label}
                      <span className="ml-1 text-[1.08rem] font-normal text-brand-navy/55">(opens new tab)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="mt-4 space-y-5">
            {bundle.tables.map((t) => (
              <div key={t.caption}>
                <p className="mb-2 text-[1.08rem] font-medium uppercase tracking-[0.08em] text-brand-navy/60">
                  {t.caption}
                </p>
                <div className="overflow-x-auto rounded-xl border border-brand-navy/10">
                  <table className="w-full min-w-[280px] text-left text-[1.26rem] text-brand-navy">
                    <thead>
                      <tr className="border-b border-brand-navy/10 bg-brand-surface/80">
                        {t.headers.map((h) => (
                          <th key={h} className="px-3 py-2 font-light">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {t.rows.map((row, ri) => (
                        <tr key={`${t.caption}-r-${ri}`} className="border-b border-brand-navy/5 last:border-b-0">
                          {row.map((cell, ci) => (
                            <td key={`${t.caption}-r-${ri}-c-${ci}`} className="px-3 py-2 font-light text-brand-navy/85">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 border-t border-brand-navy/10 px-4 py-3 sm:px-5 sm:py-4">
          <button
            type="button"
            onClick={() => downloadSizeGuideText(downloadSlug, bundle, externalLinks)}
            className="rounded-xl bg-brand-orange px-4 py-2.5 text-[1.26rem] font-medium text-brand-navy transition hover:brightness-95"
          >
            Download as .txt
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-brand-navy/20 px-4 py-2.5 text-[1.26rem] font-semibold text-brand-navy hover:bg-brand-surface"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function HeroImageLightbox({
  open,
  onClose,
  src,
  alt,
}: {
  open: boolean;
  onClose: () => void;
  src: string;
  alt: string;
}) {
  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !src) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Full size product image"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label="Close enlarged image"
        onClick={onClose}
      />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-20 rounded-lg bg-white px-3 py-2 text-[1.08rem] font-semibold text-brand-navy shadow-lg hover:bg-brand-surface sm:right-6 sm:top-6"
      >
        Close
      </button>
      <div className="relative z-10 max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-auto">
        <img
          src={src}
          alt={alt}
          className="block h-auto w-auto max-h-none max-w-none cursor-zoom-out"
          loading="eager"
          decoding="async"
          onClick={onClose}
        />
      </div>
    </div>
  );
}

export function PremiumWorkPoloClient({ product, placements }: PremiumWorkPoloClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const { productName, productCode } = useMemo(
    () =>
      productCardDisplayLines(
        product.name,
        product.description,
        product.slug,
        product.supplierName ?? null,
        product.colorOptions,
        undefined,
        product.sizeOptions,
      ),
    [
      product.colorOptions,
      product.description,
      product.name,
      product.sizeOptions,
      product.slug,
      product.supplierName,
    ],
  );
  const brandAndModelLine = useMemo(() => {
    const fromName = storefrontLeadingSupplierBrand(product.name);
    const fromSupplierName = product.supplierName?.trim() ? product.supplierName.trim() : null;
    const slug = (product.slug ?? "").trim().toLowerCase();
    const inferredFromSlug =
      slug.startsWith("fb-syzmik-") || slug.includes("syzmik")
        ? "Syzmik"
        : slug.startsWith("bis-") || slug.includes("bisley")
          ? "Bisley"
          : slug.startsWith("jb-") || slug.includes("jbswear")
            ? "JB's Wear"
            : null;
    const brand = fromName ?? fromSupplierName ?? inferredFromSlug;
    return brand ? `${brand} / ${productCode}` : productCode;
  }, [product.name, product.supplierName, productCode]);
  const displayDescription = useMemo(
    () => productDetailDescriptionBody(product.description, productName),
    [product.description, productName],
  );
  const cartLabel = productName ? `${productName} (${productCode})` : productCode;
  const heroAlt = cartLabel;

  const galleryParsed = useMemo(() => parseJbGalleryUrls(product.imageUrls), [product.imageUrls]);

  const galleryImages = useMemo(
    () => galleryForUrls(galleryParsed.urls),
    [galleryParsed.urls],
  );

  const galleryPickOpts = useMemo((): GalleryColorPickOpts => {
    const isJb = isJbWearStorefrontProduct(product.slug, product.supplierName);
    return {
      colorOptions: product.colorOptions,
      jbPrefixCount: galleryParsed.prefixCount,
      isJbWear: isJb,
    };
  }, [galleryParsed.prefixCount, product.colorOptions, product.slug, product.supplierName]);

  const ppePlainOnly = useMemo(
    () =>
      isPpeStorefrontProduct(
        product.name,
        product.category,
        product.slug ?? null,
        product.description,
      ),
    [product.category, product.description, product.name, product.slug],
  );

  const placementOptions: PlacementOption[] = useMemo(
    () =>
      placements.map((item) => {
        const nameForCodes = item.name.replace(/\s+/g, " ").trim();
        const normalizedName = nameForCodes.toLowerCase();
        const diagramAbbr =
          normalizedName === "right chest"
            ? "RC"
            : normalizedName === "full back" ||
                normalizedName === "front full" ||
                normalizedName === "front bottom"
              ? "FB"
              : toShortCode(nameForCodes);
        const short =
          normalizedName === "right chest"
            ? "RC for Names"
            : normalizedName === "full back" ||
                normalizedName === "front full" ||
                normalizedName === "front bottom"
              ? "FB"
              : toShortCode(nameForCodes);
        return {
          id: item.id,
          label: nameForCodes,
          short,
          diagramAbbr,
          embroideryCost:
            defaultEmbroideryPlacementPricing[normalizedName] ?? PLACEMENT_FALLBACK_EMBROIDERY,
          printingCost: defaultPrintingPlacementPricing[normalizedName] ?? PLACEMENT_FALLBACK_PRINTING,
        };
      }),
    [placements]
  );

  useEffect(() => {
    setPlacementAssignments((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const [id, svc] of Object.entries(prev)) {
        if (svc !== "Embroidery") {
          continue;
        }
        const opt = placementOptions.find((o) => o.id === id);
        if (opt && !isEmbroideryOfferedForPlacement(opt.diagramAbbr)) {
          next[id] = null;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [placementOptions]);

  const [selectedServices, setSelectedServices] = useState<Record<DecoratedServiceType, boolean>>({
    Embroidery: false,
    Printing: false,
  });
  const [selectedColor, setSelectedColor] = useState<string>(product.colorOptions[0] ?? "");
  const [placementAssignments, setPlacementAssignments] = useState<
    Record<string, DecoratedServiceType | null>
  >({});
  const [colorSizeQuantities, setColorSizeQuantities] = useState<
    Record<string, Record<string, number>>
  >(() => emptyColorSizeQuantities(product.colorOptions, product.sizeOptions));
  const [activeImage, setActiveImage] = useState<string>(() => {
    const { urls, prefixCount } = parseJbGalleryUrls(product.imageUrls);
    const g = galleryForUrls(urls);
    return pickPrimaryImageForColor(product.colorOptions[0] ?? "", g, {
      colorOptions: product.colorOptions,
      jbPrefixCount: prefixCount,
      isJbWear: isJbWearStorefrontProduct(product.slug, product.supplierName),
    });
  });
  const [cartMessage, setCartMessage] = useState<string>("");
  const [cartSubmitBusy, setCartSubmitBusy] = useState(false);
  const [orderNotes, setOrderNotes] = useState<string>("");
  const [logoAttachments, setLogoAttachments] = useState<LogoAttachmentRow[]>([]);
  const [logoDropActive, setLogoDropActive] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoDragDepthRef = useRef(0);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [heroLightboxOpen, setHeroLightboxOpen] = useState(false);
  /** Set when opening this product via Cart → Edit; primary button updates that line instead of adding. */
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const prevProductIdRef = useRef(product.id);
  const galleryImagesRef = useRef(galleryImages);
  const galleryPickOptsRef = useRef(galleryPickOpts);
  galleryImagesRef.current = galleryImages;
  galleryPickOptsRef.current = galleryPickOpts;

  function appendLogoFiles(fileList: FileList | File[] | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }
    const incoming = Array.from(fileList as FileList);
    setLogoAttachments((prev) => {
      const next = [...prev];
      for (const file of incoming) {
        if (next.length >= MAX_LOGO_FILES) {
          break;
        }
        if (!isAllowedLogoFile(file) || file.size > MAX_LOGO_BYTES) {
          continue;
        }
        if (next.some((x) => x.file.name === file.name && x.file.size === file.size)) {
          continue;
        }
        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : "";
        next.push({ key: crypto.randomUUID(), file, previewUrl });
      }
      return next;
    });
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
  }

  const sizeGuideKind = useMemo(
    () => inferSizeGuideKind(product.sizeOptions, product.name),
    [product.name, product.sizeOptions],
  );
  const sizeGuideBundle = useMemo(
    () => getSizeGuideBundle(sizeGuideKind, product.name),
    [product.name, sizeGuideKind],
  );
  const colourCount = product.colorOptions.length;
  const manyColours = colourCount >= 10;

  const sizeGuideDownloadSlug = (product.slug?.trim() || productCode || product.id).replace(
    /[^a-z0-9-]+/gi,
    "",
  );
  const supplierSizeChartLinks = useMemo(
    () => resolveSupplierSizeChartLinks(product.name, product.slug ?? null),
    [product.name, product.slug],
  );

  /** When the image set changes, re-pick hero for the current colour (colour chip / thumbnails set hero otherwise). */
  useEffect(() => {
    setActiveImage(pickPrimaryImageForColor(selectedColor, galleryImages, galleryPickOpts));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedColour updates hero in click handlers
  }, [galleryImages, galleryPickOpts]);

  useEffect(() => {
    if (prevProductIdRef.current !== product.id) {
      setEditingCartItemId(null);
      prevProductIdRef.current = product.id;
    }
  }, [product.id]);

  useEffect(() => {
    setColorSizeQuantities(emptyColorSizeQuantities(product.colorOptions, product.sizeOptions));
    setLogoAttachments(logoAttachmentsFlushReducer);
  }, [product.id]);

  /** Refs keep a fixed dependency list (avoids Fast Refresh errors if hook dep count changes across edits). */
  useEffect(() => {
    const cartEditId = searchParams.get("cartEdit")?.trim();
    if (!cartEditId) {
      return;
    }

    const line = getCartItems().find((row) => row.id === cartEditId);
    if (!line) {
      setCartMessage("Cart line not found. It may have been removed.");
      router.replace(pathname, { scroll: false });
      return;
    }
    if (line.productId !== product.id) {
      setCartMessage("This cart item is for a different product. Use Edit on the matching line in your cart.");
      router.replace(pathname, { scroll: false });
      return;
    }

    const { emb, prn } = parseCartServiceFlags(line.serviceType ?? "");
    setSelectedServices({ Embroidery: emb, Printing: prn });

    const color = (line.color ?? "").trim();
    const size = (line.size ?? "").trim();
    const nextColor = product.colorOptions.includes(color) ? color : (product.colorOptions[0] ?? "");
    setSelectedColor(nextColor);
    setActiveImage(
      pickPrimaryImageForColor(nextColor, galleryImagesRef.current, galleryPickOptsRef.current),
    );

    const q = Number(line.quantity);
    const next = emptyColorSizeQuantities(product.colorOptions, product.sizeOptions);
    if (
      product.colorOptions.includes(color) &&
      product.sizeOptions.includes(size) &&
      Number.isFinite(q) &&
      q > 0
    ) {
      next[color][size] = Math.min(999, Math.floor(q));
    }
    setColorSizeQuantities(next);

    setOrderNotes((line.notes ?? "").trim());
    setPlacementAssignments(placementAssignmentsFromCartLines(line.placements ?? [], placementOptions));

    setLogoAttachments(logoAttachmentsFlushReducer);
    setEditingCartItemId(cartEditId);
    setCartMessage("Selections loaded from your cart. Change as needed, then press Update to save.");

    router.replace(pathname, { scroll: false });
  }, [
    searchParams,
    product.id,
    product.colorOptions,
    product.sizeOptions,
    pathname,
    router,
    placementOptions,
  ]);

  const cartEditKey = searchParams.get("cartEdit")?.trim() ?? "";

  useEffect(() => {
    if (!ppePlainOnly) {
      return;
    }
    setSelectedServices({ Embroidery: false, Printing: false });
    setPlacementAssignments({});
    setOrderNotes("");
    setLogoAttachments(logoAttachmentsFlushReducer);
  }, [ppePlainOnly, product.id, cartEditKey]);

  const isEmbroiderySelected = selectedServices.Embroidery;
  const isPrintingSelected = selectedServices.Printing;
  const isPlainSelected = !isEmbroiderySelected && !isPrintingSelected;

  const perItemPrice = useMemo(() => {
    let placementCostCents = 0;
    for (const [placementId, service] of Object.entries(placementAssignments)) {
      if (service !== "Embroidery" && service !== "Printing") {
        continue;
      }
      const opt = placementOptions.find((o) => o.id === placementId);
      if (!opt) {
        continue;
      }
      if (service === "Embroidery" && !isEmbroideryOfferedForPlacement(opt.diagramAbbr)) {
        continue;
      }
      placementCostCents += cents(service === "Embroidery" ? opt.embroideryCost : opt.printingCost);
    }
    const perItemCents = cents(product.basePrice) + placementCostCents;
    return perItemCents / 100;
  }, [placementAssignments, placementOptions, product.basePrice]);

  const totalPieces = useMemo(() => {
    let sum = 0;
    for (const color of product.colorOptions) {
      const sq = colorSizeQuantities[color];
      if (!sq) {
        continue;
      }
      for (const size of product.sizeOptions) {
        sum += Math.max(0, Math.floor(sq[size] ?? 0));
      }
    }
    return sum;
  }, [product.colorOptions, product.sizeOptions, colorSizeQuantities]);

  const totalPrice = useMemo(() => {
    const totalCents = cents(perItemPrice) * totalPieces;
    return totalCents / 100;
  }, [perItemPrice, totalPieces]);

  function assignPlacement(id: string, service: DecoratedServiceType) {
    if (ppePlainOnly) {
      return;
    }
    if (!selectedServices[service]) {
      return;
    }
    if (service === "Embroidery") {
      const opt = placementOptions.find((o) => o.id === id);
      if (opt && !isEmbroideryOfferedForPlacement(opt.diagramAbbr)) {
        return;
      }
    }

    setPlacementAssignments((prev) => {
      const current = prev[id] ?? null;
      return {
        ...prev,
        [id]: current === service ? null : service,
      };
    });
  }

  function handleServiceChange(service: ServiceType) {
    if (ppePlainOnly && service !== "Plain") {
      return;
    }
    if (service === "Plain") {
      setSelectedServices({ Embroidery: false, Printing: false });
      setPlacementAssignments({});
      setOrderNotes("");
      return;
    }

    setSelectedServices((prev) => {
      const next = {
        ...prev,
        [service]: !prev[service],
      };

      if (!next[service]) {
        setPlacementAssignments((currentAssignments) => {
          const cleaned: Record<string, DecoratedServiceType | null> = {};
          Object.entries(currentAssignments).forEach(([placementId, assignedService]) => {
            cleaned[placementId] = assignedService === service ? null : assignedService;
          });
          return cleaned;
        });
      }

      return next;
    });
  }

  async function handleAddToCart() {
    if (cartSubmitBusy) {
      return;
    }

    const lines: { color: string; size: string; qty: number }[] = [];
    for (const color of product.colorOptions) {
      const sq = colorSizeQuantities[color] ?? emptySizeQuantities(product.sizeOptions);
      for (const size of product.sizeOptions) {
        const qty = Math.max(0, Math.min(999, Math.floor(sq[size] ?? 0)));
        if (qty > 0) {
          lines.push({ color, size, qty });
        }
      }
    }

    if (lines.length === 0) {
      setCartMessage("Set quantity for at least one size (per colour).");
      return;
    }

    if (logoAttachments.length > 0 && !readBrowserCookie("customer_email").trim()) {
      setCartMessage("Please sign in and save your email in account details to attach logo files.");
      return;
    }

    const placementLabels = placementOptions
      .map((item) => {
        const assignedService = placementAssignments[item.id];
        return assignedService ? `${assignedService}: ${item.label}` : null;
      })
      .filter((item): item is string => Boolean(item));

    const serviceLabel = isPlainSelected
      ? "Plain"
      : [isEmbroiderySelected ? "Embroidery" : "", isPrintingSelected ? "Printing" : ""]
          .filter(Boolean)
          .join(" + ");

    const trimmedNotes = orderNotes.trim();
    const logoExtra =
      logoAttachments.length > 0
        ? `\n\n[Logo files with this line: ${logoAttachments.map((a) => `${a.file.name} (${Math.round(a.file.size / 1024)} KB)`).join(", ")}]`
        : "";
    const notesForCart = (trimmedNotes + logoExtra).trim().slice(0, 2000);
    const fallbackHero = galleryImages.find((u) => typeof u === "string" && u.trim().length > 0)?.trim();

    setCartSubmitBusy(true);
    try {
      let sharedRefUrls: string[] | undefined;
      if (logoAttachments.length > 0) {
        const fd = new FormData();
        for (const a of logoAttachments) {
          fd.append("files", a.file);
        }
        const up = await uploadStoreCheckoutReferenceImages(fd);
        if (!up.ok) {
          setCartMessage(up.error);
          return;
        }
        sharedRefUrls = up.urls;
      } else if (editingCartItemId) {
        const existing = getCartItems().find((row) => row.id === editingCartItemId);
        if (existing?.referenceImageUrls?.length) {
          sharedRefUrls = [...existing.referenceImageUrls];
        }
      }

      function linePayload(lineColor: string, size: string, qty: number): Omit<CartItem, "id" | "addedAt"> {
        const colorHero = pickPrimaryImageForColor(lineColor, galleryImages, galleryPickOpts)?.trim();
        const heroImage = colorHero || fallbackHero;
        const lineTotal = Math.round(perItemPrice * qty * 100) / 100;
        return {
          productId: product.id,
          supplierName: product.supplierName?.trim() || undefined,
          productPathSlug: productPathSegment({ name: product.name, slug: product.slug ?? null }),
          imageUrl: heroImage,
          productName: cartLabel,
          serviceType: serviceLabel,
          color: lineColor,
          size,
          quantity: qty,
          placements: placementLabels,
          unitPrice: perItemPrice,
          totalPrice: lineTotal,
          notes: notesForCart.length > 0 ? notesForCart : undefined,
          ...(sharedRefUrls && sharedRefUrls.length > 0 ? { referenceImageUrls: sharedRefUrls } : {}),
        };
      }

      if (editingCartItemId) {
        if (lines.length === 1) {
          const { color: lineColor, size, qty } = lines[0];
          const ok = updateCartItem(editingCartItemId, linePayload(lineColor, size, qty));
          if (ok) {
            setEditingCartItemId(null);
            setColorSizeQuantities(emptyColorSizeQuantities(product.colorOptions, product.sizeOptions));
            setOrderNotes("");
            setLogoAttachments(logoAttachmentsFlushReducer);
            setCartMessage("Cart updated.");
            return;
          }
          setEditingCartItemId(null);
          setCartMessage(
            "That line is no longer in your cart. Adjust selections and tap Add to cart if you want a new line.",
          );
          return;
        }

        removeCartItem(editingCartItemId);
        setEditingCartItemId(null);
        for (const { color: lineColor, size, qty } of lines) {
          addCartItem(linePayload(lineColor, size, qty));
        }
        setColorSizeQuantities(emptyColorSizeQuantities(product.colorOptions, product.sizeOptions));
        setOrderNotes("");
        setLogoAttachments(logoAttachmentsFlushReducer);
        setCartMessage(`Cart updated: ${lines.length} lines added (sizes / colours).`);
        return;
      }

      for (const { color: lineColor, size, qty } of lines) {
        addCartItem(linePayload(lineColor, size, qty));
      }

      setColorSizeQuantities(emptyColorSizeQuantities(product.colorOptions, product.sizeOptions));
      setOrderNotes("");
      setLogoAttachments(logoAttachmentsFlushReducer);
      setCartMessage(lines.length > 1 ? `Added ${lines.length} lines to your cart.` : "Added to cart.");
    } finally {
      setCartSubmitBusy(false);
    }
  }

  function removeLogoAttachment(key: string) {
    setLogoAttachments((prev) => {
      const row = prev.find((r) => r.key === key);
      if (row?.previewUrl) {
        URL.revokeObjectURL(row.previewUrl);
      }
      return prev.filter((r) => r.key !== key);
    });
  }

  function onLogoZoneDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    logoDragDepthRef.current += 1;
    setLogoDropActive(true);
  }

  function onLogoZoneDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    logoDragDepthRef.current -= 1;
    if (logoDragDepthRef.current <= 0) {
      logoDragDepthRef.current = 0;
      setLogoDropActive(false);
    }
  }

  function onLogoZoneDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }

  function onLogoZoneDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    logoDragDepthRef.current = 0;
    setLogoDropActive(false);
    appendLogoFiles(e.dataTransfer.files);
  }

  useEffect(() => {
        syncSidebarNavFromProductIfNeeded(
          product.name,
          product.category,
          product.slug,
          product.supplierName?.trim() ?? null,
          product.description,
        );
  }, [product.category, product.description, product.name, product.slug, product.supplierName]);

  const showDecoratedServiceFlow =
    !ppePlainOnly && (isEmbroiderySelected || isPrintingSelected);

  const renderRealtimeTotalPricePanel = (useStickyOnLargeScreens: boolean) => (
    <div
      className={`rounded-2xl border border-brand-navy/15 bg-brand-navy p-4 text-white sm:p-5${useStickyOnLargeScreens ? " lg:sticky lg:bottom-4" : ""}`}
    >
      <h2 className="inline-flex items-center gap-2 text-[1.26rem] font-medium uppercase tracking-[0.1em] text-slate-200">
        <CalculatorIcon className="h-4 w-4" />
        Real-time Total Price
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <p className="mb-1 text-[1.08rem] font-semibold text-slate-300">Total pieces</p>
          <p className="text-[1.44rem] font-light tabular-nums text-white">{totalPieces}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="product-detail-per-item text-[1.26rem] font-light text-slate-300">
            Per item: {toCurrency(perItemPrice)}
          </p>
          <p className="product-detail-total mt-1 inline-block text-[2.7rem] font-light text-brand-orange tabular-nums">
            {toCurrency(totalPrice)}
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-2 rounded-xl border border-white/20 bg-white/5 px-3 py-3 text-[1.02rem] leading-snug text-slate-100 sm:text-[1.08rem]">
        <p className="font-semibold uppercase tracking-[0.08em] text-slate-300">Your selection</p>
        <p>
          <span className="text-slate-400">Product · </span>
          {cartLabel}
        </p>
        <div>
          <p className="text-slate-400">By colour &amp; size</p>
          {totalPieces > 0 ? (
            <ul className="mt-2 space-y-2 text-slate-100">
              {product.colorOptions.map((color) => {
                const sq = colorSizeQuantities[color] ?? emptySizeQuantities(product.sizeOptions);
                const sizesWithQty = product.sizeOptions.filter((s) => (sq[s] ?? 0) > 0);
                if (sizesWithQty.length === 0) {
                  return null;
                }
                return (
                  <li key={color}>
                    <span className="font-medium text-white">{color}</span>
                    <ul className="mt-0.5 list-inside list-disc space-y-0.5 pl-1 text-slate-200">
                      {sizesWithQty.map((s) => (
                        <li key={`${color}-${s}`} className="tabular-nums">
                          {s} × {sq[s]}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-1 text-slate-400">Enter a quantity for at least one size in any colour.</p>
          )}
        </div>
        <p className="border-t border-white/10 pt-2 text-slate-200 tabular-nums">
          <span className="text-slate-400">Total pieces · </span>
          {totalPieces}
        </p>
      </div>
      <p className="product-detail-volume-discount-rates mt-4 grid w-full grid-cols-1 gap-y-[0.66rem] text-[1.3464rem] font-light leading-snug text-slate-300/90 sm:grid-cols-2 sm:gap-x-[0.99rem] sm:gap-y-[0.66rem] lg:grid-cols-4 lg:gap-y-0 sm:text-[1.4256rem]">
        <span className="inline-flex min-w-0 w-full items-center gap-[0.495rem] sm:justify-center">
          <span className="h-[0.495rem] w-[0.495rem] shrink-0 rounded-full bg-slate-300" aria-hidden />
          <span className="min-w-0 whitespace-pre-wrap sm:text-center">Buy 10+  Get 2.5% Discount</span>
        </span>
        <span className="inline-flex min-w-0 w-full items-center gap-[0.495rem] sm:justify-center">
          <span className="h-[0.495rem] w-[0.495rem] shrink-0 rounded-full bg-slate-300" aria-hidden />
          <span className="min-w-0 whitespace-pre-wrap sm:text-center">Buy 20+  Get 5% Discount</span>
        </span>
        <span className="inline-flex min-w-0 w-full items-center gap-[0.495rem] sm:justify-center">
          <span className="h-[0.495rem] w-[0.495rem] shrink-0 rounded-full bg-slate-300" aria-hidden />
          <span className="min-w-0 whitespace-pre-wrap sm:text-center">Buy 50+  Get 7.5% Discount</span>
        </span>
        <span className="inline-flex min-w-0 w-full items-center gap-[0.495rem] sm:justify-center">
          <span className="h-[0.495rem] w-[0.495rem] shrink-0 rounded-full bg-slate-300" aria-hidden />
          <span className="min-w-0 whitespace-pre-wrap sm:text-center">Buy 100+  Get 10% Discount</span>
        </span>
      </p>
      <button
        type="button"
        disabled={cartSubmitBusy}
        onClick={() => void handleAddToCart()}
        className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-[1.26rem] font-medium text-white transition hover:border-brand-orange hover:text-brand-orange disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {cartSubmitBusy ? "Uploading…" : editingCartItemId ? "Update" : "Add to Cart"}
      </button>
      {cartMessage && <p className="mt-2 text-[1.08rem] text-slate-200">{cartMessage}</p>}
    </div>
  );

  return (
    <main className="product-detail-page min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <div className={STORE_MAIN_SHELL_CLASS}>
        <section className={`${SITE_PAGE_INSET_X_CLASS} pb-6 pt-6 sm:pb-10 sm:pt-10`}>
        <div className="mx-auto grid w-full max-w-none gap-8 lg:grid-cols-[1fr_1fr] lg:gap-10">
        <section className="space-y-3 sm:space-y-4">
          <button
            type="button"
            onClick={() => activeImage && setHeroLightboxOpen(true)}
            disabled={!activeImage}
            aria-label="View full size image"
            className="group mx-auto flex min-h-[384px] w-[64.8%] max-w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-3xl bg-white text-left transition hover:bg-brand-surface/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[504px] lg:min-h-[624px]"
          >
            <img
              src={activeImage}
              alt={heroAlt}
              className="pointer-events-none h-auto max-h-[384px] w-full max-w-full rounded-3xl object-contain object-center sm:max-h-[504px] lg:max-h-[624px]"
              loading="eager"
              decoding="async"
            />
          </button>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            {galleryImages.map((image, index) => {
              const isActive = activeImage === image;

              return (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => {
                    setActiveImage(image);
                    const inferred = inferBestColorForGalleryImage(
                      image,
                      product.colorOptions,
                      galleryImages,
                      galleryPickOpts,
                    );
                    if (inferred != null) {
                      setSelectedColor(inferred);
                    }
                  }}
                  aria-label={`${heroAlt} view ${index + 1}`}
                  className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white sm:h-24 sm:w-24 ${
                    isActive ? "border-brand-orange" : "border-brand-navy/15"
                  }`}
                >
                  <img
                    src={image}
                    alt=""
                    className="max-h-full w-full object-contain object-center"
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              );
            })}
          </div>
          {displayDescription ? (
            <div className="mt-4 w-full space-y-3 border-t border-brand-navy/10 pt-4 text-left text-[1.08rem] leading-[1.85rem] text-brand-navy/75 sm:mt-5 sm:pt-5 sm:text-[1.2rem] sm:leading-[2rem] lg:max-w-[36rem]">
              {displayDescription
                .split(/\n\s*\n/)
                .map((block) => block.trim())
                .filter(Boolean)
                .map((block, i) => (
                  <p key={i} className="whitespace-pre-line">
                    {block}
                  </p>
                ))}
            </div>
          ) : null}
          {product.features?.trim() ? (
            <div className="mt-4 w-full space-y-3 border-t border-brand-navy/10 pt-4 text-left lg:max-w-[36rem]">
              <h2 className="text-[1.02rem] font-semibold uppercase tracking-[0.1em] text-brand-navy/80">
                Features of product
              </h2>
              <div className="space-y-3 text-[1.02rem] leading-[1.75rem] text-brand-navy/75 sm:text-[1.14rem] sm:leading-[1.9rem]">
                {product.features
                  .trim()
                  .split(/\n\s*\n/)
                  .map((block) => block.trim())
                  .filter(Boolean)
                  .map((block, i) => (
                    <p key={i} className="whitespace-pre-line">
                      {block}
                    </p>
                  ))}
              </div>
            </div>
          ) : null}
          {product.specifications?.trim() ? (
            <div className="mt-4 w-full space-y-3 border-t border-brand-navy/10 pt-4 text-left lg:max-w-[36rem]">
              <h2 className="text-[1.02rem] font-semibold uppercase tracking-[0.1em] text-brand-navy/80">
                Product specifications
              </h2>
              <div className="space-y-3 text-[1.02rem] leading-[1.75rem] text-brand-navy/75 sm:text-[1.14rem] sm:leading-[1.9rem]">
                {product.specifications
                  .trim()
                  .split(/\n\s*\n/)
                  .map((block) => block.trim())
                  .filter(Boolean)
                  .map((block, i) => (
                    <p key={i} className="whitespace-pre-line">
                      {block}
                    </p>
                  ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-5 sm:space-y-6 lg:space-y-7">
          <header className="space-y-2">
            <p className="text-[1.08rem] font-semibold uppercase tracking-[0.12em] text-brand-navy/70">
              {product.category}
            </p>
            {productName ? (
              <>
                <h1 className="product-detail-title text-[3.3696rem] font-medium leading-tight text-brand-navy sm:text-[4.212rem]">
                  {productName}
                </h1>
                <p className="product-detail-sku text-[2.16rem] font-light text-black">
                  {brandAndModelLine}
                </p>
                {product.googleRating ? <ProductGoogleRatingRow info={product.googleRating} /> : null}
              </>
            ) : (
              <>
                <h1 className="product-detail-sku text-[2.16rem] font-light text-black">
                  {brandAndModelLine}
                </h1>
                {product.googleRating ? <ProductGoogleRatingRow info={product.googleRating} /> : null}
              </>
            )}
            <p className="product-detail-list-price w-full text-right text-[2.16rem] font-light text-black tabular-nums">
              {product.originalPrice != null ? (
                <>
                  <span className="product-detail-price-strike text-[1.44rem] font-light text-brand-navy/55 line-through mr-2">
                    {toCurrency(product.originalPrice)}
                  </span>
                  {toCurrency(product.basePrice)}
                </>
              ) : (
                toCurrency(product.basePrice)
              )}
            </p>
            <p className="text-right text-sm text-brand-navy/55">
              Includes {Math.round(STOREFRONT_RETAIL_GST_RATE * 100)}% GST.
            </p>
          </header>

          <div className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-[1.26rem] font-medium uppercase tracking-[0.1em] text-brand-navy/75">
                1. Colour
              </h2>
              {manyColours ? (
                <span className="text-[0.95rem] font-medium tabular-nums text-brand-navy/55">
                  {colourCount} colours
                </span>
              ) : null}
            </div>
            {manyColours ? (
              <p className="text-[1.02rem] leading-snug text-brand-navy/60">
                Many colours: scroll the grid below to see them all.
              </p>
            ) : null}
            <div
              className={
                manyColours
                  ? "max-h-[min(52vh,26rem)] overflow-y-auto overscroll-y-contain"
                  : ""
              }
            >
              <div
                className={
                  colourCount >= 12
                    ? "grid grid-cols-2 gap-1.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
                    : "grid grid-cols-2 gap-2 sm:grid-cols-3"
                }
              >
                {product.colorOptions.map((color) => {
                  const isActive = selectedColor === color;
                  return (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        setSelectedColor(color);
                        setActiveImage(pickPrimaryImageForColor(color, galleryImages, galleryPickOpts));
                      }}
                      title={color}
                      className={`min-h-[2.75rem] rounded-lg border px-2 py-2 text-left text-[1.02rem] font-semibold leading-snug transition sm:min-h-0 sm:px-2.5 sm:py-2 sm:text-[1.08rem] md:text-[1.05rem] ${
                        manyColours ? "line-clamp-2 sm:line-clamp-2" : ""
                      } ${
                        isActive
                          ? "border-brand-orange bg-brand-orange/15 text-brand-navy ring-1 ring-brand-orange/30"
                          : "border-brand-navy/20 bg-white text-brand-navy hover:border-brand-orange"
                      }`}
                    >
                      {color}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-[1.26rem] font-medium uppercase tracking-[0.1em] text-brand-navy/75">
              2. Size &amp; quantity
            </h2>
            <p className="text-[1.08rem] text-brand-navy/65">
              Quantities are saved per colour. Switch colour to enter a different breakdown — your other colours stay as
              you left them. Add to cart adds every colour and size with a quantity greater than zero.
            </p>
            <p className="text-[1.02rem] font-semibold text-brand-navy/80">
              Editing: <span className="text-brand-orange">{selectedColor || "—"}</span>
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {product.sizeOptions.map((size) => {
                const row =
                  colorSizeQuantities[selectedColor] ?? emptySizeQuantities(product.sizeOptions);
                const sizeQtyId = `size-qty-${compactColorKey(selectedColor)}-${compactColorKey(size)}`;
                return (
                <div
                  key={size}
                  className="flex flex-col gap-1.5 rounded-xl bg-white px-3 py-2.5"
                >
                  <span className="text-[1.26rem] font-semibold text-brand-navy">{size}</span>
                  <label htmlFor={sizeQtyId} className="sr-only">
                    Quantity for {selectedColor} size {size}
                  </label>
                  <input
                    id={sizeQtyId}
                    type="number"
                    min={0}
                    max={999}
                    inputMode="numeric"
                    value={row[size] ?? 0}
                    onChange={(e) => {
                      const v = Math.max(0, Math.min(999, Math.floor(Number(e.target.value) || 0)));
                      setColorSizeQuantities((prev) => {
                        const base = prev[selectedColor] ?? emptySizeQuantities(product.sizeOptions);
                        return {
                          ...prev,
                          [selectedColor]: { ...base, [size]: v },
                        };
                      });
                    }}
                    className="w-full rounded-lg border border-brand-navy/20 bg-brand-surface/40 px-2 py-1.5 text-[1.26rem] text-brand-navy tabular-nums focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
                  />
                </div>
                );
              })}
            </div>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setSizeGuideOpen(true)}
                className="text-[1.26rem] font-semibold text-brand-navy underline decoration-2 decoration-brand-orange/60 underline-offset-2 transition hover:text-brand-orange hover:decoration-brand-orange"
              >
                Size guide — measurements &amp; how to choose
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-[1.26rem] font-medium uppercase tracking-[0.1em] text-brand-navy/75">
              3. Service Type
            </h2>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {(Object.keys(servicePricing) as ServiceType[]).map((service) => {
                const disabled = ppePlainOnly && service !== "Plain";
                const isActive =
                  service === "Plain"
                    ? isPlainSelected
                    : service === "Embroidery"
                      ? isEmbroiderySelected
                      : isPrintingSelected;
                const label = service === "Printing" ? "Print" : service;
                const activeGlowClass =
                  service === "Printing"
                    ? "shadow-[0_10px_28px_-8px_rgba(59,130,246,0.38)]"
                    : service === "Embroidery"
                      ? "shadow-[0_10px_28px_-8px_rgba(255,133,27,0.38)]"
                      : "shadow-[0_10px_28px_-8px_rgba(0,31,63,0.3)]";
                const buttonArtSrc = isActive
                  ? SERVICE_TYPE_BUTTON_IMAGE_SELECTED[service]
                  : SERVICE_TYPE_BUTTON_IMAGE[service];
                return (
                  <button
                    key={service}
                    type="button"
                    disabled={disabled}
                    aria-label={label}
                    aria-pressed={isActive}
                    aria-disabled={disabled}
                    onClick={() => handleServiceChange(service)}
                    className={`relative mx-auto w-[40%] max-w-full overflow-hidden rounded-[2rem] border-0 bg-transparent p-0 transition-shadow duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange sm:rounded-[2.35rem] ${
                      disabled ? "cursor-not-allowed opacity-45 shadow-none" : "cursor-pointer hover:opacity-[0.97]"
                    } ${
                      disabled
                        ? ""
                        : isActive
                          ? activeGlowClass
                          : SERVICE_TYPE_BUTTON_SHADOW_IDLE[service]
                    } `}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- static assets in public/button */}
                    <img
                      src={buttonArtSrc}
                      alt=""
                      width={512}
                      height={512}
                      draggable={false}
                      className="pointer-events-none h-auto w-full select-none object-contain"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {!showDecoratedServiceFlow && renderRealtimeTotalPricePanel(true)}

          {showDecoratedServiceFlow && (
            <>
              <div className="space-y-3">
                <h2 className="text-[1.26rem] font-medium uppercase tracking-[0.1em] text-brand-navy/75">
                  4. Placement Selector
                </h2>
                <div className="grid gap-2 overflow-visible">
                  {placementOptions.map((option) => {
                    const assignedService = placementAssignments[option.id] ?? null;
                    const diagramSrc = placementLogoLocationSrc(option.id, option.label, {
                      diagramAbbr: option.diagramAbbr,
                    });
                    const rowSelectedClass =
                      assignedService === "Embroidery"
                        ? "bg-brand-orange/10"
                        : assignedService === "Printing"
                          ? "bg-blue-100"
                          : "";

                    return (
                      <div
                        key={`combined-${option.id}`}
                        className={`flex items-center justify-between overflow-visible rounded-xl px-3 py-3 transition sm:px-4 ${rowSelectedClass}`}
                      >
                        <div className="flex min-w-0 items-center gap-2 overflow-visible sm:gap-3">
                          {diagramSrc ? (
                            <span className="relative shrink-0 overflow-visible">
                              {/* eslint-disable-next-line @next/next/no-img-element -- small static public asset */}
                              <img
                                src={diagramSrc}
                                alt=""
                                className="relative z-0 h-14 w-14 origin-center rounded-lg border border-brand-navy/10 bg-white object-contain shadow-sm transition-[transform,box-shadow] duration-300 ease-out will-change-transform hover:z-[80] hover:scale-[3] hover:shadow-2xl hover:ring-2 hover:ring-brand-navy/20 sm:h-16 sm:w-16"
                              />
                            </span>
                          ) : (
                            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-navy text-white">
                              <PlacementIcon className="h-4 w-4" />
                            </span>
                          )}
                          <span className="min-w-0 text-[1.26rem] font-semibold">
                            {option.label} <span className="text-brand-navy/50">({option.short})</span>
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 sm:gap-x-3">
                          {isEmbroiderySelected &&
                            (isEmbroideryOfferedForPlacement(option.diagramAbbr) ? (
                              <button
                                type="button"
                                onClick={() => assignPlacement(option.id, "Embroidery")}
                                className={`rounded-md border px-2.5 py-1 text-[1.08rem] font-medium transition sm:px-3 sm:text-[1.26rem] ${
                                  assignedService === "Embroidery"
                                    ? "border-brand-orange bg-brand-orange text-brand-navy"
                                    : "border-brand-navy/20 bg-white text-brand-navy hover:border-brand-orange"
                                }`}
                              >
                                Emb +{toCurrencyExact(option.embroideryCost)}
                              </button>
                            ) : (
                              <span
                                className="inline-block min-w-[4.75rem] border-none bg-transparent p-0 text-center text-[1.08rem] font-medium tabular-nums text-brand-navy/40 shadow-none ring-0 sm:min-w-[5.5rem] sm:text-[1.26rem]"
                                aria-label="Embroidery not available for this placement"
                              >
                                -
                              </span>
                            ))}
                          {isPrintingSelected && (
                            <button
                              type="button"
                              onClick={() => assignPlacement(option.id, "Printing")}
                              className={`rounded-md border px-2.5 py-1 text-[1.08rem] font-medium transition sm:px-3 sm:text-[1.26rem] ${
                                assignedService === "Printing"
                                  ? "border-blue-600 bg-blue-500 text-white"
                                  : "border-brand-navy/20 bg-white text-brand-navy hover:border-blue-500 hover:text-blue-600"
                              }`}
                            >
                              Print +{toCurrencyExact(option.printingCost)}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-[1.26rem] font-medium uppercase tracking-[0.1em] text-brand-navy/75">
                  5. Logo Upload
                </h2>
                <label
                  htmlFor="logo-upload"
                  onDragEnter={onLogoZoneDragEnter}
                  onDragLeave={onLogoZoneDragLeave}
                  onDragOver={onLogoZoneDragOver}
                  onDrop={onLogoZoneDrop}
                  className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-brand-surface px-5 py-6 text-center transition sm:min-h-[150px] sm:px-6 sm:py-8 ${
                    logoDropActive
                      ? "border-brand-orange bg-brand-orange/5"
                      : "border-brand-navy/25 hover:border-brand-orange"
                  }`}
                >
                  <input
                    ref={logoInputRef}
                    id="logo-upload"
                    type="file"
                    className="sr-only"
                    multiple
                    accept="image/*,.pdf,.ai,application/pdf,application/postscript"
                    onChange={(e) => appendLogoFiles(e.target.files)}
                  />
                  <span className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-navy/10 text-brand-navy">
                    <UploadIcon />
                  </span>
                  <p className="text-[1.26rem] font-medium sm:text-[1.44rem]">Drag and drop logo files here</p>
                  <p className="mt-1 text-[1.08rem] text-brand-navy/70 sm:text-[1.26rem]">
                    or click to browse from your device
                  </p>
                  <p className="mt-3 text-[1.08rem] font-semibold tracking-wide text-brand-orange">
                    All image formats (JPEG, PNG, GIF, WebP, SVG, BMP, TIFF, HEIC/HEIF, and more) plus PDF and Adobe
                    Illustrator (AI)
                  </p>
                  <p className="mt-2 max-w-md text-[0.95rem] leading-snug text-brand-navy/55">
                    Up to {MAX_LOGO_FILES} files, {Math.round(MAX_LOGO_BYTES / (1024 * 1024))} MB each. Names are saved
                    on the cart line when you add to cart (binary files stay in this browser until checkout).
                  </p>
                </label>
                {logoAttachments.length > 0 ? (
                  <ul className="space-y-2 rounded-xl border border-brand-navy/10 bg-white p-3">
                    {logoAttachments.map((row) => (
                      <li
                        key={row.key}
                        className="flex items-center gap-3 rounded-lg border border-brand-navy/10 bg-brand-surface/60 px-2 py-2"
                      >
                        {row.previewUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={row.previewUrl}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-md border border-brand-navy/10 bg-white object-contain"
                          />
                        ) : (
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-brand-navy/15 bg-white text-[0.65rem] font-semibold uppercase text-brand-navy/70">
                            File
                          </span>
                        )}
                        <span className="min-w-0 flex-1 truncate text-[1.05rem] text-brand-navy">{row.file.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeLogoAttachment(row.key);
                          }}
                          className="shrink-0 rounded-md border border-brand-navy/20 px-2 py-1 text-[0.95rem] font-semibold text-brand-navy hover:border-brand-orange hover:text-brand-orange"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="space-y-3">
                <h2 className="text-[1.26rem] font-medium uppercase tracking-[0.1em] text-brand-navy/75">
                  6. NOTE
                </h2>
                <label htmlFor="order-notes" className="sr-only">
                  Order notes and requirements
                </label>
                <textarea
                  id="order-notes"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  maxLength={2000}
                  rows={5}
                  placeholder="Write any special requirements, logo colours, or other notes for this order."
                  className="w-full resize-y rounded-2xl border border-brand-navy/15 bg-white px-4 py-3 text-[1.26rem] text-brand-navy placeholder:text-brand-navy/45 focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
                />
                <p className="text-[1.08rem] text-brand-navy/55">
                  {orderNotes.length} / 2000 characters
                </p>
              </div>

              {renderRealtimeTotalPricePanel(false)}
            </>
          )}
        </section>
      </div>
        </section>
      </div>
      <SizeGuideDialog
        open={sizeGuideOpen}
        onClose={() => setSizeGuideOpen(false)}
        bundle={sizeGuideBundle}
        downloadSlug={sizeGuideDownloadSlug}
        externalLinks={supplierSizeChartLinks}
      />
      <HeroImageLightbox
        open={heroLightboxOpen}
        onClose={() => setHeroLightboxOpen(false)}
        src={activeImage}
        alt={heroAlt}
      />
    </main>
  );
}
