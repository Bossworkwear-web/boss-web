#!/usr/bin/env node
/**
 * Move non-workwear Men's/Women's apparel that accidentally lists under Workwear.
 *
 * This typically happens when DB `products.category` contains "Work Shirts" (or similar),
 * which triggers Workwear keyword routing even for corporate/general shirts.
 *
 * Safety rules: do NOT move obvious Workwear signals (Hi-Vis/Hv/Reflective/Rail/Road),
 * JB six-series (style code starts with "6"), or Syzmik/Bisley catalog rows.
 *
 * Usage:
 *   node scripts/move-workwear-misfiled-apparel.mjs --dry-run
 *   node scripts/move-workwear-misfiled-apparel.mjs --apply
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (see `.env.local`).
 */
import { createClient } from "@supabase/supabase-js";

import { getBossWebRoot, loadEnvLocal } from "./lib/load-env.mjs";

loadEnvLocal();

function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run") || !argv.includes("--apply");
  const limitArg = argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Math.max(1, Math.floor(Number(limitArg.split("=")[1]) || 0)) : 0;
  return { dryRun, limit };
}

function hasWorkwearSignals(hayLower) {
  return (
    /\bhv\b/.test(hayLower) ||
    /\bhi[\s-]*vis\b/.test(hayLower) ||
    /\bhigh[\s-]*vis\b/.test(hayLower) ||
    hayLower.includes("reflective") ||
    /\brail\b/.test(hayLower) ||
    /\broad\b/.test(hayLower) ||
    /\bstreetworx\b/.test(hayLower)
  );
}

function isSyzmikOrBisley(hayLower, supplierNameLower) {
  if (supplierNameLower === "syzmik" || supplierNameLower === "bisley") return true;
  return hayLower.includes("syzmik") || hayLower.includes("bisley");
}

function jbSixSeriesStyleFromSlugOrName(name, slug) {
  const s = String(slug ?? "").trim().toLowerCase();
  const atEnd = /(?:^|-)(jb-[a-z0-9][a-z0-9_-]*)$/i.exec(s);
  const seg = (atEnd ? atEnd[1] : (/(?:^|-)(jb-[a-z0-9][a-z0-9_-]*)/i.exec(s) ?? [])[1]) ?? "";
  if (seg) {
    const rest = seg.slice(3);
    const parts = rest.split("-").filter(Boolean);
    const tail = (parts.length ? parts[parts.length - 1] : "").toUpperCase();
    if (tail && /^[A-Z0-9]{3,20}$/.test(tail)) return tail;
    const compact = rest.replace(/-/g, "").toUpperCase();
    if (compact) return compact;
  }
  const m = String(name ?? "").trim().match(/\s*\(([A-Za-z0-9][A-Za-z0-9/_-]*)\)\s*$/);
  return m ? m[1].toUpperCase().replace(/-CLEARANCE$/i, "") : null;
}

function isJbSixSeriesListing(name, slug, supplierNameLower) {
  const supLooksJb =
    supplierNameLower === "jb's wear" ||
    supplierNameLower === "jbs wear" ||
    supplierNameLower === "jbswear" ||
    /\bjbs\s*wear\b/i.test(supplierNameLower);
  const code = jbSixSeriesStyleFromSlugOrName(name, slug);
  if (code && code.startsWith("6")) return true;
  // If we can't extract a code, don't guess; keep false.
  return supLooksJb ? false : false;
}

function nextNonWorkwearCategoryLabel(item) {
  const nameLower = String(item.name ?? "").toLowerCase();
  const catLower = String(item.category ?? "").toLowerCase();
  const blob = `${nameLower} ${catLower} ${String(item.description ?? "").toLowerCase()}`;

  if (/\bpolo\b/.test(blob) && !/\bpoloneck\b/.test(blob)) return "Polos";
  if (/\b(t-?shirt|tee|singlet|tank)\b/.test(blob)) return "T-shirts";
  if (/\b(jacket|parka|softshell|hardshell|bomber|windbreaker|anorak)\b/.test(blob)) return "Jackets";
  if (/\b(hoodie|hoody|jumper|fleece|sweater|cardigan|pullover|knit)\b/.test(blob)) return "Jumper";
  if (/\b(pant|pants|trouser|trousers|shorts|jogger|joggers|leggings|cargo)\b/.test(blob)) return "Pants";

  // Default: work-shirts misfiled should become Shirts.
  return "Shirts";
}

function isWorkShirtsLikeCategory(category) {
  const c = String(category ?? "").trim().toLowerCase();
  if (!c) return false;
  return c === "work shirts" || c === "work shirt" || /\bwork\s*shirts?\b/.test(c);
}

function isWorkwearishCategory(category) {
  const c = String(category ?? "").trim().toLowerCase();
  if (!c) return false;
  if (c === "workwear") return true;
  if (/\bwork\s*wear\b/.test(c)) return true;
  // Common supplier/admin labels.
  if (/\bwork\s*(shirt|shirts|polo|polos|tee|tees|t-?shirt|t-?shirts|jacket|jackets|pant|pants|trouser|trousers)\b/.test(c)) {
    return true;
  }
  return false;
}

function looksLikeGeneralApparelButHasWorkToken(item) {
  const nameLower = String(item.name ?? "").toLowerCase();
  const catLower = String(item.category ?? "").toLowerCase();
  const descLower = String(item.description ?? "").toLowerCase();
  const blob = `${nameLower} ${catLower} ${descLower}`;
  if (!/\bwork\b/.test(blob) && !/\bworkwear\b/.test(blob) && !/\bwork\s*wear\b/.test(blob)) {
    return false;
  }
  // If the only "work" is "workwear", treat that as a workwear signal (do not move).
  const blobNoWorkwear = blob.replace(/\bwork\s*wear\b/g, "").replace(/\bworkwear\b/g, "");
  if (!/\bwork\b/.test(blobNoWorkwear)) {
    return false;
  }
  // Corporate collections that sometimes say "work shirt" etc.
  if (blob.includes("biz collection") || blob.includes("biz care") || blob.includes("biz corporates")) {
    return true;
  }
  // If category explicitly looks workwear-ish, still a candidate, but only if it doesn't match real workwear signals.
  if (isWorkwearishCategory(item.category)) {
    return true;
  }
  return false;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const root = getBossWebRoot();
  void root; // reserved (keeps consistency with other scripts that resolve paths)

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Pull candidates broadly, then apply safety filters in-process.
  const pageSize = 500;
  let from = 0;
  let scanned = 0;
  let candidates = [];

  while (true) {
    const q = supabase
      .from("products")
      .select("id, name, slug, category, description, supplier_name, audience")
      .or("category.ilike.%work%,name.ilike.%work%")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    const { data, error } = await q;
    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    const rows = data ?? [];
    scanned += rows.length;
    candidates.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
    if (args.limit > 0 && scanned >= args.limit) break;
  }

  const moves = [];
  for (const item of candidates) {
    const supplierNameLower = String(item.supplier_name ?? "").trim().toLowerCase();
    const hayLower = `${item.name ?? ""} ${item.slug ?? ""} ${item.category ?? ""} ${item.description ?? ""}`.toLowerCase();

    // Phase 1: classic misfile: work-shirts label (or very similar).
    // Phase 2: broader workwear-ish labels/tokens, but still conservative.
    const workMisfileCandidate =
      isWorkShirtsLikeCategory(item.category) || looksLikeGeneralApparelButHasWorkToken(item);
    if (!workMisfileCandidate) continue;

    if (hasWorkwearSignals(hayLower)) continue;
    if (isSyzmikOrBisley(hayLower, supplierNameLower)) continue;
    if (isJbSixSeriesListing(item.name, item.slug, supplierNameLower)) continue;

    const nextCategory = nextNonWorkwearCategoryLabel(item);
    if (!nextCategory || String(item.category ?? "").trim() === nextCategory) continue;

    moves.push({
      id: item.id,
      name: item.name,
      slug: item.slug,
      supplier_name: item.supplier_name,
      audience: item.audience,
      prevCategory: item.category,
      nextCategory,
    });
  }

  const byNext = new Map();
  for (const m of moves) {
    byNext.set(m.nextCategory, (byNext.get(m.nextCategory) ?? 0) + 1);
  }

  console.log(`Scanned ${scanned} rows; ${moves.length} candidate move(s).`);
  if (moves.length) {
    console.log("Moves by target category:", Object.fromEntries([...byNext.entries()].sort((a, b) => b[1] - a[1])));
    console.log("Sample (up to 30):");
    for (const m of moves.slice(0, 30)) {
      console.log(`- [${m.id}] ${m.name} :: ${m.prevCategory} → ${m.nextCategory}`);
    }
  }

  if (args.dryRun) {
    console.log("Dry run only (pass --apply to write updates).");
    return;
  }

  let updated = 0;
  for (const m of moves) {
    const { error } = await supabase.from("products").update({ category: m.nextCategory }).eq("id", m.id);
    if (error) {
      console.error(`Update failed for ${m.id}:`, error.message);
      process.exit(1);
    }
    updated += 1;
  }

  console.log(`Updated ${updated} product(s).`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

