#!/usr/bin/env node
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

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: orders } = await sb
  .from("store_orders")
  .select("order_number, customer_email, total_cents, xero_sync_status, xero_invoice_id, xero_invoice_number, xero_sync_error, invoice_reference, created_at")
  .order("created_at", { ascending: false })
  .limit(5);

console.log("=== Recent store_orders Xero status ===");
for (const o of orders ?? []) console.log(o);

const { data: conn } = await sb
  .from("xero_connections")
  .select("tenant_name, scopes, expires_at, updated_at")
  .order("updated_at", { ascending: false })
  .limit(1)
  .maybeSingle();

console.log("\n=== Xero connection ===");
console.log(conn ?? "NO CONNECTION");
