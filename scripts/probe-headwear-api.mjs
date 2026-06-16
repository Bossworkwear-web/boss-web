/**
 * Step 1 for Headwear via Xada REST API → verify API key and list products endpoint.
 *
 * Env (.env.local) — save the file after editing:
 *   HEADWEAR_XADA_API_BASE_URL=https://api.xada.app/api/v1
 *   HEADWEAR_XADA_API_KEY=...          (website API key from Headwear / Xada)
 *
 * Legacy aliases (still supported):
 *   HEADWEAR_PROMOSTANDARDS_PASSWORD
 *
 * Usage:
 *   npm run probe:headwear
 */
import { loadEnvLocal } from "./lib/load-env.mjs";

loadEnvLocal();

const BASE = (process.env.HEADWEAR_XADA_API_BASE_URL ?? "https://api.xada.app/api/v1").replace(/\/$/, "");
const API_KEY = (
  process.env.HEADWEAR_XADA_API_KEY ??
  process.env.HEADWEAR_PROMOSTANDARDS_PASSWORD ??
  ""
).trim();

const AUTH_ATTEMPTS = [
  { label: "Bearer", headers: { Authorization: `Bearer ${API_KEY}` } },
  { label: "X-API-Key", headers: { "X-API-Key": API_KEY } },
  { label: "x-api-key", headers: { "x-api-key": API_KEY } },
  { label: "api-key", headers: { "api-key": API_KEY } },
];

async function tryFetch(path, headers) {
  const url = `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", ...headers },
  });
  const text = await res.text();
  return { url, status: res.status, text };
}

function snippet(text, max = 500) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

async function main() {
  if (!API_KEY) {
    console.error(
      "Missing HEADWEAR_XADA_API_KEY (or HEADWEAR_PROMOSTANDARDS_PASSWORD) in .env.local.\n" +
        "Save .env.local after editing, then run: npm run probe:headwear\n" +
        "See docs/HEADWEAR_API_SETUP.md",
    );
    process.exit(1);
  }

  console.log("Headwear / Xada API probe");
  console.log(`  Base URL: ${BASE}`);
  console.log(`  Key:      ${API_KEY.slice(0, 6)}…${API_KEY.slice(-4)} (${API_KEY.length} chars)`);
  console.log("");

  for (const attempt of AUTH_ATTEMPTS) {
    const { url, status, text } = await tryFetch("/products", attempt.headers);
    console.log(`[${attempt.label}] ${status} — ${url}`);
    if (status === 200) {
      console.log(snippet(text, 800));
      console.log("\nOK — use this auth header style for sync-headwear-api.mjs.");
      return;
    }
    if (status !== 401) {
      console.log(snippet(text, 300));
    }
  }

  // Query-string fallback (some feeds use ?api_key=)
  const qsUrl = `${BASE}/products?api_key=${encodeURIComponent(API_KEY)}`;
  const qsRes = await fetch(qsUrl, { headers: { Accept: "application/json" } });
  const qsText = await qsRes.text();
  console.log(`[query api_key] ${qsRes.status} — ${qsUrl.split("?")[0]}?api_key=…`);
  if (qsRes.status === 200) {
    console.log(snippet(qsText, 800));
    console.log("\nOK — API key works as query parameter.");
    return;
  }

  console.error("\nAll auth attempts returned 401 or error.");
  console.error("Last response:", snippet(qsText, 400));
  console.error(
    "\nChecklist:\n" +
      "  1. Save .env.local (Cmd+S) — unsaved edits are not read by scripts.\n" +
      "  2. Copy the full API key (no spaces).\n" +
      "  3. Xada keys are often tied to your website URL — confirm bossworkwear.au is registered.\n" +
      "  4. If Headwear sent separate API ID + Key, add HEADWEAR_XADA_API_ID as well and tell your developer.",
  );
  process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
