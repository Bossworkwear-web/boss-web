import { resolveInternalAlertEmail } from "@/lib/internal-alert-email";
import { resendFromAccount } from "@/lib/resend-from";
import { siteBaseUrl } from "@/lib/store-order-utils";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Best-effort email when we auto-restart (or skip) an unhealthy Supabase project. Never throws. */
export async function sendSupabaseUnhealthyRestartAlert(input: {
  action: "restart" | "skip";
  reason: string;
  projectRef: string | null;
  projectStatus: string | null;
  restarted: boolean;
  restartDetail?: string;
}): Promise<{ ok: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false };
  }
  if (input.action !== "restart") {
    return { ok: false };
  }

  const to = resolveInternalAlertEmail(
    process.env.STOREFRONT_CATALOG_ALERT_EMAIL,
    process.env.XERO_ALERT_EMAIL,
  );
  const from = resendFromAccount();
  const site = siteBaseUrl();
  const subject = input.restarted
    ? "[Boss Workwear] Supabase auto-restart triggered"
    : "[Boss Workwear] Supabase auto-restart failed";
  const html = `
    <p>Storefront catalog probe found the database unreachable on <strong>${escapeHtml(site)}</strong>.</p>
    <p><strong>Project:</strong> ${escapeHtml(input.projectRef ?? "(unknown)")}</p>
    <p><strong>Reported status:</strong> ${escapeHtml(input.projectStatus ?? "(unknown)")}</p>
    <p><strong>Reason:</strong> ${escapeHtml(input.reason)}</p>
    <p><strong>Restart API:</strong> ${escapeHtml(input.restarted ? "accepted" : (input.restartDetail ?? "failed"))}</p>
    <p>The site may take a few minutes to recover. If Status stays Unhealthy, restart manually in the Supabase dashboard (Settings → General → Restart project).</p>
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
