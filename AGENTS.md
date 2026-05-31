<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Boss Workwear — boss-web

Next.js 16 + React 19 + Tailwind v4 storefront and admin panel for a workwear/uniform business. Data in Supabase (Postgres + Auth + Storage). Payments via Stripe. Accounting sync via Xero. Email via Resend. Deployed on Vercel (push to `main` auto-deploys). Store timezone is **Australia/Perth** (pinned in build/test scripts).

## Repo map

- `app/` — routes, pages, layouts, and server actions (`actions.ts`, `"use server"`).
  - `app/cart/` — cart + "Send email to you as a Quote" flow (`quote-actions.ts`).
  - `app/customer/` — "My account", including "My Quote" (live-repriced saved quotes).
  - `app/products/`, `app/categories/` — PDPs and category/subcategory browsing.
  - `app/admin/(panel)/` — backoffice (stock, store orders, customer quote sheet, etc.).
  - `app/log-in/`, `app/reset-password/` — customer auth + password reset.
- `lib/` — shared logic. Key files:
  - `product-price.ts`, `discounts.ts`, `storefront-volume-discount.ts`, `storefront-cart-checkout-fees.ts`, `storefront-special-deal-packages.ts`, `customer-quote-pricing.ts` — **pricing** (see `.cursor/rules/pricing.mdc`).
  - `supabase/` + `supabase.ts` — DB clients (see `.cursor/rules/supabase.mdc`).
  - `customer-auth.ts`, `customer-password-hash.ts` — auth helpers.
  - `xero/` — Xero OAuth + quote/invoice/payment sync.
  - `latin-input.ts` — non-Latin input guard (see `.cursor/rules/forms-input.mdc`).
  - `database.types.ts` — generated Supabase types; keep in sync with schema.
- `scripts/` — node maintenance/import/codegen scripts (supplier imports, SKU/title generation, backups). `prebuild`/`predev` run codegen here; edit the generator, not its output.
- `data/` — supplier catalog source data.
- `supabase/migrations/` — schema migrations; `supabase/sql-editor/` — mirror of hand-run SQL.

## Key data flows

- **Cart → Quote → My Account:** cart lines are snapshotted into `customer_quotes` (with per-line `productBaseUnit`) and emailed via Resend. On "My account → My Quote" and on reorder, `repriceQuoteLines` recomputes product prices live from the DB (decoration extras preserved) and re-applies volume discounts; an "Updated" badge shows when prices moved. Saved-quote prices are indicative, not guaranteed (T&C §7).
- **Checkout:** Stripe checkout → `fulfill-stripe-checkout-order.ts` / `place-store-order-core.ts` → order rows + invoice email; Xero sync via `lib/xero/sync-store-order*.ts`.
- **Xero quotes/invoices:** GST is **Exclusive** (on top). See `.cursor/rules/pricing.mdc`.

## Commands

- Dev: `npm run dev` (runs codegen first). Build: `npm run build`. Lint: `npm run lint`.
- Unit tests (Vitest): `npm run test:run`. E2E (Playwright): `npm run test:e2e`.
- After non-trivial changes, run `npm run lint` and `npm run test:run` before committing.
- Backups: see `.cursor/rules/backup-google-drive.mdc`.

## Guardrails

- Only commit when the user explicitly asks. Never commit `.env.local` or `SUPABASE_SERVICE_ROLE_KEY`.
- Keep money in **cents** for persisted values; reuse pricing helpers — never hand-roll GST/markup/discount math.
- Respect `Australia/Perth` for any date/time logic.
- `.cursor/hooks.json` auto-fixes lint on edited files and asks before reading secret files.

## Backlog (do when related work appears)

_None open. (Resolved 2026-05-31: `ISSUE:customer-password-reset` — customer auth now uses Supabase Auth as the source of truth; `/reset-password` page + "Send reset email" flow exist; legacy `customer_profiles.login_password` is migrated to Auth on next login and then nulled. No plaintext password reset path remains to build.)_
