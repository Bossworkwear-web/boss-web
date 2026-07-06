import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fulfillStoreOrderFromStripeCheckoutSession } from "@/lib/fulfill-stripe-checkout-order";

function loadEnv() {
  const content = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

/**
 * Manual recovery — run when a paid Stripe session has no store order:
 * npx vitest run lib/__tests__/recover-stuck-checkout.integration.test.ts
 */
describe("recover stuck checkout (integration)", () => {
  it.skip("fulfills paid session without store order", async () => {
    loadEnv();
    const sessionId = process.argv[3] ?? "cs_live_REPLACE_ME";
    const result = await fulfillStoreOrderFromStripeCheckoutSession(sessionId);
    expect(result.ok, result.ok ? "" : (result as { error: string }).error).toBe(true);
    if (result.ok) {
      console.log("Recovered order:", result.orderNumber, result.trackUrl);
    }
  }, 120_000);
});
