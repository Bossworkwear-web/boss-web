import { getSiteContentValue } from "@/lib/site-content";

export const EMAIL_TEMPLATE_SLUGS = ["order_confirmation", "order_shipped"] as const;
export type EmailTemplateSlug = (typeof EMAIL_TEMPLATE_SLUGS)[number];

export const EMAIL_TEMPLATE_LABELS: Record<EmailTemplateSlug, string> = {
  order_confirmation: "Order confirmation",
  order_shipped: "Order shipped",
};

export const EMAIL_TEMPLATE_DESCRIPTIONS: Record<EmailTemplateSlug, string> = {
  order_confirmation: "Sent when a storefront order is placed (Resend).",
  order_shipped: "Sent when dispatch marks an order shipped (Resend).",
};

export const EMAIL_TEMPLATE_PLACEHOLDERS: Record<EmailTemplateSlug, readonly string[]> = {
  order_confirmation: [
    "customerName",
    "orderNumber",
    "totalFormatted",
    "trackUrl",
    "invoiceLine",
    "invoiceSubjectSuffix",
  ],
  order_shipped: ["customerName", "orderNumber", "trackUrl", "carrier", "trackingNumber", "carrierTrackHtml"],
};

export type EmailTemplateContent = {
  subject: string;
  html: string;
};

export const DEFAULT_EMAIL_TEMPLATES: Record<EmailTemplateSlug, EmailTemplateContent> = {
  order_confirmation: {
    subject: "Order confirmed — {{orderNumber}}{{invoiceSubjectSuffix}}",
    html: `<p>Hi {{customerName}},</p>
<p>Your customer order ID is <strong>{{orderNumber}}</strong> — keep it for invoices and support.</p>
{{invoiceLine}}
<p>Total: <strong>{{totalFormatted}}</strong></p>
<p>You can check status and tracking any time:</p>
<p><a href="{{trackUrl}}">View order &amp; delivery tracking</a></p>
<p>If the link does not work, copy this URL:<br/><code>{{trackUrl}}</code></p>`,
  },
  order_shipped: {
    subject: "Shipped — {{orderNumber}}",
    html: `<p>Hi {{customerName}},</p>
<p>Your order <strong>{{orderNumber}}</strong> has been dispatched.</p>
<p><strong>{{carrier}}</strong> tracking: <code>{{trackingNumber}}</code></p>
{{carrierTrackHtml}}
<p>Order summary &amp; status: <a href="{{trackUrl}}">{{trackUrl}}</a></p>`,
  },
};

export function emailTemplateSubjectKey(slug: EmailTemplateSlug): string {
  return `email:${slug}:subject`;
}

export function emailTemplateHtmlKey(slug: EmailTemplateSlug): string {
  return `email:${slug}:html`;
}

/** Replace {{key}} placeholders. Values should already be HTML-escaped when used in HTML bodies. */
export function renderEmailTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => vars[key] ?? "");
}

export async function getEmailTemplateContent(slug: EmailTemplateSlug): Promise<EmailTemplateContent> {
  const defaults = DEFAULT_EMAIL_TEMPLATES[slug];
  const [subjectRaw, htmlRaw] = await Promise.all([
    getSiteContentValue(emailTemplateSubjectKey(slug)),
    getSiteContentValue(emailTemplateHtmlKey(slug)),
  ]);

  return {
    subject: subjectRaw?.trim() || defaults.subject,
    html: htmlRaw?.trim() || defaults.html,
  };
}

export async function getEmailTemplateOverrides(slug: EmailTemplateSlug): Promise<{
  subject: string | null;
  html: string | null;
}> {
  const [subjectRaw, htmlRaw] = await Promise.all([
    getSiteContentValue(emailTemplateSubjectKey(slug)),
    getSiteContentValue(emailTemplateHtmlKey(slug)),
  ]);

  return {
    subject: subjectRaw?.trim() || null,
    html: htmlRaw?.trim() || null,
  };
}

export function mergeEmailTemplateContent(
  slug: EmailTemplateSlug,
  input: Partial<EmailTemplateContent>,
): EmailTemplateContent {
  const defaults = DEFAULT_EMAIL_TEMPLATES[slug];
  return {
    subject: input.subject?.trim() || defaults.subject,
    html: input.html?.trim() || defaults.html,
  };
}
