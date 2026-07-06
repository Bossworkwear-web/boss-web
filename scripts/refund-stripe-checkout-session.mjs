#!/usr/bin/env node
/**
 * Full refund for a duplicate paid Stripe Checkout session.
 * Usage: node scripts/refund-stripe-checkout-session.mjs <cs_session_id> [reason]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Stripe from "stripe";

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

loadEnv();

const sessionId = process.argv[2]?.trim();
const reason = process.argv[3] ?? "duplicate_checkout";
if (!sessionId?.startsWith("cs_")) {
  console.error("Usage: node scripts/refund-stripe-checkout-session.mjs <cs_session_id>");
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
if (session.payment_status !== "paid") {
  console.error("Session is not paid:", session.payment_status);
  process.exit(1);
}

const pi = session.payment_intent;
const paymentIntentId = typeof pi === "string" ? pi : pi?.id;
if (!paymentIntentId?.startsWith("pi_")) {
  console.error("No payment intent on session");
  process.exit(1);
}

const refund = await stripe.refunds.create({
  payment_intent: paymentIntentId,
  reason: "duplicate",
  metadata: { boss_web_reason: reason, checkout_session_id: sessionId },
});

console.log("Refunded", (refund.amount ?? 0) / 100, "AUD — refund id:", refund.id, "status:", refund.status);
