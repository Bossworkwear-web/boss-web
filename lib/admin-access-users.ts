import type { createSupabaseAdminClient } from "@/lib/supabase";

export type AdminAccessUserForAuth = {
  id: string;
  identifier: string;
  role: string;
  password_hash: string | null;
};

/** Case-insensitive match against active rows (unique index is on lower(identifier)). */
export async function findActiveAdminAccessUserByIdentifier(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  rawIdentifier: string,
): Promise<AdminAccessUserForAuth | null> {
  const q = rawIdentifier.trim().toLowerCase();
  if (!q) return null;
  const { data, error } = await supabase
    .from("admin_access_users")
    .select("id, identifier, role, password_hash")
    .eq("is_active", true);
  if (error || !data?.length) return null;
  const row = data.find((r) => r.identifier.trim().toLowerCase() === q);
  if (!row) return null;
  const ph = row.password_hash;
  return {
    id: row.id,
    identifier: row.identifier,
    role: row.role.trim() || "admin",
    password_hash: ph && String(ph).trim() ? String(ph) : null,
  };
}
