/** Default inbox for staff alerts (catalog health, Xero sync, new CRM leads). */
export const INTERNAL_ALERT_EMAIL_DEFAULT = "accounts@bossworkwear.au";

/** Resolve alert recipient: explicit env override, then shared CRM inbox, then default. */
export function resolveInternalAlertEmail(...envValues: Array<string | undefined | null>): string {
  for (const value of envValues) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  const crm = process.env.CRM_INTERNAL_NOTIFY_EMAIL?.trim();
  if (crm) {
    return crm;
  }
  return INTERNAL_ALERT_EMAIL_DEFAULT;
}
