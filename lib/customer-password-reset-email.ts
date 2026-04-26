function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendCustomerTemporaryPasswordEmail(args: {
  to: string;
  customerName?: string | null;
  tempPassword: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "Boss Web <onboarding@resend.dev>";
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY not set" };
  }

  const subject = "Your temporary password";
  const greetingName = (args.customerName ?? "").trim() || "there";
  const html = `
    <p>Hi ${escapeHtml(greetingName)},</p>
    <p>We generated a temporary password for your account:</p>
    <p><strong>${escapeHtml(args.tempPassword)}</strong></p>
    <p>Next steps:</p>
    <ol>
      <li>Go to the log-in page and sign in using your email and the temporary password.</li>
      <li>After signing in, open <strong>Customer</strong> and choose <strong>Change password</strong> to set a new password.</li>
    </ol>
    <p>If you did not request this, you can ignore this email.</p>
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
      return { ok: false, error: json?.message ?? res.statusText };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Email failed" };
  }
}

