import { PromotionAdminClient, type PromotionAdminRow } from "./promotion-admin-client";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Search = {
  created?: string;
  updated?: string;
  sent?: string;
  error?: string;
};

export default async function AdminPromotionPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const q = await searchParams;
  let rows: PromotionAdminRow[] = [];
  let loadError: string | null = null;

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("promotion_codes")
      .select(
        "id, code, description, discount_type, discount_value, min_subtotal_aud, starts_at, ends_at, max_redemptions, redemption_count, max_redemptions_per_customer, status, sent_to_email, sent_at, created_at, updated_at",
      )
      .order("created_at", { ascending: false });

    if (error) {
      loadError = error.message.includes("promotion_codes")
        ? `${error.message} — Apply supabase/migrations/20260518_promotion_codes.sql in Supabase SQL Editor, then refresh the API schema.`
        : error.message;
    } else {
      rows = (data ?? []).map((r) => ({
        ...r,
        discount_value: Number(r.discount_value),
        min_subtotal_aud: Number(r.min_subtotal_aud),
      })) as PromotionAdminRow[];
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load promotion codes.";
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-brand-navy">Promotion</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Create and manage checkout discount codes. Customers apply codes on the payment page before paying with
          card.
        </p>
      </header>

      {q.created ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Promotion code created.
        </p>
      ) : null}
      {q.updated ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Promotion code updated.
        </p>
      ) : null}
      {q.sent ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
          Send recorded for this code.
        </p>
      ) : null}
      {q.error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{q.error}</p>
      ) : null}
      {loadError ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{loadError}</p>
      ) : null}

      <PromotionAdminClient rows={rows} />
    </div>
  );
}
