/** Google reCAPTCHA v2 (checkbox) — server-side verification. */

export function isRecaptchaConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() && process.env.RECAPTCHA_SECRET_KEY?.trim(),
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

export async function verifyRecaptchaToken(token: string): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY?.trim();
  if (!secret) {
    return process.env.NODE_ENV === "development";
  }

  const response = token.trim();
  if (!response) {
    return false;
  }

  const body = new URLSearchParams({
    secret,
    response,
  });

  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    return false;
  }

  const data = (await res.json()) as SiteVerifyResponse;
  return data.success === true;
}
