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

1. Authentication → Providers → **Google** → Enable.
2. Create OAuth client in [Google Cloud Console](https://console.cloud.google.com/) (Web application).
3. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
4. Paste **your** Client ID + Client Secret into Supabase (do not rely on Supabase’s shared Google app — that shows `*.supabase.co` on the consent screen).

#### Google sign-in text: “Bossworkwear.au 서비스로 로그인”

If **App information** already shows **Boss Work Wear** + logo but Google still says **`byzowxdjoexaisponcpo.supabase.co 서비스로 로그인`**, that is **expected until Google approves brand verification** — not a Supabase or Next.js bug ([Supabase #33387](https://github.com/supabase/supabase/issues/33387), [Google auth docs](https://supabase.com/docs/guides/auth/social-login/auth-google)).

| What you did | What Google still shows | Why |
|--------------|-------------------------|-----|
| App name + logo on OAuth consent screen | Supabase project hostname | Redirect URI is `*.supabase.co`; Google shows that **until brand is verified** |
| Waited 24 hours | No change | Brand verification often takes **several business days**, not hours |

**Checklist (do in order):**

1. **Same Google Cloud project** for everything: OAuth **Client ID** in Supabase must be from the project where **Boss Work Wear** branding is configured.
2. Supabase → Authentication → Providers → **Google** → paste **your** Client ID + Secret (not empty). If empty, Supabase uses its shared Google app → always shows `*.supabase.co`.
3. **Match Client ID:** On the Google sign-in page, copy the URL query `client_id=…` and compare with [Credentials → OAuth 2.0 Client IDs](https://console.cloud.google.com/apis/credentials). Mismatch = wrong project or wrong Supabase entry.
4. [Google Auth Platform → **Branding**](https://console.cloud.google.com/auth/branding) — upload logo + app name (may differ from legacy “App information” screen). **Submit for brand verification.**
5. [Google Auth Platform → **Verification**](https://console.cloud.google.com/auth/verification) — complete app verification (homepage `https://www.bossworkwear.au`, privacy policy, scopes).
6. [Search Console](https://search.google.com/search-console) — verify domain **`bossworkwear.au`**; add it under OAuth **Authorized domains**.
7. **Authorized redirect URI** (Web client): `https://byzowxdjoexaisponcpo.supabase.co/auth/v1/callback`
8. **Authorized JavaScript origins:** `https://www.bossworkwear.au`, `https://bossworkwear.au`, `http://localhost:3000`

After Google **approves** brand verification, the consent headline should show **Boss Work Wear** (or your verified name), not the Supabase hostname.

**Optional (stronger trust):** Supabase [custom domain](https://supabase.com/docs/guides/platform/custom-domains) e.g. `auth.bossworkwear.au` so the redirect host is your domain (Pro plan). Brand verification is still required for the display name.

**While waiting:** Testing mode + test users still see the Supabase URL in many cases until verification completes.

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
