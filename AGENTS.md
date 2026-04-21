<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Backlog (do when related work appears)

### `ISSUE:customer-password-reset`

- **Today:** The “Lost password?” block on `app/log-in/page.tsx` only points users to `/contact-us`. There is no email link or token-based reset; email/password accounts use `customer_profiles.login_password` (plain string in DB).
- **When you touch this:** Customer login, `submitLogIn`, password fields, transactional email (e.g. Resend), or account recovery — **remind the user this issue exists**, then implement and **close the loop**: secure reset (e.g. signed time-limited token + one-use link, email via existing mail stack, update `customer_profiles`), and replace or tighten the contact-only copy once the flow works.
- **Find anchors in code:** search the repo for `ISSUE:customer-password-reset`.
