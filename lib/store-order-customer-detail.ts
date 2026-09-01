import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import {
  resolveStoreOrderPickUpByIds,
  storeOrderFulfillmentLabel,
  type StoreOrderFulfillmentMethod,
} from "@/lib/store-order-fulfillment";

/** Normalizes `store_order_items.placements` (jsonb array of strings). */
export function placementsFromDb(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((x): x is string => typeof x === "string");
}

/** Per-line placements from checkout (`store_order_items.placements`) for Logo & artwork. */
function formatLogoLocationsSummary(
  items: Array<{
    product_name: string;
    quantity: number;
    color: string | null;
    size: string | null;
    placements: unknown;
  }>,
): string {
  const blocks: string[] = [];
  for (const row of items) {
    const placements = placementsFromDb(row.placements)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!placements.length) continue;

    const name = (row.product_name ?? "").trim() || "Item";
    const color = (row.color ?? "").trim();
    const size = (row.size ?? "").trim();
    const qty = Math.max(0, row.quantity ?? 0);
    const variantParts = [color || null, size || null, qty > 0 ? `×${qty}` : null].filter(Boolean);
    const variant = variantParts.length ? ` — ${variantParts.join(" / ")}` : "";
    blocks.push(`${name}${variant}\n${placements.join("; ")}`);
  }
  return blocks.join("\n\n");
}

/**
 * Removes Supabase Storage public object URLs merged into checkout notes (logo / reference uploads).
 * Keeps the customer-written part; collapses extra blank lines left behind.
 */
export function stripUploadedAssetUrlsFromCheckoutNotes(text: string): string {
  const re = /https?:\/\/[^\s/]+\/storage\/v1\/object\/public\/[^\s<>"')]+/gi;
  return text
    .replace(re, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

/**
 * Drop the last non-empty line of checkout notes for Click Up Memo display
 * (auto-appended embroidery logo-setup tag, etc.).
 */
export function stripCheckoutMemoLastLine(notes: string): string {
  const body = notes.trim();
  if (!body) {
    return "";
  }
  const lines = body.split("\n");
  let lastIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if ((lines[i] ?? "").trim().length > 0) {
      lastIdx = i;
      break;
    }
  }
  if (lastIdx < 0) {
    return "";
  }
  lines.splice(lastIdx, 1);
  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Appends the line size onto the first memo line (usually `MODEL - Colour`) so Click Up sheet
 * Memo shows model / colour / size together. Skips when size is already present on that line.
 */
export function withCheckoutMemoSize(notes: string, size: string | null | undefined): string {
  const sizeTrim = (size ?? "").trim();
  const body = notes.trim();
  if (!sizeTrim || !body) {
    return body;
  }

  const lines = body.split("\n");
  const firstIdx = lines.findIndex((l) => l.trim().length > 0);
  if (firstIdx < 0) {
    return `Size: ${sizeTrim}\n${body}`;
  }

  const first = lines[firstIdx] ?? "";
  if (/\bsize\s*:/i.test(first)) {
    return body;
  }
  const escaped = sizeTrim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`(?:^|[\\s/—–-])${escaped}(?:\\s|$)`, "i").test(first)) {
    return body;
  }

  lines[firstIdx] = `${first} / ${sizeTrim}`;
  return lines.join("\n");
}

/**
 * Puts the order-line product name on the first line of Click Up Memo display.
 * Skips when the memo already starts with that name.
 */
export function withCheckoutMemoProductName(
  notes: string,
  productName: string | null | undefined,
): string {
  const name = (productName ?? "").trim();
  const body = notes.trim();
  if (!name) {
    return body;
  }
  if (!body) {
    return name;
  }
  const firstLine = body.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
  if (firstLine.toLowerCase() === name.toLowerCase()) {
    return body;
  }
  if (firstLine.toLowerCase().startsWith(name.toLowerCase())) {
    return body;
  }
  return `${name}\n${body}`;
}

const MEMO_PLACEMENT_CODES = [
  "LC",
  "RC",
  "CC",
  "BU",
  "BM",
  "FB",
  "FC",
  "LS",
  "RS",
  "HF",
  "HB",
  "AL",
  "AM",
  "SAM",
  "SAB",
] as const;

const MEMO_PLACEMENT_CODE_RE = new RegExp(
  `^(${MEMO_PLACEMENT_CODES.join("|")})\\b`,
  "i",
);

const PLACEMENT_LABEL_TO_MEMO_CODE: Record<string, string> = {
  "left chest": "LC",
  "left-hand chest": "LC",
  "right chest": "RC",
  "center chest": "CC",
  "back upper": "BU",
  "back middle": "BM",
  "full back": "FB",
  "front full": "FB",
  "front bottom": "FB",
  "full chest": "FC",
  "front collar": "FC",
  "left sleeve": "LS",
  "right sleeve": "RS",
  "head front": "HF",
  "head back": "HB",
  "apron left": "AL",
  "apron middle": "AM",
  "side apron middle": "SAM",
  "side apron bottom": "SAB",
};

export type CheckoutMemoDecorateService = "Embroidery" | "Printing";

export type CheckoutMemoPlacementService = {
  code: string;
  service: CheckoutMemoDecorateService;
};

/**
 * Style / model code from a cart product title, e.g. `JB's 350 Trade Hoodie (6CFH)` → `6CFH`.
 */
export function modelCodeFromProductName(productName: string | null | undefined): string | null {
  const m = String(productName ?? "").match(/\(([^)]+)\)\s*$/);
  const code = m?.[1]?.trim();
  return code || null;
}

/**
 * Ensure order-line colour sits after the model on the first notes line
 * (`TT04 - Yellow/Navy`), swapping `Colour - MODEL` when needed.
 * When notes start with placement lines only (LC/BU/…), prepend `MODEL - Colour`
 * (model from product title when available).
 */
export function withCheckoutMemoColorAfterModel(
  notes: string,
  color: string | null | undefined,
  productName?: string | null,
): string {
  const colorTrim = (color ?? "").trim();
  const body = notes.trim();
  if (!colorTrim) {
    return body;
  }
  if (!body) {
    const modelOnly = modelCodeFromProductName(productName);
    return modelOnly ? `${modelOnly} - ${colorTrim}` : colorTrim;
  }

  const lines = body.split("\n");
  const firstIdx = lines.findIndex((l) => l.trim().length > 0);
  if (firstIdx < 0) {
    const modelOnly = modelCodeFromProductName(productName);
    return modelOnly ? `${modelOnly} - ${colorTrim}` : colorTrim;
  }

  const first = (lines[firstIdx] ?? "").trim();
  if (checkoutMemoLinePlacementCode(first)) {
    const model = modelCodeFromProductName(productName);
    const head = model ? `${model} - ${colorTrim}` : colorTrim;
    return `${head}\n${body}`;
  }

  const escaped = colorTrim.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const colorFirst = first.match(new RegExp(`^${escaped}\\s*[-–—]\\s*(.+)$`, "i"));
  if (colorFirst?.[1]) {
    lines[firstIdx] = `${colorFirst[1].trim()} - ${colorTrim}`;
    return lines.join("\n");
  }
  if (new RegExp(`(?:^|[\\s/—–-])${escaped}(?:\\s|$)`, "i").test(first)) {
    return body;
  }
  if (first.toLowerCase() === colorTrim.toLowerCase()) {
    return body;
  }

  lines[firstIdx] = `${first} - ${colorTrim}`;
  return lines.join("\n");
}

/** One entry per distinct customer memo (`store_order_items.notes` trimmed) + size. */
export type StoreOrderCustomerMemoLine = {
  /** Customer notes body (no product name / size baked in; colour follows model on first line). */
  notes: string;
  productName: string | null;
  size: string | null;
  color: string | null;
  quantity: number;
  /** From checkout `placements` (`Embroidery: Left Chest`, …). */
  placementServices: CheckoutMemoPlacementService[];
  /** When the line has only one decorate service (not both). */
  lineService: CheckoutMemoDecorateService | null;
};

export function placementLabelToMemoCode(label: string): string | null {
  const spaced = label
    .trim()
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!spaced) {
    return null;
  }
  if (PLACEMENT_LABEL_TO_MEMO_CODE[spaced]) {
    return PLACEMENT_LABEL_TO_MEMO_CODE[spaced];
  }
  const upper = label.trim().toUpperCase();
  if ((MEMO_PLACEMENT_CODES as readonly string[]).includes(upper)) {
    return upper;
  }
  const words = label
    .split(/[\s/|]+/)
    .map((w) => w.trim())
    .filter(Boolean);
  if (words.length >= 2) {
    const code = words
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
    if ((MEMO_PLACEMENT_CODES as readonly string[]).includes(code)) {
      return code;
    }
  }
  return null;
}

export function resolveCheckoutMemoLineService(
  serviceType: string | null | undefined,
): CheckoutMemoDecorateService | null {
  const st = (serviceType ?? "").toLowerCase();
  const emb = st.includes("embroidery");
  const prn = st.includes("printing");
  if (emb && !prn) {
    return "Embroidery";
  }
  if (prn && !emb) {
    return "Printing";
  }
  return null;
}

/** Parse `Embroidery: Left Chest` / `Printing: Right Chest` placement strings. */
export function parseCheckoutMemoPlacementServices(
  placements: unknown,
): CheckoutMemoPlacementService[] {
  const out: CheckoutMemoPlacementService[] = [];
  const seen = new Set<string>();
  for (const raw of placementsFromDb(placements)) {
    const m = raw.trim().match(/^(Embroidery|Printing)\s*:\s*(.+)$/i);
    if (!m) {
      continue;
    }
    const service: CheckoutMemoDecorateService = /^embroidery$/i.test(m[1] ?? "")
      ? "Embroidery"
      : "Printing";
    const code = placementLabelToMemoCode(m[2] ?? "");
    if (!code || seen.has(code)) {
      continue;
    }
    seen.add(code);
    out.push({ code, service });
  }
  return out;
}

/** Leading placement short-code on a memo line (`LC - …`, `BU: …`). */
export function checkoutMemoLinePlacementCode(line: string): string | null {
  const m = line.trim().match(MEMO_PLACEMENT_CODE_RE);
  return m?.[1] ? m[1].toUpperCase() : null;
}

/**
 * Resolve Embroidery/Printing for each memo line.
 * Exact short-code match first; leftover logo lines get leftover checkout placements in order
 * (covers customer writing BU while checkout stored Back Middle / BM).
 */
export function checkoutMemoServicesForNotes(
  notes: string,
  placementServices: CheckoutMemoPlacementService[],
  lineService: CheckoutMemoDecorateService | null,
): Array<CheckoutMemoDecorateService | null> {
  const lines = String(notes ?? "").split("\n");
  const result: Array<CheckoutMemoDecorateService | null> = lines.map(() => null);
  const placementLineIndexes: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (checkoutMemoLinePlacementCode(lines[i] ?? "")) {
      placementLineIndexes.push(i);
    }
  }

  const usedPlacementIdx = new Set<number>();
  for (const lineIdx of placementLineIndexes) {
    const code = checkoutMemoLinePlacementCode(lines[lineIdx] ?? "");
    if (!code) {
      continue;
    }
    const pIdx = placementServices.findIndex(
      (p, i) => !usedPlacementIdx.has(i) && p.code.toUpperCase() === code,
    );
    if (pIdx >= 0) {
      usedPlacementIdx.add(pIdx);
      result[lineIdx] = placementServices[pIdx]?.service ?? null;
    }
  }

  const leftoverLines = placementLineIndexes.filter((i) => result[i] == null);
  const leftoverPlacements = placementServices.filter((_, i) => !usedPlacementIdx.has(i));
  for (let k = 0; k < leftoverLines.length; k++) {
    const lineIdx = leftoverLines[k]!;
    const leftover = leftoverPlacements[k];
    if (leftover) {
      result[lineIdx] = leftover.service;
    } else if (lineService) {
      result[lineIdx] = lineService;
    }
  }

  return result;
}

export function checkoutMemoServiceForLine(
  line: string,
  placementServices: CheckoutMemoPlacementService[],
  lineService: CheckoutMemoDecorateService | null,
): CheckoutMemoDecorateService | null {
  return checkoutMemoServicesForNotes(line, placementServices, lineService)[0] ?? null;
}

type CustomerProfileContactFields = {
  organisation: string | null;
  contact_number: string | null;
};

async function lookupCustomerProfileByEmail(
  supabase: SupabaseClient<Database>,
  emailRaw: string,
): Promise<CustomerProfileContactFields | null> {
  const emailLower = emailRaw.toLowerCase();
  const selectCols = "organisation, contact_number";

  const { data: profEq } = await supabase
    .from("customer_profiles")
    .select(selectCols)
    .eq("email_address", emailLower)
    .maybeSingle();
  if (profEq) {
    return profEq;
  }

  const { data: profEqOrig } = await supabase
    .from("customer_profiles")
    .select(selectCols)
    .eq("email_address", emailRaw)
    .maybeSingle();
  if (profEqOrig) {
    return profEqOrig;
  }

  const { data: profIlike } = await supabase
    .from("customer_profiles")
    .select(selectCols)
    .ilike("email_address", emailRaw)
    .maybeSingle();
  return profIlike ?? null;
}

/** Resolve display name, email, phone + organisation (CRM profile) from `store_orders.order_number`. */
export async function getCustomerDetailForStoreOrderNumber(
  supabase: SupabaseClient<Database>,
  orderNumber: string,
): Promise<{
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  organisationName: string;
  logoLocations: string;
  checkoutMemos: StoreOrderCustomerMemoLine[];
  /** `store_orders.id` when the order number matches; used for order barcode (scan code). */
  storeOrderId: string | null;
  /** Pickup vs delivery (from store order / checkout pending). */
  fulfillmentMethod: StoreOrderFulfillmentMethod;
  /** Ship-to address from `store_orders.delivery_address`. */
  deliveryAddress: string;
  /** Delivery fee the customer paid at checkout (`store_orders.delivery_fee_cents`). */
  deliveryFeeCents: number;
}> {
  const empty = {
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    organisationName: "",
    logoLocations: "",
    checkoutMemos: [] as StoreOrderCustomerMemoLine[],
    storeOrderId: null as string | null,
    fulfillmentMethod: "Delivery" as StoreOrderFulfillmentMethod,
    deliveryAddress: "",
    deliveryFeeCents: 0,
  };

  const id = orderNumber.trim();
  if (!id) {
    return empty;
  }

  const { data: so, error } = await supabase
    .from("store_orders")
    .select("id, customer_name, customer_email, delivery_address, delivery_fee_cents")
    .eq("order_number", id)
    .maybeSingle();

  if (error || !so) {
    return empty;
  }

  const customerName = (so.customer_name ?? "").trim();
  const customerEmail = (so.customer_email ?? "").trim();
  const deliveryAddress = (so.delivery_address ?? "").trim();
  const deliveryFeeCents = Math.max(0, Math.round(Number(so.delivery_fee_cents) || 0));
  let organisationName = "";
  let customerPhone = "";

  if (customerEmail) {
    const profile = await lookupCustomerProfileByEmail(supabase, customerEmail);
    if (profile?.organisation?.trim()) {
      organisationName = profile.organisation.trim();
    }
    if (profile?.contact_number?.trim()) {
      customerPhone = profile.contact_number.trim();
    }
  }

  let logoLocations = "";
  const checkoutMemos: StoreOrderCustomerMemoLine[] = [];
  const { data: orderItems, error: itemsError } = await supabase
    .from("store_order_items")
    .select("product_name, quantity, color, size, placements, service_type, sort_order, notes")
    .eq("order_id", so.id)
    .order("sort_order", { ascending: true });

  if (!itemsError && orderItems?.length) {
    logoLocations = formatLogoLocationsSummary(orderItems);
    const seenMemoKeys = new Set<string>();
    for (const row of orderItems) {
      const memo = stripCheckoutMemoLastLine(
        stripUploadedAssetUrlsFromCheckoutNotes((row.notes ?? "").trim()),
      );
      if (!memo) {
        continue;
      }
      const size = (row.size ?? "").trim();
      const productName = (row.product_name ?? "").trim();
      const color = (row.color ?? "").trim();
      const quantity = Math.max(0, Math.round(Number(row.quantity) || 0));
      const placementServices = parseCheckoutMemoPlacementServices(row.placements);
      const lineService = resolveCheckoutMemoLineService(row.service_type);
      const dedupeKey = `${memo}\0${size}\0${productName}\0${color}\0${quantity}`;
      if (seenMemoKeys.has(dedupeKey)) {
        continue;
      }
      seenMemoKeys.add(dedupeKey);
      checkoutMemos.push({
        notes: withCheckoutMemoColorAfterModel(memo, color, productName),
        productName: productName || null,
        size: size || null,
        color: color || null,
        quantity,
        placementServices,
        lineService,
      });
    }
  }

  const pickUpById = await resolveStoreOrderPickUpByIds(supabase, [so.id]);
  const fulfillmentMethod = storeOrderFulfillmentLabel(pickUpById.get(so.id) === true);

  return {
    customerName,
    customerEmail,
    customerPhone,
    organisationName,
    logoLocations,
    checkoutMemos,
    storeOrderId: so.id,
    fulfillmentMethod,
    deliveryAddress,
    deliveryFeeCents,
  };
}
