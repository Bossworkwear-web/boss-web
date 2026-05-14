/** Path prefixes allowed when access control is on and role is restricted. */

const PRODUCTION_TEAM_PREFIXES = [
  "/admin/work-process",
  "/admin/click-up-sheet",
  "/admin/incoming-goods",
  "/admin/production",
  "/admin/quality-control",
] as const;

const WAREHOUSE_TEAM_PREFIXES = [
  "/admin/incoming-goods",
  "/admin/dispatch",
  "/admin/complete-orders",
  "/admin/warehouse",
  "/admin/clearance-stock",
] as const;

export type RestrictedPortalRole = "production_team" | "warehouse_team";

export type AdminPortalNavAccess =
  | { mode: "full" }
  | { mode: "restricted"; role: RestrictedPortalRole };

function normalizePortalRole(role: string | null | undefined): string {
  const r = String(role ?? "admin").trim().toLowerCase();
  if (r === "office_team") return "production_team";
  return r;
}

export function isRestrictedPortalRole(role: string): role is RestrictedPortalRole {
  const n = normalizePortalRole(role);
  return n === "production_team" || n === "warehouse_team";
}

export function portalNavAccessFromRole(role: string | null | undefined): AdminPortalNavAccess {
  const n = normalizePortalRole(role);
  if (n === "production_team" || n === "warehouse_team") {
    return { mode: "restricted", role: n };
  }
  return { mode: "full" };
}

export function isAdminPathAllowedForPortalAccess(access: AdminPortalNavAccess, pathname: string): boolean {
  if (access.mode === "full") return true;
  const prefixes = access.role === "production_team" ? PRODUCTION_TEAM_PREFIXES : WAREHOUSE_TEAM_PREFIXES;
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function defaultLandingPathForPortalAccess(access: AdminPortalNavAccess): string {
  if (access.mode === "full") return "/admin";
  return access.role === "production_team" ? "/admin/work-process" : "/admin/incoming-goods";
}

export function isAdminPathAllowedForRole(role: string, pathname: string): boolean {
  return isAdminPathAllowedForPortalAccess(portalNavAccessFromRole(role), pathname);
}
