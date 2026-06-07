import type { CustomerQuoteTotals } from "@/lib/customer-quote";
import type { QuoteLineSnapshot } from "@/lib/customer-quote-pricing";
import { insertWebsiteQuoteRequest } from "@/lib/crm/insert-website-quote-request";
import { CART_SELF_QUOTE_LEAD_SOURCE } from "@/lib/crm/lead-sources";
import { formatMoneyFromCents } from "@/lib/store-order-utils";
import { createSupabaseAdminClient } from "@/lib/supabase";

function buildCartSelfQuoteNotes(args: {
  quoteNumber: string;
  customerQuoteId: string;
  totals: CustomerQuoteTotals;
  lines: QuoteLineSnapshot[];
}): string {
  const totalLabel = formatMoneyFromCents(args.totals.totalCents, "AUD");
  const productSummary = args.lines
    .slice(0, 12)
    .map((line) => `${line.productName.trim()} ×${line.quantity}`)
    .join("; ");
  const extra = args.lines.length > 12 ? ` (+${args.lines.length - 12} more lines)` : "";

  return [
    "Self-service cart quote — customer emailed themselves a saved quote.",
    `Customer quote: ${args.quoteNumber} (id: ${args.customerQuoteId})`,
    `Lines: ${args.lines.length} · Items: ${args.totals.totalQuantity} · Total (GST incl.): ${totalLabel}`,
    productSummary ? `Products: ${productSummary}${extra}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Mirror a cart self-quote into CRM (`quote_requests`) so Admin pipeline / exports see the lead.
 * Best-effort: never throws; logs and returns on schema/insert errors.
 */
export async function recordCartSelfQuoteLead(args: {
  customerQuoteId: string;
  quoteNumber: string;
  customerEmail: string;
  customerName: string | null;
  totals: CustomerQuoteTotals;
  lines: QuoteLineSnapshot[];
}): Promise<{ ok: true; quoteRequestId: string } | { ok: false }> {
  try {
    const supabase = createSupabaseAdminClient();
    const emailNorm = args.customerEmail.trim();
    const contactName = args.customerName?.trim() || "Customer";

    let companyName = "Cart self-quote";
    let customerProfileId: string | null = null;
    let phone: string | null = null;

    const { data: profile } = await supabase
      .from("customer_profiles")
      .select("id, organisation, customer_name, contact_number")
      .ilike("email_address", emailNorm)
      .maybeSingle();

    if (profile?.id) {
      customerProfileId = profile.id;
      const org = typeof profile.organisation === "string" ? profile.organisation.trim() : "";
      if (org) {
        companyName = org;
      }
      const profilePhone =
        typeof profile.contact_number === "string" ? profile.contact_number.trim() : "";
      if (profilePhone) {
        phone = profilePhone;
      }
    }

    const notes = buildCartSelfQuoteNotes(args);
    const websiteQuoteSubmission = {
      type: "cart_self_quote" as const,
      customer_quote_id: args.customerQuoteId,
      quote_number: args.quoteNumber,
      total_cents: args.totals.totalCents,
      line_count: args.lines.length,
      total_quantity: args.totals.totalQuantity,
      pickup: args.totals.pickup,
    };

    const { data: inserted, error } = await insertWebsiteQuoteRequest(supabase, {
      company_name: companyName,
      contact_name: contactName,
      email: emailNorm,
      phone,
      quantity: args.totals.totalQuantity,
      notes,
      lead_source: CART_SELF_QUOTE_LEAD_SOURCE,
      pipeline_stage: "enquiry",
      customer_profile_id: customerProfileId,
      website_quote_submission: websiteQuoteSubmission,
    });

    if (error || !inserted?.id) {
      console.warn("[crm] cart_self_quote lead insert failed:", error?.message ?? "no id");
      return { ok: false };
    }

    const { error: actErr } = await supabase.from("crm_activities").insert({
      quote_request_id: inserted.id,
      kind: "system",
      body: `Cart self-quote ${args.quoteNumber} saved to My Quote and emailed to the customer.`,
      metadata: { customer_quote_id: args.customerQuoteId, lead_source: "cart_self_quote" },
    });
    if (actErr) {
      console.warn("[crm] cart_self_quote activity insert skipped:", actErr.message);
    }

    return { ok: true, quoteRequestId: inserted.id };
  } catch (e) {
    console.warn("[crm] recordCartSelfQuoteLead failed:", e);
    return { ok: false };
  }
}
