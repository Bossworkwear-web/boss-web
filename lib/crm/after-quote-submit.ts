import { createSupabaseAdminClient } from "@/lib/supabase";

import { sendInternalNewLeadEmail, sendQuoteReceivedEmail, sendSmsNotification } from "./notifications";

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/**
 * CRM automation after a website quote is stored: link customer, schedule follow-up, log activity, optional email/SMS.
 * Continues even if CRM columns/tables are missing (migration not applied).
 */
export async function runAfterQuoteSubmit(args: {
  quoteId: string;
  email: string;
  contactName: string;
  companyName: string;
  phone: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const emailNorm = args.email.trim();

  let customerProfileId: string | null = null;
  const { data: profile } = await supabase
    .from("customer_profiles")
    .select("id")
    .ilike("email_address", emailNorm)
    .maybeSingle();

  if (profile?.id) {
    customerProfileId = profile.id;
  }

  const nextFollowUp = addDays(new Date(), 3).toISOString();

  const { error: upErr } = await supabase
    .from("quote_requests")
    .update({
      customer_profile_id: customerProfileId,
      next_follow_up_at: nextFollowUp,
      lead_source: "website",
    })
    .eq("id", args.quoteId);

  if (!upErr) {
    const { error: actErr } = await supabase.from("crm_activities").insert({
      quote_request_id: args.quoteId,
      kind: "system",
      body: "Quote submitted from website. Follow-up scheduled in 3 days (adjust in CRM).",
      metadata: { customer_linked: Boolean(customerProfileId) },
    });
    if (actErr) {
      console.warn("[crm] crm_activities insert skipped:", actErr.message);
    }
  } else {
    console.warn("[crm] quote_requests CRM update skipped (run migration?):", upErr.message);
  }

  await sendQuoteReceivedEmail(supabase, {
    quoteId: args.quoteId,
    to: emailNorm,
    contactName: args.contactName,
    companyName: args.companyName,
  });

  await sendInternalNewLeadEmail(supabase, {
    quoteId: args.quoteId,
    contactName: args.contactName,
    companyName: args.companyName,
    email: emailNorm,
    phone: args.phone,
  });

  const smsBody = `Thanks ${args.contactName} — we received your quote request for ${args.companyName}. We'll be in touch soon.`;
  const rawPhone = args.phone?.replace(/\s+/g, "") ?? "";
  if (rawPhone.startsWith("+")) {
    await sendSmsNotification(supabase, {
      quoteId: args.quoteId,
      toE164: rawPhone,
      body: smsBody,
      templateKey: "quote_received_sms",
    });
  }
}
