import { describe, expect, it } from "vitest";

import {
  buildGoogleOAuthAuthorizeUrl,
  createSignedGoogleOAuthState,
  googleOAuthRedirectUri,
  verifySignedGoogleOAuthState,
} from "@/lib/google-oauth";

describe("google-oauth", () => {
  it("builds redirect URI on site origin", () => {
    expect(googleOAuthRedirectUri("https://www.bossworkwear.au")).toBe(
      "https://www.bossworkwear.au/api/auth/google/callback",
    );
  });

  it("round-trips signed OAuth state without cookies", () => {
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-secret";
    const { state } = createSignedGoogleOAuthState({ flow: "login", next: "/cart" });
    const verified = verifySignedGoogleOAuthState(state);
    expect(verified.ok).toBe(true);
    if (verified.ok) {
      expect(verified.flow).toBe("login");
      expect(verified.next).toBe("/cart");
      expect(verified.nonce).toBeTruthy();
    }
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  });

  it("builds authorize URL with bossworkwear redirect", () => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id.apps.googleusercontent.com";
    process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-secret";
    const { state, hashedNonce } = createSignedGoogleOAuthState({ flow: "signup", next: "/" });
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
    expect(url.searchParams.get("state")).toBe(state);
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  });
});
