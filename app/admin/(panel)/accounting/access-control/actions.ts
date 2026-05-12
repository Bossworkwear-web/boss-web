"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertAdminSession } from "@/lib/admin-auth";
import { hashAdminUserPassword } from "@/lib/admin-user-password-hash";
import { createSupabaseAdminClient } from "@/lib/supabase";

const MIN_PASSWORD_LEN = 8;

function cleanIdentifier(raw: string): string {
  return raw.trim();
}

function cleanRole(raw: string): string {
  const r = raw.trim().toLowerCase();
  if (r === "owner") return "admin";
  if (r === "office_team") return "production_team";
  if (r === "admin" || r === "manager" || r === "production_team" || r === "warehouse_team") return r;
  return "admin";
}

function boolFromForm(formData: FormData, key: string): boolean {
  return (formData.get(key) ?? "").toString() === "true";
}

type PasswordRead =
  | { kind: "none" }
  | { kind: "error"; code: "password_incomplete" | "password_mismatch" | "password_short" }
  | { kind: "hash"; value: string };

function readOptionalNewPassword(formData: FormData): PasswordRead {
  const np = (formData.get("new_password") ?? "").toString().trim();
  const cp = (formData.get("confirm_password") ?? "").toString().trim();
  if (!np && !cp) return { kind: "none" };
  if (!np || !cp) return { kind: "error", code: "password_incomplete" };
  if (np !== cp) return { kind: "error", code: "password_mismatch" };
  if (np.length < MIN_PASSWORD_LEN) return { kind: "error", code: "password_short" };
  return { kind: "hash", value: hashAdminUserPassword(np) };
}

export async function createAdminAccessUser(formData: FormData): Promise<void> {
  try {
    await assertAdminSession();
  } catch {
    redirect("/admin/login");
  }

  const identifier = cleanIdentifier((formData.get("identifier") ?? "").toString());
  if (!identifier) {
    redirect("/admin/accounting/access-control?error=missing_identifier");
  }

  const pw = readOptionalNewPassword(formData);
  if (pw.kind === "error") {
    redirect(`/admin/accounting/access-control?error=${pw.code}`);
  }

  const supabase = createSupabaseAdminClient();
  const insert: {
    identifier: string;
    role: string;
    is_active: boolean;
    password_hash?: string;
  } = {
    identifier,
    role: cleanRole((formData.get("role") ?? "admin").toString()),
    is_active: boolFromForm(formData, "is_active"),
  };
  if (pw.kind === "hash") {
    insert.password_hash = pw.value;
  }

  const { error } = await supabase.from("admin_access_users").insert(insert);

  if (error) {
    const short = error.message.length > 600 ? `${error.message.slice(0, 600)}…` : error.message;
    redirect(`/admin/accounting/access-control?error=${encodeURIComponent(short)}`);
  }

  revalidatePath("/admin/accounting/access-control");
  redirect("/admin/accounting/access-control?created=1");
}

export async function updateAdminAccessUser(formData: FormData): Promise<void> {
  try {
    await assertAdminSession();
  } catch {
    redirect("/admin/login");
  }

  const id = (formData.get("id") ?? "").toString().trim();
  const identifier = cleanIdentifier((formData.get("identifier") ?? "").toString());
  if (!id || !identifier) {
    redirect("/admin/accounting/access-control?error=invalid_row");
  }

  const pw = readOptionalNewPassword(formData);
  if (pw.kind === "error") {
    redirect(`/admin/accounting/access-control?error=${pw.code}`);
  }

  const supabase = createSupabaseAdminClient();
  const update: {
    identifier: string;
    role: string;
    is_active: boolean;
    password_hash?: string;
  } = {
    identifier,
    role: cleanRole((formData.get("role") ?? "admin").toString()),
    is_active: boolFromForm(formData, "is_active"),
  };
  if (pw.kind === "hash") {
    update.password_hash = pw.value;
  }

  const { error } = await supabase.from("admin_access_users").update(update).eq("id", id);

  if (error) {
    const short = error.message.length > 600 ? `${error.message.slice(0, 600)}…` : error.message;
    redirect(`/admin/accounting/access-control?error=${encodeURIComponent(short)}`);
  }

  revalidatePath("/admin/accounting/access-control");
  redirect("/admin/accounting/access-control?updated=1");
}

export async function clearAdminAccessUserPassword(formData: FormData): Promise<void> {
  try {
    await assertAdminSession();
  } catch {
    redirect("/admin/login");
  }

  const id = (formData.get("id") ?? "").toString().trim();
  if (!id) {
    redirect("/admin/accounting/access-control?error=invalid_row");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("admin_access_users").update({ password_hash: null }).eq("id", id);

  if (error) {
    const short = error.message.length > 600 ? `${error.message.slice(0, 600)}…` : error.message;
    redirect(`/admin/accounting/access-control?error=${encodeURIComponent(short)}`);
  }

  revalidatePath("/admin/accounting/access-control");
  redirect("/admin/accounting/access-control?password_cleared=1");
}

export async function deleteAdminAccessUser(formData: FormData): Promise<void> {
  try {
    await assertAdminSession();
  } catch {
    redirect("/admin/login");
  }

  const id = (formData.get("id") ?? "").toString().trim();
  if (!id) {
    redirect("/admin/accounting/access-control?error=invalid_row");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("admin_access_users").delete().eq("id", id);

  if (error) {
    const short = error.message.length > 600 ? `${error.message.slice(0, 600)}…` : error.message;
    redirect(`/admin/accounting/access-control?error=${encodeURIComponent(short)}`);
  }

  revalidatePath("/admin/accounting/access-control");
  redirect("/admin/accounting/access-control?deleted=1");
}
