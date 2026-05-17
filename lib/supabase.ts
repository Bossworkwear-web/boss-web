import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return url;
}

function getSupabaseAnonKey() {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!anonKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return anonKey;
}

export function createSupabaseClient() {
  return createClient<Database>(getSupabaseUrl(), getSupabaseAnonKey());
}

export function createSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) {
    const onHostedProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
    if (onHostedProd) {
      throw new Error(
        "Missing SUPABASE_SERVICE_ROLE_KEY. Add it in Vercel → Settings → Environment Variables (Production), then redeploy.",
      );
    }
  }

  const key = serviceRoleKey ?? getSupabaseAnonKey();

  return createClient<Database>(getSupabaseUrl(), key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
