import { resendFromAccount } from "@/lib/resend-from";
import type { StorefrontCatalogHealth } from "@/lib/storefront-catalog-health";
import { siteBaseUrl } from "@/lib/store-order-utils";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function alertRecipient(): string {
  return (
    process.env.STOREFRONT_CATALOG_ALERT_EMAIL?.trim() ||
    process.env.CRM_INTERNAL_NOTIFY_EMAIL?.trim() ||
    process.env.XERO_ALERT_EMAIL?.trim() ||
    "account@bossworkwear.au"
  );
}

/** Best-effort email when the live storefront catalog probe fails. Never throws. */
export async function sendStorefrontCatalogHealthAlert(
  health: StorefrontCatalogHealth,
): Promise<{ ok: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false };
  }

  const to = alertRecipient();
  const from = resendFromAccount();
  const site = siteBaseUrl();
  const subject = `[Boss Workwear] Storefront catalog alert — ${health.productCount} products`;
  const issueList = health.issues.map((i) => `<li>${escapeHtml(i)}</li>`).join("");
  const html = `
    <p>The storefront catalog health check failed on <strong>${escapeHtml(site)}</strong>.</p>
    <p><strong>Active products returned:</strong> ${health.productCount}</p>
    <p><strong>Checked at:</strong> ${escapeHtml(health.checkedAt)}</p>
    <ul>${issueList}</ul>
    <p>Common fix: update Vercel <code>NEXT_PUBLIC_SUPABASE_*</code> keys to match Supabase Dashboard, then run a <strong>new production build</strong> (not Redeploy-only).</p>
    <p>From the repo: <code>npm run sync:vercel-supabase-env</code> then push to <code>main</code>.</p>
    <p>See <code>docs/SUPABASE_VERCEL_ENV.md</code> in the boss-web repo.</p>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    return { ok: res.ok };
  } catch {
    return { ok: false };
  }
}
