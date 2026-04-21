"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

function cleanIdentifier(raw: string): string {
  return raw.trim();
}

function cleanRole(raw: string): string {
  const r = raw.trim().toLowerCase();
  if (r === "owner" || r === "admin" || r === "manager" || r === "office_team" || r === "warehouse_team") return r;
  return "admin";
}

function boolFromForm(formData: FormData, key: string): boolean {
  return (formData.get(key) ?? "").toString() === "true";
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

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("admin_access_users").insert({
    identifier,
    role: cleanRole((formData.get("role") ?? "admin").toString()),
    is_active: boolFromForm(formData, "is_active"),
  });

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

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("admin_access_users")
    .update({
      identifier,
      role: cleanRole((formData.get("role") ?? "admin").toString()),
      is_active: boolFromForm(formData, "is_active"),
    })
    .eq("id", id);

  if (error) {
    const short = error.message.length > 600 ? `${error.message.slice(0, 600)}…` : error.message;
    redirect(`/admin/accounting/access-control?error=${encodeURIComponent(short)}`);
  }

  revalidatePath("/admin/accounting/access-control");
  redirect("/admin/accounting/access-control?updated=1");
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

