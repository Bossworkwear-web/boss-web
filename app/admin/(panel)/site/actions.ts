"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertAdminSessionForPathSegment } from "@/lib/admin-auth";
import {
  HOMEPAGE_HERO_LINE1_KEY,
  HOMEPAGE_HERO_LINE2_KEY,
  HOMEPAGE_HERO_SUBTEXT_KEY,
  LEGAL_PAGE_PATHS,
  LEGAL_PAGE_SLUGS,
  legalPageContentKey,
  type LegalPageSlug,
} from "@/lib/site-content";
import { createSupabaseAdminClient } from "@/lib/supabase";

function isLegalSlug(raw: string): raw is LegalPageSlug {
  return (LEGAL_PAGE_SLUGS as readonly string[]).includes(raw);
}

async function upsertSiteContent(key: string, body: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("site_content").upsert(
    {
      key,
      body,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function saveHomepageHeroContent(formData: FormData): Promise<void> {
  try {
    await assertAdminSessionForPathSegment("/admin/site");
  } catch {
    redirect("/admin/login");
  }

  const line1 = String(formData.get("line1") ?? "").trim();
  const line2 = String(formData.get("line2") ?? "").trim();
  const subtext = String(formData.get("subtext") ?? "").trim();

  if (!line1 || !line2 || !subtext) {
    redirect("/admin/site?error=missing_hero_fields");
  }

  const results = await Promise.all([
    upsertSiteContent(HOMEPAGE_HERO_LINE1_KEY, line1),
    upsertSiteContent(HOMEPAGE_HERO_LINE2_KEY, line2),
    upsertSiteContent(HOMEPAGE_HERO_SUBTEXT_KEY, subtext),
  ]);

  const failed = results.find((r) => !r.ok);
  if (failed && !failed.ok) {
    const msg = failed.error.includes("site_content")
      ? "Run supabase/migrations/20260525_site_content.sql in Supabase, then try again."
      : failed.error;
    redirect(`/admin/site?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/");
  revalidatePath("/admin/site");
  redirect("/admin/site?saved=hero");
}

export async function saveLegalPageContent(formData: FormData): Promise<void> {
  try {
    await assertAdminSessionForPathSegment("/admin/site");
  } catch {
    redirect("/admin/login");
  }

  const slug = String(formData.get("slug") ?? "").trim();
  if (!isLegalSlug(slug)) {
    redirect("/admin/site/legal?error=invalid_slug");
  }

  const body = String(formData.get("body") ?? "");
  const clear = formData.get("clear") === "1";

  if (clear) {
    const supabase = createSupabaseAdminClient();
    await supabase.from("site_content").delete().eq("key", legalPageContentKey(slug));
  } else {
    const trimmed = body.trim();
    if (!trimmed) {
      redirect(`/admin/site/legal/${slug}?error=empty_body`);
    }
    const saved = await upsertSiteContent(legalPageContentKey(slug), trimmed);
    if (!saved.ok) {
      const msg = saved.error.includes("site_content")
        ? "Run supabase/migrations/20260525_site_content.sql in Supabase, then try again."
        : saved.error;
      redirect(`/admin/site/legal/${slug}?error=${encodeURIComponent(msg)}`);
    }
  }

  revalidatePath(LEGAL_PAGE_PATHS[slug]);
  revalidatePath(`/admin/site/legal/${slug}`);
  revalidatePath("/admin/site/legal");
  redirect(`/admin/site/legal/${slug}?saved=1`);
}
