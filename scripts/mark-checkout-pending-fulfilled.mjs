#!/usr/bin/env node
/**
 * Mark a store_checkout_pending row fulfilled after manual recovery.
 * Usage: node scripts/mark-checkout-pending-fulfilled.mjs <cs_session_id> <store_order_id>
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

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
const orderId = process.argv[3]?.trim();
if (!sessionId?.startsWith("cs_") || !orderId) {
  console.error("Usage: node scripts/mark-checkout-pending-fulfilled.mjs <cs_session_id> <store_order_id>");
  process.exit(1);
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { error } = await sb
  .from("store_checkout_pending")
  .update({ status: "fulfilled", store_order_id: orderId, updated_at: new Date().toISOString() })
  .eq("stripe_checkout_session_id", sessionId);
if (error) {
  console.error(error.message);
  process.exit(1);
}
console.log("Marked fulfilled:", sessionId, "->", orderId);
