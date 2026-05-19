# Supabase Auth (Google, Microsoft, Apple)

Storefront customer login uses **Supabase Auth** plus `customer_profiles.auth_user_id`.

## 1. Database migration

Run in Supabase SQL Editor (or apply migration):

`supabase/migrations/20260520_customer_profiles_auth_user_id.sql`

## 2. Supabase Dashboard → Authentication

### URL configuration

Add **Redirect URLs**:

- `http://localhost:3000/auth/callback`
- `https://bossworkwear.au/auth/callback`
- (Preview) `https://<your-vercel-preview>.vercel.app/auth/callback`

**Site URL:** `https://bossworkwear.au`

### Email auth

- Enable **Email** provider.
- For smoother signup, consider **Confirm email** off (or customers must confirm before checkout).

### Google

1. Authentication → Providers → **Google** → Enable.
2. Create OAuth client in [Google Cloud Console](https://console.cloud.google.com/) (Web application).
3. Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`

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
