import { createSupabaseAdminClient } from "@/lib/supabase";
import { refreshXeroAccessToken } from "@/lib/xero/oauth";

export type XeroConnectionRow = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scopes: string | null;
  created_at: string;
  updated_at: string;
};

export type XeroConnectionPublic = Pick<
  XeroConnectionRow,
  "id" | "tenant_id" | "tenant_name" | "expires_at" | "scopes" | "updated_at"
>;

function expiresSoon(iso: string, bufferSeconds = 120): boolean {
  const ms = new Date(iso).getTime() - Date.now();
  return ms < bufferSeconds * 1000;
}

export async function getActiveXeroConnection(): Promise<XeroConnectionRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("xero_connections")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01" || error.message.includes("does not exist")) {
      return null;
    }
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as XeroConnectionRow;
  if (!expiresSoon(row.expires_at)) {
    return row;
  }

  return refreshAndPersistConnection(row);
}

export async function refreshAndPersistConnection(row: XeroConnectionRow): Promise<XeroConnectionRow> {
  const tokens = await refreshXeroAccessToken(row.refresh_token);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("xero_connections")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      scopes: tokens.scope ?? row.scopes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as XeroConnectionRow;
}

export async function saveXeroConnection(input: {
  tenantId: string;
  tenantName: string;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  scopes?: string;
}): Promise<XeroConnectionRow> {
  const supabase = createSupabaseAdminClient();
  const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000).toISOString();
  const now = new Date().toISOString();

  await supabase.from("xero_connections").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const { data, error } = await supabase
    .from("xero_connections")
    .upsert(
      {
        tenant_id: input.tenantId,
        tenant_name: input.tenantName,
        access_token: input.accessToken,
        refresh_token: input.refreshToken,
        expires_at: expiresAt,
        scopes: input.scopes ?? null,
        updated_at: now,
      },
      { onConflict: "tenant_id" },
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as XeroConnectionRow;
}

export async function clearXeroConnection(): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("xero_connections").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (error) {
    throw new Error(error.message);
  }
}

export function toPublicConnection(row: XeroConnectionRow): XeroConnectionPublic {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    tenant_name: row.tenant_name,
    expires_at: row.expires_at,
    scopes: row.scopes,
    updated_at: row.updated_at,
  };
}
