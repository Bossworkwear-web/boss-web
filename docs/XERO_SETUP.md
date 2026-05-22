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

`accounting.transactions` is added before phase 2 automatic invoices (may require disconnect + reconnect).

If Connect shows `unauthorized_client`, confirm Client id start/end match Xero and redeploy after env changes.

## Phase 2 (planned)

After Stripe payment: create/update Xero contact, create **AUTHORISED** sales invoice, store `xero_invoice_number` on the order and copy to `invoice_reference` for PDFs, email customer.

## Troubleshooting

| Issue | Fix |
|--------|-----|
| `invalid_client` | Check client id/secret and redirect URI in Xero app |
| `Invalid OAuth state` | Connect again from Accounting (don’t open callback URL directly) |
| Table `xero_connections` missing | Run SQL migration above |
| Connect button missing | Set `XERO_CLIENT_ID` and `XERO_CLIENT_SECRET`, redeploy |
