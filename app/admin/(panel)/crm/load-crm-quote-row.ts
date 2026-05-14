import { createSupabaseAdminClient } from "@/lib/supabase";

import type { CrmQuoteRow } from "./page";
import { parseQuoteEmailProductsFromRow } from "./quote-email-products";

type QuoteRequestListRow = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  pipeline_stage: string | null;
  created_at: string;
  next_follow_up_at: string | null;
  last_contacted_at: string | null;
  internal_notes: string | null;
  automation_paused: boolean | null;
  lead_source: string | null;
  customer_profile_id: string | null;
  embroidery_position_id: string | null;
  embroidery_position_ids: string[] | null;
  printing_position_id: string | null;
  printing_position_ids: string[] | null;
  service_type: string | null;
  product_color: string | null;
  quantity: number | null;
  placement_labels: string[] | null;
  logo_file_url: string | null;
  notes: string | null;
  product_id: string | null;
  quote_email_product_id: string | null;
  quote_email_product_name: string | null;
  quote_email_products: unknown | null;
  quote_email_total_cents: number | null;
  quote_email_lead_time: string | null;
  quote_email_delivery_address_1: string | null;
  quote_email_delivery_address_2: string | null;
  quote_email_delivery_suburb: string | null;
  quote_email_delivery_state: string | null;
  quote_email_delivery_country: string | null;
  quote_mockup_image_urls: string[] | null;
  quote_email_embroidery_service: string | null;
  quote_email_print_service: string | null;
  quote_portal_token: string | null;
  quote_customer_accepted_at: string | null;
  quote_customer_accept_payload: unknown | null;
  quote_customer_accept_comment: string | null;
  products: { name: string } | null;
  emb_pos: { name: string } | null;
  print_position: { name: string } | null;
  customer_profiles: { organisation: string; customer_name: string } | null;
};

function uniqPositionIdsInOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const t = id.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

function embroideryPositionLabel(row: QuoteRequestListRow, nameById: Map<string, string>): string | null {
  const ids =
    row.embroidery_position_ids && row.embroidery_position_ids.length > 0
      ? uniqPositionIdsInOrder(row.embroidery_position_ids)
      : row.embroidery_position_id
        ? [row.embroidery_position_id]
        : [];
  if (ids.length > 0) {
    return ids.map((id) => nameById.get(id) ?? id).join(", ");
  }
  return row.emb_pos?.name ?? null;
}

function printingPositionLabel(row: QuoteRequestListRow, nameById: Map<string, string>): string | null {
  const ids =
    row.printing_position_ids && row.printing_position_ids.length > 0
      ? uniqPositionIdsInOrder(row.printing_position_ids)
      : row.printing_position_id
        ? [row.printing_position_id]
        : [];
  if (ids.length > 0) {
    return ids.map((id) => nameById.get(id) ?? id).join(", ");
  }
  return row.print_position?.name ?? null;
}

function collectQuoteRequestPositionIds(row: QuoteRequestListRow): string[] {
  const flat: string[] = [];
  if (row.embroidery_position_ids?.length) {
    flat.push(...row.embroidery_position_ids);
  } else if (row.embroidery_position_id) {
    flat.push(row.embroidery_position_id);
  }
  if (row.printing_position_ids?.length) {
    flat.push(...row.printing_position_ids);
  } else if (row.printing_position_id) {
    flat.push(row.printing_position_id);
  }
  return uniqPositionIdsInOrder(flat);
}

function mapRowToCrmQuote(row: QuoteRequestListRow, positionNameById: Map<string, string>): CrmQuoteRow {
  return {
    id: row.id,
    company_name: row.company_name,
    contact_name: row.contact_name,
    email: row.email,
    phone: row.phone,
    pipeline_stage: row.pipeline_stage ?? "enquiry",
    created_at: row.created_at,
    next_follow_up_at: row.next_follow_up_at,
    last_contacted_at: row.last_contacted_at,
    internal_notes: row.internal_notes,
    automation_paused: row.automation_paused ?? false,
    lead_source: row.lead_source ?? "website",
    product_name: row.products?.name ?? null,
    position_name: embroideryPositionLabel(row, positionNameById),
    printing_position_name: printingPositionLabel(row, positionNameById),
    customer_profile_id: row.customer_profile_id,
    customer_org: row.customer_profiles?.organisation ?? null,
    customer_name: row.customer_profiles?.customer_name ?? null,
    service_type: row.service_type ?? null,
    product_color: row.product_color ?? null,
    quantity: row.quantity ?? null,
    placement_labels: row.placement_labels ?? null,
    logo_file_url: row.logo_file_url ?? null,
    notes: row.notes ?? null,
    product_id: row.product_id ?? null,
    quote_email_product_id: row.quote_email_product_id ?? null,
    quote_email_product_name: row.quote_email_product_name ?? null,
    quote_email_products: parseQuoteEmailProductsFromRow(
      row.quote_email_products,
      row.quote_email_product_id,
      row.quote_email_product_name,
    ),
    quote_email_total_cents: row.quote_email_total_cents ?? null,
    quote_email_lead_time: row.quote_email_lead_time ?? null,
    quote_email_delivery_address_1: row.quote_email_delivery_address_1 ?? null,
    quote_email_delivery_address_2: row.quote_email_delivery_address_2 ?? null,
    quote_email_delivery_suburb: row.quote_email_delivery_suburb ?? null,
    quote_email_delivery_state: row.quote_email_delivery_state ?? null,
    quote_email_delivery_country: row.quote_email_delivery_country ?? null,
    quote_mockup_image_urls: row.quote_mockup_image_urls ?? null,
    quote_email_embroidery_service: row.quote_email_embroidery_service ?? null,
    quote_email_print_service: row.quote_email_print_service ?? null,
    quote_portal_token: row.quote_portal_token ?? null,
    quote_customer_accepted_at: row.quote_customer_accepted_at ?? null,
    quote_customer_accept_payload: row.quote_customer_accept_payload ?? null,
    quote_customer_accept_comment: row.quote_customer_accept_comment ?? null,
  };
}

const QUOTE_SELECT = `
  id,
  company_name,
  contact_name,
  email,
  phone,
  pipeline_stage,
  created_at,
  next_follow_up_at,
  last_contacted_at,
  internal_notes,
  automation_paused,
  lead_source,
  customer_profile_id,
  product_id,
  quote_email_product_id,
  quote_email_product_name,
  quote_email_products,
  quote_email_total_cents,
  quote_email_lead_time,
  quote_email_delivery_address_1,
  quote_email_delivery_address_2,
  quote_email_delivery_suburb,
  quote_email_delivery_state,
  quote_email_delivery_country,
  quote_mockup_image_urls,
  quote_email_embroidery_service,
  quote_email_print_service,
  quote_portal_token,
  quote_customer_accepted_at,
  quote_customer_accept_payload,
  quote_customer_accept_comment,
  embroidery_position_id,
  embroidery_position_ids,
  printing_position_id,
  printing_position_ids,
  service_type,
  product_color,
  quantity,
  placement_labels,
  logo_file_url,
  notes,
  products ( name ),
  emb_pos:embroidery_positions!embroidery_position_id ( name ),
  print_position:embroidery_positions!printing_position_id ( name ),
  customer_profiles ( organisation, customer_name )
`;

export async function loadCrmQuoteRowById(quoteId: string): Promise<CrmQuoteRow | null> {
  const id = quoteId?.trim();
  if (!id) return null;

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("quote_requests")
      .select(QUOTE_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (error || !data) return null;

    const row = data as unknown as QuoteRequestListRow;
    const positionIds = collectQuoteRequestPositionIds(row);
    let positionNameById = new Map<string, string>();
    if (positionIds.length > 0) {
      const { data: posRows } = await supabase.from("embroidery_positions").select("id, name").in("id", positionIds);
      positionNameById = new Map(
        (posRows ?? []).map((p) => [String(p.id), typeof p.name === "string" ? p.name : ""]),
      );
    }

    return mapRowToCrmQuote(row, positionNameById);
  } catch {
    return null;
  }
}
