import { cookies } from "next/headers";

import { ADMIN_SESSION_COOKIE, ADMIN_USER_COOKIE } from "@/lib/admin-constants";
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

async function isAccessControlEnabled(): Promise<boolean> {
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
    const { data, error } = await supabase
      .from("admin_access_users")
      .select("id")
      .eq("identifier", user)
      .eq("is_active", true)
      .maybeSingle();
    if (error || !data?.id) {
      throw new Error("Unauthorized");
    }
  } catch {
    throw new Error("Unauthorized");
  }
}
