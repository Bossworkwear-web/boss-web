import Link from "next/link";

import { createSupabaseAdminClient } from "@/lib/supabase";

import { CrmWorkspace } from "./crm-workspace";
import { parseQuoteEmailProductsFromRow, type QuoteEmailProductLine } from "./quote-email-products";

export type CrmQuoteRow = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  pipeline_stage: string;
  created_at: string;
  next_follow_up_at: string | null;
  last_contacted_at: string | null;
  internal_notes: string | null;
  automation_paused: boolean;
  lead_source: string;
  product_name: string | null;
  position_name: string | null;
  printing_position_name: string | null;
  customer_profile_id: string | null;
  customer_org: string | null;
  customer_name: string | null;
  /** From quote form / quote_requests */
  service_type: string | null;
  product_color: string | null;
  quantity: number | null;
  placement_labels: string[] | null;
  logo_file_url: string | null;
  notes: string | null;
  /** Linked catalog product (UUID) from the quote form */
  product_id: string | null;
  /** Staff draft for the customer quote email (Send quote page) */
  quote_email_product_id: string | null;
  quote_email_product_name: string | null;
  quote_email_products: QuoteEmailProductLine[];
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
};

export type CrmCustomerRow = {
  id: string;
  organisation: string;
  customer_name: string;
  email_address: string;
  contact_number: string;
  login_password: string | null;
  delivery_address: string;
  billing_address: string;
  created_at: string;
  /** Store checkout orders (non-cancelled), matched by email. */
  store_order_count: number;
  /** Per-currency totals in cents for store_order_count orders. */
  store_order_totals: { currency: string; cents: number }[];
};

export type CrmActivityRow = {
  id: string;
  quote_request_id: string;
  kind: string;
  body: string;
  created_at: string;
};

export type CrmNotificationRow = {
  id: string;
  quote_request_id: string;
  channel: string;
  template_key: string;
  status: string;
  error: string | null;
  created_at: string;
  company_name: string | null;
};

/** Raw row shape from quote_requests + nested selects (not in generated DB types). */
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

type CrmNotificationListRow = {
  id: string;
  quote_request_id: string;
  channel: string;
  template_key: string;
  status: string;
  error: string | null;
  created_at: string;
  quote_requests: { company_name: string } | null;
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

function collectQuoteRequestPositionIds(rows: QuoteRequestListRow[]): string[] {
  const flat: string[] = [];
  for (const row of rows) {
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
  }
  return uniqPositionIdsInOrder(flat);
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

export default async function AdminCrmPage() {
  let migrationHint: string | null = null;
  let quotes: CrmQuoteRow[] = [];
  let customers: CrmCustomerRow[] = [];
  let activities: CrmActivityRow[] = [];
  let notifications: CrmNotificationRow[] = [];

  try {
    const supabase = createSupabaseAdminClient();

    const { data: quoteData, error: quoteError } = await supabase
      .from("quote_requests")
      .select(
        `
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
      `,
      )
      .order("created_at", { ascending: false });

    if (quoteError) {
      const missing =
        quoteError.message?.includes("quote_requests") ||
        quoteError.message?.includes("schema cache") ||
        quoteError.message?.includes("pipeline_stage") ||
        quoteError.message?.includes("does not exist") ||
        quoteError.code === "42703" ||
        quoteError.code === "42P01";
      migrationHint = missing
        ? `${quoteError.message} — Run supabase/sql-editor/add_quote_position_array_columns.sql in Supabase SQL Editor (or the full supabase/sql-editor/patch_quote_requests.sql). Prerequisites: public.products, embroidery_positions, customer_profiles. Then Settings → API → Reload schema.`
        : quoteError.message;
    } else if (quoteData) {
      const rows = quoteData as unknown as QuoteRequestListRow[];
      const positionIds = collectQuoteRequestPositionIds(rows);
      let positionNameById = new Map<string, string>();
      if (positionIds.length > 0) {
        const { data: posRows } = await supabase
          .from("embroidery_positions")
          .select("id, name")
          .in("id", positionIds);
        positionNameById = new Map(
          (posRows ?? []).map((p) => [String(p.id), typeof p.name === "string" ? p.name : ""]),
        );
      }
      quotes = rows.map((row) => ({
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
      }));
    }

    const { data: profileData } = await supabase
      .from("customer_profiles")
      .select(
        "id, organisation, customer_name, email_address, contact_number, login_password, delivery_address, billing_address, created_at",
      )
      .order("organisation");

    type StoreOrderAgg = { count: number; byCurrency: Map<string, number> };
    const orderAggByEmailNorm = new Map<string, StoreOrderAgg>();
    try {
      const { data: storeOrderRows, error: storeOrderError } = await supabase
        .from("store_orders")
        .select("customer_email, total_cents, currency, status");

      if (!storeOrderError && storeOrderRows) {
        for (const row of storeOrderRows) {
          if (row.status === "cancelled") continue;
          const key = row.customer_email.trim().toLowerCase();
          if (!key) continue;
          let agg = orderAggByEmailNorm.get(key);
          if (!agg) {
            agg = { count: 0, byCurrency: new Map() };
            orderAggByEmailNorm.set(key, agg);
          }
          agg.count += 1;
          const cur = (row.currency ?? "AUD").trim().toUpperCase() || "AUD";
          agg.byCurrency.set(cur, (agg.byCurrency.get(cur) ?? 0) + row.total_cents);
        }
      }
    } catch {
      /* store_orders optional — CRM still loads */
    }

    customers =
      profileData?.map((p) => {
        const emailKey = p.email_address.trim().toLowerCase();
        const agg = orderAggByEmailNorm.get(emailKey);
        const store_order_totals = agg
          ? Array.from(agg.byCurrency.entries())
              .map(([currency, cents]) => ({ currency, cents }))
              .sort((a, b) => a.currency.localeCompare(b.currency))
          : [];
        return {
          id: p.id,
          organisation: p.organisation,
          customer_name: p.customer_name,
          email_address: p.email_address,
          contact_number: p.contact_number,
          login_password: p.login_password,
          delivery_address: p.delivery_address,
          billing_address: p.billing_address,
          created_at: p.created_at,
          store_order_count: agg?.count ?? 0,
          store_order_totals,
        };
      }) ?? [];

    const { data: actData } = await supabase
      .from("crm_activities")
      .select("id, quote_request_id, kind, body, created_at")
      .order("created_at", { ascending: false })
      .limit(400);

    activities =
      actData?.map((a) => ({
        id: a.id,
        quote_request_id: a.quote_request_id,
        kind: a.kind,
        body: a.body,
        created_at: a.created_at,
      })) ?? [];

    const { data: notifData } = await supabase
      .from("crm_notification_log")
      .select(
        `
        id,
        quote_request_id,
        channel,
        template_key,
        status,
        error,
        created_at,
        quote_requests ( company_name )
      `,
      )
      .order("created_at", { ascending: false })
      .limit(40);

    notifications =
      (notifData as unknown as CrmNotificationListRow[] | null)?.map((n) => ({
        id: n.id,
        quote_request_id: n.quote_request_id,
        channel: n.channel,
        template_key: n.template_key,
        status: n.status,
        error: n.error,
        created_at: n.created_at,
        company_name: n.quote_requests?.company_name ?? null,
      })) ?? [];
  } catch {
    migrationHint =
      migrationHint ?? "Could not load CRM data. Check Supabase env vars and run the CRM migration.";
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin" className="text-brand-orange hover:underline">
            Dashboard
          </Link>{" "}
          / CRM &amp; pipeline
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">CRM &amp; pipeline</h1>
        <p className="mt-2 max-w-none text-sm text-slate-600">
          Website quote requests are captured automatically. Match returning customers by email, move deals through{" "}
          <strong>enquiry → quote → approval → completion</strong>, and schedule follow-ups so nothing slips through
          the cracks. Email/SMS use optional API keys (see README).
        </p>
      </header>

      <CrmWorkspace
        quotes={quotes}
        customers={customers}
        activities={activities}
        notifications={notifications}
        migrationHint={migrationHint}
        serverNowMs={Date.now()}
      />
    </div>
  );
}
