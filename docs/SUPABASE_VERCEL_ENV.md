# Supabase ↔ Vercel environment sync

## What happened (June 2026 outage)

The database and category **mapping rules were fine**. The live site showed *"Nothing mapped here"* because **Vercel could not read products from Supabase**:

1. **Supabase API keys were rotated** locally (new `sb_publishable_…` / `sb_secret_…` format in `.env.local`).
2. **Vercel Production still had older keys** (set ~45 days earlier).
3. The storefront loader **returned an empty list** when Supabase rejected the key — pages looked like a mapping problem, not a connection error.
4. **Redeploy-only** did not fix it: Next.js bakes `NEXT_PUBLIC_*` values into the build. A **new build** after updating Vercel env was required.

The daily **2:00 AM DB backup** (pg_dump) does **not** affect the website API connection.

## Prevention (already in the repo)

| Safeguard | What it does |
|-----------|----------------|
| `lib/storefront-catalog-fetch.ts` | Throws on missing/invalid Supabase config instead of silently returning `[]`. |
| `GET /api/cron/storefront-catalog-health` | Every 6 hours: probes catalog count; emails staff if broken (`CRON_SECRET`). |
| Admin Dashboard banner | Red alert when the catalog probe fails. |
| `npm run sync:vercel-supabase-env` | Copies Supabase URL + keys from `.env.local` to Vercel (Production + Preview). |

## When you rotate Supabase keys

1. Update **`.env.local`** from Supabase Dashboard → Project Settings → **API**.
2. Run:

   ```bash
   npm run sync:vercel-supabase-env
   ```

3. Trigger a **new production build** (push to `main` or Vercel Deploy from GitHub — not Redeploy-only).
4. Confirm [Workwear](https://www.bossworkwear.au/categories/workwear) lists products and Admin Dashboard has no red catalog banner.

## Required Vercel variables

| Variable | Used by |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Storefront categories, product pages, cart |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same (public read) |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin, CRM, stock, uploads |
| `CRON_SECRET` | Catalog health cron + other crons |
| `RESEND_API_KEY` | Catalog alert emails (optional but recommended) |

## Manual health check

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://www.bossworkwear.au/api/cron/storefront-catalog-health
```

Expect `"ok": true` and `productCount` in the hundreds/thousands.
