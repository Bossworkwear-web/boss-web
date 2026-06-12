/** Google reCAPTCHA v2 (checkbox) — server-side verification. */

export function isRecaptchaConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() && process.env.RECAPTCHA_SECRET_KEY?.trim(),
  );
}

/** Dev only: skip verify when the widget cannot load locally (never enable in production). */
export function isRecaptchaDevBypass(): boolean {
  return (
    process.env.NODE_ENV === "development" && process.env.RECAPTCHA_DEV_BYPASS?.trim() === "1"
  );
}

export function getRecaptchaSiteKey(): string | null {
  const key = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim();
  return key || null;
}

type SiteVerifyResponse = {
  success?: boolean;
  "error-codes"?: string[];
};

export type RecaptchaVerifyResult = {
  ok: boolean;
  errorCodes: string[];
};

export async function verifyRecaptchaToken(
  token: string,
  remoteIp?: string | null,
): Promise<RecaptchaVerifyResult> {
  const secret = process.env.RECAPTCHA_SECRET_KEY?.trim();
  if (!secret) {
    return { ok: process.env.NODE_ENV === "development", errorCodes: [] };
  }

  const response = token.trim();
  if (!response) {
    return { ok: isRecaptchaDevBypass(), errorCodes: ["missing-input-response"] };
  }

  const body = new URLSearchParams({
    secret,
    response,
  });
  const ip = remoteIp?.trim();
  if (ip) {
    body.set("remoteip", ip);
  }

  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    return { ok: false, errorCodes: ["siteverify-http-error"] };
  }

  const data = (await res.json()) as SiteVerifyResponse;
  const errorCodes = data["error-codes"] ?? [];
  if (data.success !== true) {
    console.error(`[recaptcha] siteverify failed: ${errorCodes.join(", ") || "unknown"}`);
  }
  return { ok: data.success === true, errorCodes };
}

export function recaptchaFailureRedirectStatus(errorCodes: readonly string[]): string {
  if (errorCodes.includes("invalid-input-secret") || errorCodes.includes("missing-input-secret")) {
    return "recaptcha_config";
  }
  if (errorCodes.includes("timeout-or-duplicate")) {
    return "recaptcha_expired";
  }
  return "recaptcha_failed";
}
