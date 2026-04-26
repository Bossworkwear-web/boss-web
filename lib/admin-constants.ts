/**
 * Cookie name set after successful admin login (httpOnly).
 * If renamed, update the duplicate in root `middleware.ts` (Vercel Edge cannot import `@/lib/...` there).
 */
export const ADMIN_SESSION_COOKIE = "boss_admin_session";

/** Human identifier (email/name) chosen at login (httpOnly). */
export const ADMIN_USER_COOKIE = "boss_admin_user";

/** Seconds until admin session expires (7 days). */
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7;
