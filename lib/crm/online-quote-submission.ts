import type { SupabaseClient } from "@supabase/supabase-js";

import { formatPerthDateTime } from "@/lib/perth-calendar";
import {
  buildStorefrontPlacementOptions,
  STOREFRONT_SERVICE_TYPE_BUTTON_IMAGE_SELECTED,
  STOREFRONT_SERVICE_TYPE_BUTTON_ROUNDED,
  type StorefrontDecoratedServiceType,
} from "@/lib/storefront-placement-options";
import { placementLogoLocationSrc } from "@/lib/placement-logo-location";

export type OnlineQuotePlacementSelection = {
  service: StorefrontDecoratedServiceType;
  id: string;
  name: string;
};

export type WebsiteQuoteProductLineV1 = {
  productId: string | null;
  productName: string;
  color: string | null;
  quantity: number;
};

export type WebsiteQuoteSubmissionV1 = {
  v: 1;
  productSpec: string;
  customerNotes: string | null;
  serviceType: string | null;
  productColor: string | null;
  quantity: number | null;
  productLines?: WebsiteQuoteProductLineV1[];
  placements: OnlineQuotePlacementSelection[];
  logoFileUrl: string | null;
  submittedAt: string;
};

export type OnlineQuoteSubmissionView = {
  id: string;
  createdAt: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  productSpec: string;
  quantity: number | null;
  serviceType: string | null;
  productColor: string | null;
  customerNotes: string | null;
  /** Full `quote_requests.notes` when it contains more than customerNotes alone. */
  storedNotes: string | null;
  logoFileUrl: string | null;
  placements: OnlineQuotePlacementSelection[];
};

export const ONLINE_QUOTE_ROW_SELECT = `
  id,
  created_at,
  company_name,
  contact_name,
  email,
  phone,
  product_id,
  quantity,
  service_type,
  product_color,
  notes,
  logo_file_url,
  placement_labels,
  embroidery_position_id,
  embroidery_position_ids,
  printing_position_id,
  printing_position_ids,
  website_quote_submission,
  lead_source,
  products ( name, slug )
`;

export type QuoteRowForOnlineQuote = {
  id: string;
  created_at: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  product_id: string | null;
  quantity: number | null;
  service_type: string | null;
  product_color: string | null;
  notes: string | null;
  logo_file_url: string | null;
  placement_labels: string[] | null;
  embroidery_position_id: string | null;
  embroidery_position_ids: string[] | null;
  printing_position_id: string | null;
  printing_position_ids: string[] | null;
  website_quote_submission: unknown | null;
  products?: { name: string; slug?: string | null } | null;
};

function normalizeText(raw: unknown): string {
  return String(raw ?? "").trim();
}

function uniqOrderedIds(ids: string[] | null | undefined, fallbackSingle: string | null): string[] {
  const raw =
    ids && ids.length > 0 ? ids.map((x) => String(x)) : fallbackSingle ? [String(fallbackSingle)] : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of raw) {
    const t = normalizeText(id);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function parseWebsiteQuoteProductLines(raw: unknown): WebsiteQuoteProductLineV1[] {
  if (!Array.isArray(raw)) return [];
  const out: WebsiteQuoteProductLineV1[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const productName = normalizeText(rec.productName);
    if (!productName) continue;
    const productIdRaw = normalizeText(rec.productId);
    const color = normalizeText(rec.color) || null;
    const quantity =
      typeof rec.quantity === "number" && Number.isFinite(rec.quantity) && rec.quantity > 0
        ? Math.trunc(rec.quantity)
        : 1;
    out.push({
      productId: productIdRaw || null,
      productName,
      color,
      quantity,
    });
  }
  return out;
}

export function parseWebsiteQuoteSubmission(raw: unknown): WebsiteQuoteSubmissionV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return null;

  const placementsRaw = o.placements;
  const placements: OnlineQuotePlacementSelection[] = [];
  if (Array.isArray(placementsRaw)) {
    for (const row of placementsRaw) {
      if (!row || typeof row !== "object") continue;
      const rec = row as Record<string, unknown>;
      const service = normalizeText(rec.service);
      const id = normalizeText(rec.id);
      const name = normalizeText(rec.name);
      if ((service !== "Embroidery" && service !== "Printing") || !id || !name) continue;
      placements.push({ service, id, name });
    }
  }

  return {
    v: 1,
    productSpec: normalizeText(o.productSpec),
    customerNotes: normalizeText(o.customerNotes) || null,
    serviceType: normalizeText(o.serviceType) || null,
    productColor: normalizeText(o.productColor) || null,
    quantity:
      typeof o.quantity === "number" && Number.isFinite(o.quantity) && o.quantity > 0 ? o.quantity : null,
    productLines: (() => {
      const lines = parseWebsiteQuoteProductLines(o.productLines);
      return lines.length > 0 ? lines : undefined;
    })(),
    placements,
    logoFileUrl: normalizeText(o.logoFileUrl) || null,
    submittedAt: normalizeText(o.submittedAt) || "",
  };
}

function splitLegacyCustomerNotes(notes: string | null): string | null {
  if (!notes?.trim()) return null;
  const lines = notes.split("\n\n").map((line) => line.trim()).filter(Boolean);
  const customerLines = lines.filter(
    (line) =>
      !line.startsWith("CRM quote request:") &&
      !line.startsWith("Quote company:") &&
      !line.startsWith("Additional products:") &&
      !line.startsWith("Could not match product:") &&
      !line.startsWith("Ambiguous product:"),
  );
  return customerLines.length > 0 ? customerLines.join("\n\n") : null;
}

function placementsFromLabels(labels: string[] | null | undefined): OnlineQuotePlacementSelection[] {
  if (!labels?.length) return [];
  const out: OnlineQuotePlacementSelection[] = [];
  for (const raw of labels) {
    const label = normalizeText(raw);
    if (!label) continue;
    const embroideryMatch = label.match(/^Embroidery:\s*(.+)$/i);
    const printingMatch = label.match(/^Printing:\s*(.+)$/i);
    if (embroideryMatch) {
      out.push({ service: "Embroidery", id: label, name: embroideryMatch[1]!.trim() });
      continue;
    }
    if (printingMatch) {
      out.push({ service: "Printing", id: label, name: printingMatch[1]!.trim() });
    }
  }
  return out;
}

function buildPlacementsFromRow(
  row: QuoteRowForOnlineQuote,
  posNameById: Map<string, string>,
): OnlineQuotePlacementSelection[] {
  const snapshot = parseWebsiteQuoteSubmission(row.website_quote_submission);
  if (snapshot?.placements.length) {
    return snapshot.placements;
  }

  const out: OnlineQuotePlacementSelection[] = [];
  for (const id of uniqOrderedIds(row.embroidery_position_ids, row.embroidery_position_id)) {
    out.push({
      service: "Embroidery",
      id,
      name: posNameById.get(id) || id,
    });
  }
  for (const id of uniqOrderedIds(row.printing_position_ids, row.printing_position_id)) {
    out.push({
      service: "Printing",
      id,
      name: posNameById.get(id) || id,
    });
  }
  if (out.length > 0) {
    return out;
  }
  return placementsFromLabels(row.placement_labels);
}

export function buildWebsiteQuoteSubmissionSnapshot(input: {
  productSpecRaw: string;
  customerNotes: string | null;
  serviceType: string | null;
  productColor: string | null;
  quantity: number | null;
  productLines?: WebsiteQuoteProductLineV1[];
  embroideryPlacements: Array<{ id: string; name: string }>;
  printingPlacements: Array<{ id: string; name: string }>;
  logoFileUrl: string | null;
}): WebsiteQuoteSubmissionV1 {
  return {
    v: 1,
    productSpec: input.productSpecRaw.trim(),
    customerNotes: input.customerNotes?.trim() ? input.customerNotes.trim() : null,
    serviceType: input.serviceType?.trim() ? input.serviceType.trim() : null,
    productColor: input.productColor?.trim() ? input.productColor.trim() : null,
    quantity:
      typeof input.quantity === "number" && Number.isFinite(input.quantity) && input.quantity > 0
        ? input.quantity
        : null,
    productLines: input.productLines?.length ? input.productLines : undefined,
    placements: [
      ...input.embroideryPlacements.map((placement) => ({
        service: "Embroidery" as const,
        id: placement.id,
        name: placement.name,
      })),
      ...input.printingPlacements.map((placement) => ({
        service: "Printing" as const,
        id: placement.id,
        name: placement.name,
      })),
    ],
    logoFileUrl: input.logoFileUrl?.trim() ? input.logoFileUrl.trim() : null,
    submittedAt: new Date().toISOString(),
  };
}

export function toOnlineQuoteSubmissionView(
  row: QuoteRowForOnlineQuote,
  posNameById: Map<string, string>,
): OnlineQuoteSubmissionView {
  const snapshot = parseWebsiteQuoteSubmission(row.website_quote_submission);
  const placements = buildPlacementsFromRow(row, posNameById);
  const storedNotes = row.notes?.trim() ? row.notes.trim() : null;
  const productFallback =
    row.products?.name?.trim() ||
    row.products?.slug?.trim() ||
    (row.product_id ? `Product ID: ${row.product_id}` : "");
  const legacyCustomerNotes = splitLegacyCustomerNotes(row.notes);
  const customerNotes = snapshot?.customerNotes ?? legacyCustomerNotes ?? storedNotes;

  return {
    id: row.id,
    createdAt: row.created_at,
    companyName: normalizeText(row.company_name),
    contactName: normalizeText(row.contact_name),
    email: normalizeText(row.email),
    phone: row.phone?.trim() ? row.phone.trim() : null,
    productSpec: snapshot?.productSpec || productFallback,
    quantity: snapshot?.quantity ?? row.quantity,
    serviceType: snapshot?.serviceType ?? row.service_type?.trim() ?? null,
    productColor: snapshot?.productColor ?? row.product_color?.trim() ?? null,
    customerNotes,
    storedNotes:
      storedNotes && storedNotes !== (customerNotes ?? "") ? storedNotes : null,
    logoFileUrl: snapshot?.logoFileUrl ?? row.logo_file_url?.trim() ?? null,
    placements,
  };
}

function collectPositionIds(rows: QuoteRowForOnlineQuote[]): string[] {
  return [
    ...new Set(
      rows.flatMap((row) => [
        ...(row.embroidery_position_ids ?? []),
        ...(row.printing_position_ids ?? []),
        row.embroidery_position_id,
        row.printing_position_id,
      ]),
    ),
  ]
    .map((id) => String(id ?? "").trim())
    .filter(Boolean);
}

async function loadPositionNameMap(
  supabase: SupabaseClient,
  positionIds: string[],
): Promise<Map<string, string>> {
  if (positionIds.length === 0) return new Map();
  const { data: posRows } = await supabase
    .from("embroidery_positions")
    .select("id, name")
    .in("id", positionIds);
  return new Map((posRows ?? []).map((row) => [String(row.id), String(row.name).trim()]));
}

/** Load one quote submission for preview (any date, any lead_source). */
export async function loadOnlineQuoteSubmissionById(
  supabase: SupabaseClient,
  quoteId: string,
): Promise<{ quote: OnlineQuoteSubmissionView | null; error: string | null }> {
  const id = quoteId.trim();
  if (!id) {
    return { quote: null, error: "Missing quote id." };
  }

  let data: unknown = null;
  let error: { message: string } | null = null;

  const first = await supabase
    .from("quote_requests")
    .select(ONLINE_QUOTE_ROW_SELECT)
    .eq("id", id)
    .maybeSingle();
  data = first.data;
  error = first.error;

  if (error?.message.includes("website_quote_submission")) {
    const fallbackSelect = ONLINE_QUOTE_ROW_SELECT.replace(
      "website_quote_submission,\n  ",
      "",
    );
    const retry = await supabase
      .from("quote_requests")
      .select(fallbackSelect)
      .eq("id", id)
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    return { quote: null, error: error.message };
  }
  if (!data) {
    return { quote: null, error: "Quote not found." };
  }

  const row = data as QuoteRowForOnlineQuote;
  const posNameById = await loadPositionNameMap(supabase, collectPositionIds([row]));
  return { quote: toOnlineQuoteSubmissionView(row, posNameById), error: null };
}

/** Load website quote submissions for a Perth calendar day. */
export async function loadOnlineQuoteSubmissionsForDay(
  supabase: SupabaseClient,
  dayRange: { startIso: string; endIso: string },
): Promise<{ quotes: OnlineQuoteSubmissionView[]; error: string | null }> {
  let data: unknown[] | null = null;
  let error: { message: string } | null = null;

  const first = await supabase
    .from("quote_requests")
    .select(ONLINE_QUOTE_ROW_SELECT)
    .eq("lead_source", "website")
    .gte("created_at", dayRange.startIso)
    .lt("created_at", dayRange.endIso)
    .order("created_at", { ascending: false });
  data = first.data;
  error = first.error;

  if (error?.message.includes("website_quote_submission")) {
    const fallbackSelect = ONLINE_QUOTE_ROW_SELECT.replace(
      "website_quote_submission,\n  ",
      "",
    );
    const retry = await supabase
      .from("quote_requests")
      .select(fallbackSelect)
      .eq("lead_source", "website")
      .gte("created_at", dayRange.startIso)
      .lt("created_at", dayRange.endIso)
      .order("created_at", { ascending: false });
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    return { quotes: [], error: error.message };
  }
  if (!data?.length) {
    return { quotes: [], error: null };
  }

  const rows = data as QuoteRowForOnlineQuote[];
  const posNameById = await loadPositionNameMap(supabase, collectPositionIds(rows));
  return {
    quotes: rows.map((row) => toOnlineQuoteSubmissionView(row, posNameById)),
    error: null,
  };
}

export function formatOnlineQuoteSubmittedAt(iso: string): string {
  return formatPerthDateTime(iso);
}

export function buildPlacementDiagramSrc(placement: OnlineQuotePlacementSelection): string | null {
  const options = buildStorefrontPlacementOptions([{ id: placement.id, name: placement.name }]);
  const option = options[0];
  if (!option) return null;
  return placementLogoLocationSrc(option.id, option.label, { diagramAbbr: option.diagramAbbr });
}

export function placementServiceIconSrc(service: StorefrontDecoratedServiceType): string {
  return STOREFRONT_SERVICE_TYPE_BUTTON_IMAGE_SELECTED[service];
}

export const PLACEMENT_SERVICE_ICON_ROUNDED = STOREFRONT_SERVICE_TYPE_BUTTON_ROUNDED;
