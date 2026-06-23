# Supabase Auth (Google, Microsoft, Apple)

Storefront customer login uses **Supabase Auth** plus `customer_profiles.auth_user_id`.

## 1. Database migration

Run in Supabase SQL Editor (or apply migration):

`supabase/migrations/20260520_customer_profiles_auth_user_id.sql`

## 2. Supabase Dashboard → Authentication

### URL configuration

Add **Redirect URLs**:

- `http://localhost:3000/auth/callback`
- `http://127.0.0.1:3000/auth/callback` (if you test with `127.0.0.1` in the browser)
- `https://bossworkwear.au/auth/callback`
- `https://www.bossworkwear.au/auth/callback` (site uses `www` in production)
- (Preview) `https://<your-vercel-preview>.vercel.app/auth/callback`

**Site URL:** `https://bossworkwear.au`

### Email auth

- Enable **Email** provider.
- For smoother signup, consider **Confirm email** off (or customers must confirm before checkout).

### Google

Google sign-in uses **your domain** (`bossworkwear.au`) on the Google account picker — not `*.supabase.co`. The app redirects to Google from `/api/auth/google/start` and returns to `/api/auth/google/callback` on the same host.

1. Authentication → Providers → **Google** → Enable (keep Client ID + Secret there for Supabase).
2. Create OAuth client in [Google Cloud Console](https://console.cloud.google.com/) (Web application) — **same client** as in Supabase.
3. **Authorized redirect URIs** (add all that apply):
   - `https://www.bossworkwear.au/api/auth/google/callback`
   - `https://bossworkwear.au/api/auth/google/callback`
   - `http://localhost:3000/api/auth/google/callback`
   - (optional legacy) `https://byzowxdjoexaisponcpo.supabase.co/auth/v1/callback`
4. **Authorized JavaScript origins:** `https://www.bossworkwear.au`, `https://bossworkwear.au`, `http://localhost:3000`
5. [Google Auth Platform → **Branding**](https://console.cloud.google.com/auth/branding) — app name **Boss Work Wear**, logo, homepage `https://www.bossworkwear.au`, privacy policy URL.
6. [Google Auth Platform → **Verification**](https://console.cloud.google.com/auth/verification) — add **Authorized domain** `bossworkwear.au` (verify in [Search Console](https://search.google.com/search-console)).

#### Environment (Vercel + `.env.local`)

Same OAuth client as Supabase Google provider:

- `GOOGLE_OAUTH_CLIENT_ID` — Web client ID
- `GOOGLE_OAUTH_CLIENT_SECRET` — Web client secret (server only; never `NEXT_PUBLIC_`)

Redeploy after adding env vars.

#### What customers see

With redirect URI on `bossworkwear.au`, Google shows **“Continue to bossworkwear.au”** (or `www.bossworkwear.au`) instead of `byzowxdjoexaisponcpo.supabase.co`.

#### Legacy note (Supabase-hosted Google OAuth)

If `GOOGLE_OAUTH_*` is missing, `/api/auth/google/start` fails open to log-in error. Microsoft still uses Supabase OAuth (`/auth/callback`).

Previously, redirect URI `https://<project-ref>.supabase.co/auth/v1/callback` caused Google to show the Supabase hostname ([Supabase #33387](https://github.com/supabase/supabase/issues/33387)). Brand verification alone does not fix that while the redirect stays on `supabase.co`.

**Optional (extra trust):** Supabase [custom domain](https://supabase.com/docs/guides/platform/custom-domains) e.g. `auth.bossworkwear.au` (Pro plan) — not required when using first-party Google callback above.

### Microsoft (Azure)

1. Authentication → Providers → **Azure** → Enable.
2. Register app in [Microsoft Entra](https://entra.microsoft.com/) → App registrations.
3. Redirect URI (Web): `https://<project-ref>.supabase.co/auth/v1/callback`
4. Allow personal Microsoft accounts if you want Outlook/Hotmail logins.

### Apple

1. [Apple Developer Program](https://developer.apple.com/) (paid membership).
2. Create **Services ID** + **Sign in with Apple** key.
3. Authentication → Providers → **Apple** → Enable and paste Client ID / secret / key.

## 3. Environment variables

Already required:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (legacy password migration on first email login)

Recommended:

- `NEXT_PUBLIC_SITE_URL=https://bossworkwear.au`
- `GOOGLE_OAUTH_CLIENT_ID` — same Web client ID as Supabase Google provider
- `GOOGLE_OAUTH_CLIENT_SECRET` — same secret (server-only; Vercel encrypted env)

## 4. Behaviour

| Flow | What happens |
|------|----------------|
| Google / Microsoft / Apple | OAuth → `/auth/callback` → link profile → home or **customer-details** if profile incomplete |
| Email sign up | `auth.signUp` → **customer-details** → profile row + `auth_user_id` |
| Email log in | `signInWithPassword`; existing `customer_profiles` passwords are migrated once via Admin API |
| Log out | `POST /api/auth/signout` + legacy cookies cleared |

Legacy cookies (`customer_email`, etc.) are still set so cart/checkout keep working during transition.

## 5. Vercel

Redeploy after Dashboard provider changes. No extra env vars per provider (secrets live in Supabase).
