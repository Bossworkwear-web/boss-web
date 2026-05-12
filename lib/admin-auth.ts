import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { findActiveAdminAccessUserByIdentifier } from "@/lib/admin-access-users";
import { ADMIN_SESSION_COOKIE, ADMIN_USER_COOKIE } from "@/lib/admin-constants";
import {
  defaultLandingPathForPortalAccess,
  isAdminPathAllowedForPortalAccess,
  type AdminPortalNavAccess,
  portalNavAccessFromRole,
} from "@/lib/admin-portal-permissions";
import { createSupabaseAdminClient } from "@/lib/supabase";

export async function isAdminSession(): Promise<boolean> {
  const c = await cookies();
  return c.get(ADMIN_SESSION_COOKIE)?.value === "1";
}

export async function getAdminUser(): Promise<string | null> {
  const c = await cookies();
  const raw = (c.get(ADMIN_USER_COOKIE)?.value ?? "").trim();
  return raw.length ? raw : null;
}

export async function isAccessControlEnabled(): Promise<boolean> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("admin_access_users")
      .select("id")
      .eq("is_active", true)
      .limit(1);
    if (error) {
      return false;
    }
    return (data ?? []).length > 0;
  } catch {
    return false;
  }
}

export async function assertAdminSession(): Promise<void> {
  if (!(await isAdminSession())) {
    throw new Error("Unauthorized");
  }

  // Optional allowlist enforcement. Safety: if the table doesn't exist or is empty, do not block.
  if (!(await isAccessControlEnabled())) {
    return;
  }

  const user = await getAdminUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  try {
    const supabase = createSupabaseAdminClient();
    const row = await findActiveAdminAccessUserByIdentifier(supabase, user);
    if (!row?.id) {
      throw new Error("Unauthorized");
    }
  } catch {
    throw new Error("Unauthorized");
  }
}

/** When access control is off, everyone is full portal. When on, uses DB role for production/warehouse restrictions. */
export async function resolveAdminPortalNavAccess(): Promise<AdminPortalNavAccess> {
  if (!(await isAccessControlEnabled())) {
    return { mode: "full" };
  }
  const user = await getAdminUser();
  if (!user) {
    return { mode: "full" };
  }
  try {
    const supabase = createSupabaseAdminClient();
    const row = await findActiveAdminAccessUserByIdentifier(supabase, user);
    if (!row) {
      return { mode: "full" };
    }
    return portalNavAccessFromRole(row.role);
  } catch {
    return { mode: "full" };
  }
}

/** Server layout: redirect restricted roles away from disallowed admin paths. */
export async function assertAdminPortalPath(pathname: string, access: AdminPortalNavAccess): Promise<void> {
  if (access.mode === "full") {
    return;
  }
  if (!pathname.startsWith("/admin")) {
    redirect(defaultLandingPathForPortalAccess(access));
  }
  if (pathname === "/admin") {
    redirect(defaultLandingPathForPortalAccess(access));
  }
  if (isAdminPathAllowedForPortalAccess(access, pathname)) {
    return;
  }
  redirect(defaultLandingPathForPortalAccess(access));
}

/** Server actions for a fixed admin section — throws if role cannot access that segment. */
export async function assertAdminSessionForPathSegment(pathPrefix: string): Promise<void> {
  await assertAdminSession();
  const access = await resolveAdminPortalNavAccess();
  if (access.mode === "full") {
    return;
  }
  if (isAdminPathAllowedForPortalAccess(access, pathPrefix)) {
    return;
  }
  throw new Error("Unauthorized");
}
