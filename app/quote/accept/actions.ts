"use server";

import { revalidatePath } from "next/cache";

import {
  mergeNullableText,
  mergeProductLinesWithCustomer,
} from "@/lib/crm/quote-customer-accept-merge";
import type { QuoteAcceptCustomerPayload } from "@/lib/crm/quote-customer-accept-types";
import { getCustomerAcceptValidationError } from "@/lib/crm/quote-customer-accept-validation";
import { buildQuoteCustomerEmailBody, computeTotalCentsFromProductLines } from "@/lib/crm/quote-email-draft";
import { initialQuoteEmailLinesForPortal } from "@/lib/crm/quote-portal-initial-lines";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type { QuoteAcceptCustomerPayload } from "@/lib/crm/quote-customer-accept-types";

export async function submitQuoteCustomerAcceptance(
  quoteId: string,
  token: string,
  customer: QuoteAcceptCustomerPayload,
  comment: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const id = quoteId?.trim();
  const tok = token?.trim();
  if (!id || !tok) {
    return { ok: false, error: "Invalid link." };
  }

  const supabase = createSupabaseAdminClient();
  const { data: row, error: loadErr } = await supabase
    .from("quote_requests")
    .select(
      [
        "id",
        "pipeline_stage",
        "quote_portal_token",
        "quote_customer_accepted_at",
        "contact_name",
        "company_name",
        "email",
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

  if (loadErr) {
    return { ok: false, error: loadErr.message };
  }
  if (!row) {
    return { ok: false, error: "Quote not found." };
  }

  const r = row as unknown as {
    pipeline_stage: string | null;
    quote_portal_token: string | null;
    quote_customer_accepted_at: string | null;
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
    return { ok: false, error: "Invalid or expired link." };
  }
  if (r.pipeline_stage !== "quote") {
    return { ok: false, error: "This quote is not open for online acceptance." };
  }
  if (r.quote_customer_accepted_at) {
    return { ok: false, error: "This quote has already been accepted." };
  }

  const staffLines = initialQuoteEmailLinesForPortal({
    quote_email_products: r.quote_email_products,
    quote_email_product_id: r.quote_email_product_id,
    quote_email_product_name: r.quote_email_product_name,
    product_id: r.product_id,
    product_name: r.products?.name ?? null,
    product_color: r.product_color,
    quantity: r.quantity,
  });

  const staffDeliveryStrings = {
    address_1: r.quote_email_delivery_address_1?.trim() ?? "",
    address_2: r.quote_email_delivery_address_2?.trim() ?? "",
    suburb: r.quote_email_delivery_suburb?.trim() ?? "",
    state: r.quote_email_delivery_state?.trim() ?? "",
    country: r.quote_email_delivery_country?.trim() ?? "",
  };

  const staffDeliveryMerge = {
    a1: r.quote_email_delivery_address_1,
    a2: r.quote_email_delivery_address_2,
    suburb: r.quote_email_delivery_suburb,
    state: r.quote_email_delivery_state,
    country: r.quote_email_delivery_country,
  };

  const valErr = getCustomerAcceptValidationError(
    staffLines,
    customer.product_lines,
    staffDeliveryStrings,
    customer,
    { comment },
  );
  if (valErr) {
    return { ok: false, error: valErr };
  }

  const mergedProducts = mergeProductLinesWithCustomer(staffLines, customer.product_lines);
  const mergedTotal = computeTotalCentsFromProductLines(mergedProducts);
  const mergedLead = mergeNullableText(r.quote_email_lead_time, "");
  const mergedA1 = mergeNullableText(staffDeliveryMerge.a1, customer.delivery_address_1);
  const mergedA2 = mergeNullableText(staffDeliveryMerge.a2, customer.delivery_address_2);
  const mergedSuburb = mergeNullableText(staffDeliveryMerge.suburb, customer.delivery_suburb);
  const mergedState = mergeNullableText(staffDeliveryMerge.state, customer.delivery_state);
  const mergedCountry = mergeNullableText(staffDeliveryMerge.country, customer.delivery_country);

  const first = mergedProducts[0];
  const emailBodySnapshot = buildQuoteCustomerEmailBody({
    contactName: r.contact_name,
    companyName: r.company_name,
    products: mergedProducts,
    totalCents: mergedTotal,
    leadTime: mergedLead ?? "",
    deliveryAddress: {
      address1: mergedA1 ?? "",
      address2: mergedA2 ?? "",
      suburb: mergedSuburb ?? "",
      state: mergedState ?? "",
      country: mergedCountry ?? "",
    },
    totalLineOverride: null,
  });

  const acceptedAt = new Date().toISOString();
  const commentTrimmed = comment.trim();
  const payload = {
    accepted_at: acceptedAt,
    email_body_snapshot: emailBodySnapshot,
    customer_comment: commentTrimmed,
    merged_products: mergedProducts,
    merged_lead_time: mergedLead,
    merged_delivery: {
      address_1: mergedA1,
      address_2: mergedA2,
      suburb: mergedSuburb,
      state: mergedState,
      country: mergedCountry,
    },
    merged_total_cents: mergedTotal,
  };

  const { data: updatedRow, error: upErr } = await supabase
    .from("quote_requests")
    .update({
      quote_email_products: mergedProducts,
      quote_email_product_id: first?.product_id?.trim() || null,
      quote_email_product_name: first?.product_name?.trim() || null,
      quote_email_total_cents: mergedTotal,
      quote_email_lead_time: mergedLead,
      quote_email_delivery_address_1: mergedA1,
      quote_email_delivery_address_2: mergedA2,
      quote_email_delivery_suburb: mergedSuburb,
      quote_email_delivery_state: mergedState,
      quote_email_delivery_country: mergedCountry,
      quote_customer_accepted_at: acceptedAt,
      quote_customer_accept_payload: payload,
      quote_customer_accept_comment: commentTrimmed,
      pipeline_stage: "approval",
    })
    .eq("id", id)
    .eq("quote_portal_token", tok)
    .is("quote_customer_accepted_at", null)
    .eq("pipeline_stage", "quote")
    .select("id")
    .maybeSingle();

  if (upErr) {
    return { ok: false, error: upErr.message };
  }
  if (!updatedRow) {
    return { ok: false, error: "This quote is no longer available for acceptance. Refresh or contact us." };
  }

  const commentPreview =
    commentTrimmed.length > 400 ? `${commentTrimmed.slice(0, 400)}…` : commentTrimmed;

  await supabase.from("crm_activities").insert([
    {
      quote_request_id: id,
      kind: "stage_change",
      body: "Stage: quote → approval (customer accepted online)",
    },
    {
      quote_request_id: id,
      kind: "system",
      body: `Customer accepted quote online. Merged fields into the quote email draft. Comment: ${commentPreview}`,
      metadata: { quote_accept: payload },
    },
  ]);

  revalidatePath("/admin/crm");
  revalidatePath("/admin");
  revalidatePath(`/admin/crm/send-quote/${id}`);
  revalidatePath(`/quote/accept/${id}`);
  return { ok: true };
}
