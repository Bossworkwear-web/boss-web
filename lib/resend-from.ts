/** Resend From headers — sales (quotes/CRM) vs account (orders/login). */

export const RESEND_FROM_SALES_DEFAULT = "Boss Workwear <sales@bossworkwear.au>";
export const RESEND_FROM_ACCOUNT_DEFAULT = "Boss Workwear <account@bossworkwear.au>";

function pickFrom(specific: string | undefined, fallbackDefault: string): string {
  const specificTrim = specific?.trim();
  if (specificTrim) return specificTrim;
  const legacy = process.env.RESEND_FROM_EMAIL?.trim();
  if (legacy) return legacy;
  return fallbackDefault;
}

/** Quote received, formal quote, internal new-lead alerts. */
export function resendFromSales(): string {
  return pickFrom(process.env.RESEND_FROM_SALES_EMAIL, RESEND_FROM_SALES_DEFAULT);
}

/** Order confirmation/shipped, tax invoice PDF, password reset. */
export function resendFromAccount(): string {
  return pickFrom(process.env.RESEND_FROM_ACCOUNT_EMAIL, RESEND_FROM_ACCOUNT_DEFAULT);
}
