import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import {
  buildQuoteSentCustomerEmailHtml,
  quoteSentCustomerEmailSubject,
} from "@/lib/crm/quote-sent-customer-email";
import { resendFromSales } from "@/lib/resend-from";
import {
  STOREFRONT_PHONE_DISPLAY,
  STOREFRONT_QUOTE_EMAIL_RECIPIENT,
} from "@/lib/storefront-quote-mailto";

type AdminClient = SupabaseClient<Database>;

async function logNotification(
  supabase: AdminClient,
  args: {
    quoteRequestId: string;
    channel: "email" | "sms";
    templateKey: string;
    status: "queued" | "sent" | "failed" | "skipped";
    error?: string | null;
  },
) {
  await supabase.from("crm_notification_log").insert({
    quote_request_id: args.quoteRequestId,
    channel: args.channel,
    template_key: args.templateKey,
    status: args.status,
    error: args.error ?? null,
  });
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Customer-facing: quote received (Resend). */
export async function sendQuoteReceivedEmail(
  supabase: AdminClient,
  args: { quoteId: string; to: string; contactName: string; companyName: string },
) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = resendFromSales();

  if (!apiKey) {
    await logNotification(supabase, {
      quoteRequestId: args.quoteId,
      channel: "email",
      templateKey: "quote_received_customer",
      status: "skipped",
      error: "RESEND_API_KEY not set",
    });
    return { ok: false as const, skipped: true };
  }

  const subject = "We received your quote request";
  const html = `
    <p>Hi ${escapeHtml(args.contactName)},</p>
    <p>Thanks for your enquiry from <strong>${escapeHtml(args.companyName)}</strong>. We have received your quote request and will be in touch shortly.</p>
    <p>If anything changes, reply to this email or call us on ${escapeHtml(STOREFRONT_PHONE_DISPLAY)} with your reference: <code>${escapeHtml(args.quoteId.slice(0, 8))}</code></p>
    <p style="font-size:13px;color:#64748b">${escapeHtml(STOREFRONT_QUOTE_EMAIL_RECIPIENT)} · ${escapeHtml(STOREFRONT_PHONE_DISPLAY)}</p>
  `
    .replace(/\n\s+/g, " ")
    .trim();

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject,
        html,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as { message?: string };

    if (!res.ok) {
      await logNotification(supabase, {
        quoteRequestId: args.quoteId,
        channel: "email",
        templateKey: "quote_received_customer",
        status: "failed",
        error: json?.message ?? res.statusText,
      });
      return { ok: false as const, error: json?.message ?? res.statusText };
    }

    await logNotification(supabase, {
      quoteRequestId: args.quoteId,
      channel: "email",
      templateKey: "quote_received_customer",
      status: "sent",
    });
    return { ok: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Email send failed";
    await logNotification(supabase, {
      quoteRequestId: args.quoteId,
      channel: "email",
      templateKey: "quote_received_customer",
      status: "failed",
      error: msg,
    });
    return { ok: false as const, error: msg };
  }
}

/** Customer-facing: formal quote + online accept link (Resend). Call only after building `plainTextBody` and `acceptUrl`. */
export async function sendCustomerQuoteSentEmail(
  supabase: AdminClient,
  args: {
    quoteId: string;
    to: string;
    contactName: string;
    companyName: string;
    plainTextBody: string;
    acceptUrl: string;
  },
): Promise<{ ok: true } | { ok: false; error: string; skipped?: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = resendFromSales();

  if (!apiKey) {
    await logNotification(supabase, {
      quoteRequestId: args.quoteId,
      channel: "email",
      templateKey: "quote_sent_customer",
      status: "skipped",
      error: "RESEND_API_KEY not set",
    });
    return { ok: false, error: "Email is not configured (RESEND_API_KEY).", skipped: true };
  }

  const subject = quoteSentCustomerEmailSubject(args.companyName);
  const html = buildQuoteSentCustomerEmailHtml({
    contactName: args.contactName,
    plainTextBody: args.plainTextBody,
    acceptUrl: args.acceptUrl,
  });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject,
        html,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as { message?: string };

    if (!res.ok) {
      await logNotification(supabase, {
        quoteRequestId: args.quoteId,
        channel: "email",
        templateKey: "quote_sent_customer",
        status: "failed",
        error: json?.message ?? res.statusText,
      });
      return { ok: false, error: json?.message ?? res.statusText };
    }

    await logNotification(supabase, {
      quoteRequestId: args.quoteId,
      channel: "email",
      templateKey: "quote_sent_customer",
      status: "sent",
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Email send failed";
    await logNotification(supabase, {
      quoteRequestId: args.quoteId,
      channel: "email",
      templateKey: "quote_sent_customer",
      status: "failed",
      error: msg,
    });
    return { ok: false, error: msg };
  }
}

/** Internal team alert for new leads. */
export async function sendInternalNewLeadEmail(
  supabase: AdminClient,
  args: {
    quoteId: string;
    contactName: string;
    companyName: string;
    email: string;
    phone: string | null;
  },
) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = resendFromSales();
  const internalTo = process.env.CRM_INTERNAL_NOTIFY_EMAIL?.trim();

  if (!apiKey || !internalTo) {
    await logNotification(supabase, {
      quoteRequestId: args.quoteId,
      channel: "email",
      templateKey: "new_lead_internal",
      status: "skipped",
      error: !apiKey ? "RESEND_API_KEY not set" : "CRM_INTERNAL_NOTIFY_EMAIL not set",
    });
    return { ok: false as const, skipped: true };
  }

  const subject = `New quote enquiry — ${args.companyName}`;
  const html = `
    <p><strong>New website quote request</strong></p>
    <ul>
      <li>Company: ${escapeHtml(args.companyName)}</li>
      <li>Contact: ${escapeHtml(args.contactName)}</li>
      <li>Email: ${escapeHtml(args.email)}</li>
      <li>Phone: ${escapeHtml(args.phone ?? "—")}</li>
      <li>Quote ID: ${escapeHtml(args.quoteId)}</li>
    </ul>
    <p>Open Admin → CRM &amp; pipeline to move this through the sales stages.</p>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [internalTo],
        subject,
        html,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as { message?: string };

    if (!res.ok) {
      await logNotification(supabase, {
        quoteRequestId: args.quoteId,
        channel: "email",
        templateKey: "new_lead_internal",
        status: "failed",
        error: json?.message ?? res.statusText,
      });
      return { ok: false as const, error: json?.message };
    }

    await logNotification(supabase, {
      quoteRequestId: args.quoteId,
      channel: "email",
      templateKey: "new_lead_internal",
      status: "sent",
    });
    return { ok: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Email send failed";
    await logNotification(supabase, {
      quoteRequestId: args.quoteId,
      channel: "email",
      templateKey: "new_lead_internal",
      status: "failed",
      error: msg,
    });
    return { ok: false as const, error: msg };
  }
}

/** SMS via Twilio (optional). */
export async function sendSmsNotification(
  supabase: AdminClient,
  args: { quoteId: string; toE164: string; body: string; templateKey: string },
) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    await logNotification(supabase, {
      quoteRequestId: args.quoteId,
      channel: "sms",
      templateKey: args.templateKey,
      status: "skipped",
      error: "Twilio env not configured",
    });
    return { ok: false as const, skipped: true };
  }

  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const form = new URLSearchParams();
  form.set("To", args.toE164);
  form.set("From", from);
  form.set("Body", args.body);

  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const json = (await res.json().catch(() => ({}))) as { message?: string; sid?: string };

    if (!res.ok) {
      await logNotification(supabase, {
        quoteRequestId: args.quoteId,
        channel: "sms",
        templateKey: args.templateKey,
        status: "failed",
        error: json?.message ?? res.statusText,
      });
      return { ok: false as const, error: json?.message };
    }

    await logNotification(supabase, {
      quoteRequestId: args.quoteId,
      channel: "sms",
      templateKey: args.templateKey,
      status: "sent",
    });
    return { ok: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "SMS failed";
    await logNotification(supabase, {
      quoteRequestId: args.quoteId,
      channel: "sms",
      templateKey: args.templateKey,
      status: "failed",
      error: msg,
    });
    return { ok: false as const, error: msg };
  }
}
