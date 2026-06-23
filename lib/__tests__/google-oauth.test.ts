import { describe, expect, it } from "vitest";

import {
  buildGoogleOAuthAuthorizeUrl,
  createGoogleOAuthSecrets,
  googleOAuthRedirectUri,
} from "@/lib/google-oauth";

describe("google-oauth", () => {
  it("builds redirect URI on site origin", () => {
    expect(googleOAuthRedirectUri("https://www.bossworkwear.au")).toBe(
      "https://www.bossworkwear.au/api/auth/google/callback",
    );
  });

  it("creates matching nonce and hashed nonce", () => {
    const { nonce, hashedNonce } = createGoogleOAuthSecrets();
    expect(nonce).toBeTruthy();
    expect(hashedNonce).toMatch(/^[a-f0-9]{64}$/);
    expect(nonce).not.toBe(hashedNonce);
  });

  it("builds authorize URL with bossworkwear redirect", () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
    const { state, hashedNonce } = createGoogleOAuthSecrets();
    const url = new URL(
      buildGoogleOAuthAuthorizeUrl({
        origin: "https://www.bossworkwear.au",
        state,
        hashedNonce,
      }),
    );
    expect(url.hostname).toBe("accounts.google.com");
    expect(url.searchParams.get("client_id")).toBe("test-client-id.apps.googleusercontent.com");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://www.bossworkwear.au/api/auth/google/callback",
    );
    expect(url.searchParams.get("nonce")).toBe(hashedNonce);
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
  });
});
