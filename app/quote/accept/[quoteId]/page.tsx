import { notFound } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase";
import { DEFAULT_QUOTE_EMAIL_LEAD_TIME } from "@/lib/crm/quote-email-draft";
import { initialQuoteEmailLinesForPortal } from "@/lib/crm/quote-portal-initial-lines";

import { TopNav } from "@/app/components/top-nav";

import { QuoteAcceptClient } from "./quote-accept-client";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ quoteId: string }>;
  searchParams: Promise<{ token?: string; embed?: string }>;
};

export default async function QuoteAcceptPage({ params, searchParams }: PageProps) {
  const { quoteId } = await params;
  const { token = "", embed } = await searchParams;
  const embedMode = embed === "1" || embed === "true";

  const id = quoteId?.trim();
  const tok = token?.trim();
  if (!id || !tok) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-slate-600">
        <p>This link is missing a token. Please use the full link from your quote email.</p>
      </div>
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data: row, error } = await supabase
    .from("quote_requests")
    .select(
      [
        "id",
        "pipeline_stage",
        "quote_portal_token",
        "quote_customer_accepted_at",
        "quote_customer_accept_payload",
        "contact_name",
        "company_name",
        "quote_email_products",
        "quote_email_product_id",
        "quote_email_product_name",
        "quote_email_lead_time",
        "quote_email_delivery_address_1",
        "quote_email_delivery_address_2",
        "quote_email_delivery_suburb",
        "quote_email_delivery_state",
        "quote_email_delivery_country",
        "product_id",
        "product_color",
        "quantity",
        "products(name)",
      ].join(", "),
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !row) notFound();

  const r = row as unknown as {
    id: string;
    pipeline_stage: string | null;
    quote_portal_token: string | null;
    quote_customer_accepted_at: string | null;
    quote_customer_accept_payload: { email_body_snapshot?: string } | null;
    contact_name: string;
    company_name: string;
    quote_email_products: unknown;
    quote_email_product_id: string | null;
    quote_email_product_name: string | null;
    quote_email_lead_time: string | null;
    quote_email_delivery_address_1: string | null;
    quote_email_delivery_address_2: string | null;
    quote_email_delivery_suburb: string | null;
    quote_email_delivery_state: string | null;
    quote_email_delivery_country: string | null;
    product_id: string | null;
    product_color: string | null;
    quantity: number | null;
    products: { name: string } | null;
  };

  if ((r.quote_portal_token ?? "").trim() !== tok) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-slate-600">
        <p>This link is invalid or has expired. Please contact us if you need help.</p>
      </div>
    );
  }

  const acceptedAt = r.quote_customer_accepted_at;
  const alreadyAccepted = Boolean(acceptedAt);
  const acceptedSummary =
    (r.quote_customer_accept_payload as { email_body_snapshot?: string } | null)?.email_body_snapshot ?? null;

  if (!alreadyAccepted && r.pipeline_stage !== "quote") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-slate-600">
        <p>This quote is not open for online acceptance. Please reply to your sales contact.</p>
      </div>
    );
  }

  const staffProductLines = initialQuoteEmailLinesForPortal({
    quote_email_products: r.quote_email_products,
    quote_email_product_id: r.quote_email_product_id,
    quote_email_product_name: r.quote_email_product_name,
    product_id: r.product_id,
    product_name: r.products?.name ?? null,
    product_color: r.product_color,
    quantity: r.quantity,
  });

  const staffDelivery = {
    address_1: r.quote_email_delivery_address_1?.trim() ?? "",
    address_2: r.quote_email_delivery_address_2?.trim() ?? "",
    suburb: r.quote_email_delivery_suburb?.trim() ?? "",
    state: r.quote_email_delivery_state?.trim() ?? "",
    country: r.quote_email_delivery_country?.trim() ?? "",
  };

  const leadTimeDisplay = r.quote_email_lead_time?.trim() || DEFAULT_QUOTE_EMAIL_LEAD_TIME;

  return (
    <>
      {!embedMode ? <TopNav /> : null}
      <QuoteAcceptClient
        embed={embedMode}
        quoteId={r.id}
        token={tok}
        companyName={r.company_name}
        contactName={r.contact_name}
        staffProductLines={staffProductLines}
        staffDelivery={staffDelivery}
        leadTimeDisplay={leadTimeDisplay}
        alreadyAccepted={alreadyAccepted}
        acceptedSummary={acceptedSummary}
      />
    </>
  );
}
