#!/usr/bin/env node
/**
 * Diagnose paid Stripe sessions with no store order (stuck checkout).
 * Usage: node scripts/diagnose-stuck-checkout.mjs [customer_email]
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
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

const emailFilter = (process.argv[2] ?? "").trim().toLowerCase();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

console.log("=== MY_FIRSTORDER promo ===");
const { data: promo } = await supabase
  .from("promotion_codes")
  .select("*")
  .ilike("code", "MY_FIRSTORDER")
  .maybeSingle();
console.log(promo ? JSON.stringify(promo, null, 2) : "NOT FOUND");

if (promo?.id) {
  const { data: redemptions } = await supabase
    .from("promotion_code_redemptions")
    .select("id, customer_email, discount_cents, store_order_id, created_at")
    .eq("promotion_code_id", promo.id)
    .order("created_at", { ascending: false })
    .limit(20);
  console.log("\n=== Redemptions ===");
  console.log(redemptions ?? []);
}

console.log("\n=== Recent store_checkout_pending ===");
let pendingQ = supabase
  .from("store_checkout_pending")
  .select("*")
  .order("created_at", { ascending: false })
  .limit(30);
if (emailFilter) pendingQ = pendingQ.ilike("customer_email", emailFilter);
const { data: pending, error: pendingErr } = await pendingQ;
if (pendingErr) console.error("pending error:", pendingErr.message);
else {
  for (const p of pending ?? []) {
    const { data: order } = p.store_order_id
      ? await supabase.from("store_orders").select("order_number, status").eq("id", p.store_order_id).maybeSingle()
      : { data: null };
    console.log({
      session: p.stripe_checkout_session_id,
      email: p.customer_email,
      status: p.status,
      store_order_id: p.store_order_id,
      order_number: order?.order_number ?? null,
      promo: p.promotion_code_id,
      created_at: p.created_at,
    });
  }
}

console.log("\n=== Recent store_orders (online) ===");
let ordersQ = supabase
  .from("store_orders")
  .select("id, order_number, customer_email, customer_name, total_cents, stripe_checkout_session_id, promotion_code_id, created_at")
  .order("created_at", { ascending: false })
  .limit(20);
if (emailFilter) ordersQ = ordersQ.ilike("customer_email", emailFilter);
const { data: orders } = await ordersQ;
for (const o of orders ?? []) {
  console.log(o);
}

console.log("\n=== Stripe recent paid checkout sessions (last 10) ===");
const sessions = await stripe.checkout.sessions.list({ limit: 10, status: "complete" });
for (const s of sessions.data) {
  const meta = s.metadata ?? {};
  const { data: linked } = await supabase
    .from("store_orders")
    .select("order_number")
    .eq("stripe_checkout_session_id", s.id)
    .maybeSingle();
  console.log({
    id: s.id,
    email: s.customer_details?.email ?? s.customer_email,
    amount_total: s.amount_total,
    payment_status: s.payment_status,
    created: new Date(s.created * 1000).toISOString(),
    promo_meta: meta.promotion_code_id ?? null,
    boss_total: meta.boss_web_total_cents ?? null,
    linked_order: linked?.order_number ?? "NONE",
  });
}

// For stuck pending rows, try fulfill simulation
const stuck = (pending ?? []).filter((p) => p.status === "pending");
if (stuck.length > 0) {
  console.log("\n=== Stuck pending sessions (paid in Stripe?) ===");
  for (const p of stuck.slice(0, 5)) {
    try {
      const s = await stripe.checkout.sessions.retrieve(p.stripe_checkout_session_id);
      console.log({
        session: p.stripe_checkout_session_id,
        stripe_paid: s.payment_status,
        amount_total: s.amount_total,
        email: p.customer_email,
      });
    } catch (e) {
      console.log({ session: p.stripe_checkout_session_id, error: e.message });
    }
  }
}
