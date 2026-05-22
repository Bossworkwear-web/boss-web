# Xero integration (Boss Workwear)

Automatic sales invoices from online store orders. Built in phases; **phase 1** is OAuth connect only.

## Phase 1 (this release)

- Admin → **Accounting** → **Connect to Xero**
- Tokens stored in Supabase `xero_connections` (service role only)
- `store_orders` columns reserved for phase 2 sync (`xero_invoice_number`, etc.)

Invoice numbers will be **assigned by Xero** when invoices are created in phase 2 (not generated on the website).

## 1. Create a Xero app

1. Go to [Xero Developer](https://developer.xero.com/app/manage) → **New app**
2. Integration type: **Web app**
3. Company or application URL: `https://www.bossworkwear.au` (or your staging URL)
4. **OAuth 2.0 redirect URI** (must match exactly):

   ```
   https://www.bossworkwear.au/api/xero/callback
   ```

   Local dev (optional):

   ```
   http://localhost:3000/api/xero/callback
   ```

5. Copy **Client id** and **Client secret**

## 2. Environment variables

Add to Vercel (Production + Preview if needed) and `.env.local`:

```env
XERO_CLIENT_ID=
XERO_CLIENT_SECRET=
# Optional override (defaults to NEXT_PUBLIC_SITE_URL + /api/xero/callback)
# XERO_REDIRECT_URI=https://www.bossworkwear.au/api/xero/callback
```

`NEXT_PUBLIC_SITE_URL` must match the live site origin (no trailing slash).

## 3. Database migration

Run in Supabase SQL Editor:

`supabase/sql-editor/xero_integration.sql`

Or apply migration `20260521_xero_integration.sql` via CLI.

Then **Settings → API → Reload schema**.

## 4. Connect in admin

1. Deploy with env vars set
2. Sign in to **Admin** → **Accounting**
3. Click **Connect to Xero** and authorise your organisation
4. Confirm status shows tenant name and “Connected”

## Scopes requested (phase 1 Connect)

- `openid`, `profile`, `email`, `offline_access` (refresh token)
- `accounting.settings.read`, `accounting.contacts`

`accounting.invoices` is added on upgrade (replaces legacy `accounting.transactions` on new Xero apps).

If Connect shows `unauthorized_client`, confirm Client id start/end match Xero and redeploy after env changes.

## Phase 2 — automatic invoices (deployed)

After a **paid** Stripe order:

1. Create or match Xero **contact** (customer email)
2. Create **AUTHORISED** sales invoice (GST-inclusive line amounts)
3. Save `xero_invoice_number` and copy to `invoice_reference` for tax invoice PDFs
4. Mention invoice number in the order confirmation email (when sync succeeds)

### Extra setup

1. **Upgrade connection** — Accounting → **Upgrade Xero for invoices & payments** (adds `accounting.invoices` and `accounting.payments`). Required once after phase 1 connect. Payments need the separate `accounting.payments` scope (invoice-only upgrade is not enough for Paid status).
2. **Sales account code** — In Vercel / `.env.local`:

   ```env
   XERO_SALES_ACCOUNT_CODE=200
   ```

   Use the **Account code** for sales/revenue in Xero → Accounting → Chart of accounts (often `200`).

3. Admin **retry**: `POST /api/admin/xero/sync-order` with JSON `{ "orderId": "<uuid>" }`.

Orders without invoice permission stay `xero_sync_status=skipped` until you upgrade and retry.

## Phase 3 — Paid in Xero + refund credit notes

After the sales invoice is created:

1. Record a **payment** on the invoice (same total as the order) so Xero shows **Paid**, not “Awaiting payment”.
2. On **Stripe refund** (admin), create an **ACCRECCREDIT** credit note allocated to that invoice.

### Extra env

```env
XERO_BANK_ACCOUNT_CODE=090
```

Use the **Account code** of the bank account you use for Stripe settlements (Xero → Accounting → Chart of accounts → type Bank). Common codes vary by organisation (not always `090`).

### Database

Run `supabase/sql-editor/xero_payments_refunds.sql` (or migration `20260522_xero_payments_refunds.sql`), then reload schema.

### Backfill existing orders

For orders already invoiced in Xero (e.g. still “Awaiting payment”):

1. Set `XERO_BANK_ACCOUNT_CODE` on Vercel and redeploy.
2. Admin: `POST /api/admin/xero/sync-order` with `{ "orderId": "<uuid>" }` — records payment if the invoice exists.

Refunds after phase 3 create credit notes automatically; check `xero_credit_notes` on the order if sync fails (`xero_refund_sync_error`).

## Troubleshooting

| Issue | Fix |
|--------|-----|
| `invalid_client` | Check client id/secret and redirect URI in Xero app |
| `Invalid OAuth state` | Connect again from Accounting (don’t open callback URL directly) |
| Table `xero_connections` missing | Run SQL migration above |
| Connect button missing | Set `XERO_CLIENT_ID` and `XERO_CLIENT_SECRET`, redeploy |
| Invoice “Awaiting payment” in Xero | Set `XERO_BANK_ACCOUNT_CODE`, run sync-order for that order |
| `XERO_BANK_ACCOUNT_CODE is not set` | Add bank account code from Chart of accounts |
| Xero API `401 Unauthorized` on payment | Accounting → **Upgrade Xero for payments** (`accounting.payments`), then retry sync-order |
