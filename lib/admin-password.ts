/**
 * Resolves the expected admin password for login API.
 * - Production: BOSS_ADMIN_PASSWORD is required.
 * - Development: if unset, defaults to "dev-admin" so you can test in the browser without .env.
 */
export function getExpectedAdminPassword(): string | null {
  const custom = process.env.BOSS_ADMIN_PASSWORD?.trim();
  if (custom) {
    return custom;
  }
  if (process.env.NODE_ENV === "development") {
    return "dev-admin";
  }
  return null;
}
