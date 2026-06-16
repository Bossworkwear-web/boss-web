# Headwear API integration (Xada REST)

Headwear (The Headwear Professionals) provides a **website API key** through **Xada** (`https://api.xada.app/api/v1`), not the older dc-onesource SOAP flow.

## Phase 1 — Save credentials and probe

1. In `.env.local` (gitignored), add:

```bash
HEADWEAR_XADA_API_BASE_URL=https://api.xada.app/api/v1
HEADWEAR_XADA_API_KEY=your_website_api_key
```

You can also use `HEADWEAR_PROMOSTANDARDS_PASSWORD` as the key name (legacy alias).

2. **Save the file** (Cmd+S). Unsaved editor changes are not picked up by `npm run` scripts.

3. Remove incomplete lines like `HEADWEAR_PROMOSTANDARDS_COMPANY_CODE` with no `=` value.

4. Run:

```bash
npm run probe:headwear
npm run sync:headwear -- --dry-run --limit=10
npm run sync:headwear
```

Success = HTTP 200 from `/products` with JSON payload.

## If probe returns 401

- Re-copy the full key from Headwear / Xada (no trailing spaces).
- Confirm your **website URL** (`https://bossworkwear.au`) is registered for the key (similar to Promodata licence URL binding).
- Check whether Headwear sent a separate **API ID** in addition to the key — if yes, add `HEADWEAR_XADA_API_ID=` and share the doc table (not the secret in chat).

## Phase 2 — Catalog sync (next)

Once probe succeeds, we add `scripts/sync-headwear-api.mjs` to import products into Supabase (`supplier_name: Headwear`, slug prefix `hw-`, category Head Wear).

## What to ignore at first

Pricing rules, inventory, purchase orders — only **products + images** for the storefront first.
