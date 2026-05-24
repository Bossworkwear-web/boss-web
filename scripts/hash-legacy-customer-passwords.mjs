#!/usr/bin/env node
/**
 * Phase 2: migrate existing customer_profiles.login_password values.
 *
 * - Rows linked to Supabase Auth (auth_user_id set): clear login_password (Auth is source of truth).
 * - Legacy rows with plain-text password: replace with scrypt hash (v1$…).
 * - Already hashed (v1$…) or empty: skipped.
 *
 * Usage:
 *   node scripts/hash-legacy-customer-passwords.mjs --dry-run
 *   node scripts/hash-legacy-customer-passwords.mjs
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * (use production credentials only when intentionally migrating production).
 */
import { randomBytes, scryptSync } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

import { loadEnvLocal } from "./lib/load-env.mjs";

loadEnvLocal();

const PREFIX = "v1";
const SCRYPT_N = 16384;
const SCRYPT_r = 8;
const SCRYPT_p = 1;
const KEYLEN = 64;

function hashCustomerPassword(plain) {
  const salt = randomBytes(16);
  const hash = scryptSync(plain, salt, KEYLEN, { N: SCRYPT_N, r: SCRYPT_r, p: SCRYPT_p });
  return `${PREFIX}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

function isCustomerPasswordHash(stored) {
  return String(stored ?? "").trim().startsWith(`${PREFIX}$`);
}

const dryRun = process.argv.includes("--dry-run");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: rows, error } = await supabase
  .from("customer_profiles")
  .select("id, email_address, login_password, auth_user_id")
  .not("login_password", "is", null);

if (error) {
  console.error("Load failed:", error.message);
  process.exit(1);
}

const profiles = (rows ?? []).filter((row) => String(row.login_password ?? "").trim() !== "");

let clearedAuthLinked = 0;
let hashedLegacy = 0;
let skippedHashed = 0;

for (const row of profiles) {
  const stored = String(row.login_password ?? "").trim();
  if (!stored) {
    continue;
  }

  if (row.auth_user_id) {
    clearedAuthLinked += 1;
    if (!dryRun) {
      const { error: upErr } = await supabase
        .from("customer_profiles")
        .update({ login_password: null })
        .eq("id", row.id);
      if (upErr) {
        console.error(`Clear failed for ${row.email_address}:`, upErr.message);
        process.exit(1);
      }
    }
    continue;
  }

  if (isCustomerPasswordHash(stored)) {
    skippedHashed += 1;
    continue;
  }

  hashedLegacy += 1;
  if (!dryRun) {
    const hashed = hashCustomerPassword(stored);
    const { error: upErr } = await supabase
      .from("customer_profiles")
      .update({ login_password: hashed })
      .eq("id", row.id);
    if (upErr) {
      console.error(`Hash failed for ${row.email_address}:`, upErr.message);
      process.exit(1);
    }
  }
}

console.log(
  dryRun ? "[dry-run] Would migrate customer passwords:" : "Migrated customer passwords:",
);
console.log(`  Auth-linked cleared (login_password → null): ${clearedAuthLinked}`);
console.log(`  Legacy plain → scrypt hash: ${hashedLegacy}`);
console.log(`  Already hashed (skipped): ${skippedHashed}`);
console.log(`  Total rows with login_password examined: ${profiles.length}`);

if (dryRun && (clearedAuthLinked > 0 || hashedLegacy > 0)) {
  console.log("\nRe-run without --dry-run to apply changes.");
}
