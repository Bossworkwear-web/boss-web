## Supabase Setup

1. Update `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (optional, recommended for server-side inserts)
2. In Supabase SQL Editor, run `supabase/init.sql`.
3. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Admin panel

1. Start the app: `npm run dev`, then in your **browser** open [http://localhost:3000/admin](http://localhost:3000/admin) (or click **Admin** in the site footer).
2. You are sent to `/admin/login`. Enter your password:
   - **Local dev** (no `BOSS_ADMIN_PASSWORD` in `.env.local`): use **`dev-admin`**
   - **Production / custom**: set `BOSS_ADMIN_PASSWORD` in `.env.local` and use that value.
3. After sign-in you land on the **Dashboard** (`/admin`). Use the left menu for **Stock**, analytics, reports, supplier orders, site settings.

Sessions use an httpOnly cookie. Use HTTPS in production.

### Stock management

1. In Supabase SQL Editor, run `supabase/migrations/20260322_add_products_stock_quantity.sql` (adds `stock_quantity` to `products`).
2. Use **Dashboard → Open stock table** or **Admin → Stock** to edit quantities. Updates need **`SUPABASE_SERVICE_ROLE_KEY`** in `.env.local` (service role bypasses RLS for updates).

## Supplier orders (received lines)

1. Run `supabase/migrations/20260319_supplier_receipt_checks.sql` in the Supabase SQL Editor (creates `supplier_receipt_checks` for manual “goods received” checkboxes on **Admin → Supplier orders**).
2. Keep **`SUPABASE_SERVICE_ROLE_KEY`** set for admin saves (same as stock).

## CRM, pipeline & notifications

1. Run `supabase/migrations/20260320_crm_pipeline.sql` (adds pipeline columns on `quote_requests`, plus `crm_activities` and `crm_notification_log`).
2. **Admin → CRM & pipeline**: manage stages (enquiry → quote → approval → completion), follow-up dates, internal notes, link to `customer_profiles`, and view notification logs.
3. **Automated emails (optional)** — [Resend](https://resend.com): set `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. Customer confirmation + internal new-lead email fire after `/quote` submits when keys are set.
4. **Internal alerts**: set `CRM_INTERNAL_NOTIFY_EMAIL` to receive new lead emails.
5. **SMS (optional)** — Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`. SMS only sends if the phone field looks like E.164 (starts with `+`).
6. **Cron / automation**: set `CRON_SECRET` in production and send `Authorization: Bearer $CRON_SECRET`.
   - `GET /api/cron/crm-followups` — overdue CRM follow-ups (JSON for Zapier/n8n).
   - `GET /api/cron/supplier-order-day` — every day at **8:30 AM Australia/Perth** (scheduled in `vercel.json` as `30 0 * * *` UTC), inserts **one empty** `supplier_order_lines` row for **today’s Perth `list_date`** only if that day has **no rows yet** (starter line for Admin → Supplier orders). On other hosts, call the same URL on your own scheduler.

**Unified areas:** Sales funnel KPIs and lead exports are **not** duplicated — use **CRM** for pipeline + CSV export; **Analytics** is for traffic; **Reports** describes future scheduled reports.

## What Is Included

- `lib/supabase.ts`: Supabase client/admin client helpers
- `lib/database.types.ts`: basic table types (`products`, `embroidery_positions`)
- `supabase/init.sql`: table creation + initial seed data
- `app/page.tsx`: simple UI to list/add products and embroidery positions
