"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase";

export type SubmitOrderProofDecisionResult =
  | { ok: true; status: "approved" | "declined" }
  | { ok: false; error: string };

/**
 * No-login customer decision on a proof round, authorised by the opaque token from the email link.
 * Only a proof still in `sent` status can be decided.
 */
export async function submitOrderProofDecision(
  storeOrderId: string,
  token: string,
  decision: "approve" | "decline",
  comment: string,
): Promise<SubmitOrderProofDecisionResult> {
  const id = (storeOrderId ?? "").trim();
  const tok = (token ?? "").trim();
  if (!id || !tok) {
    return { ok: false, error: "This link is missing its token." };
  }

  const nextStatus = decision === "approve" ? "approved" : "declined";
  const trimmedComment = (comment ?? "").trim().slice(0, 2000);

  if (decision === "decline" && !trimmedComment) {
    return { ok: false, error: "Please tell us what to change before requesting changes." };
  }

  try {
    const supabase = createSupabaseAdminClient();

    const { data: row, error } = await supabase
      .from("order_proofs")
      .select("id, status, token")
      .eq("store_order_id", id)
      .eq("token", tok)
      .maybeSingle();
    if (error) {
      return { ok: false, error: error.message };
    }
    if (!row) {
      return { ok: false, error: "This link is invalid or has expired." };
    }
    if (row.status !== "sent") {
      return { ok: false, error: "This proof has already been answered." };
    }

    const { error: upErr } = await supabase
      .from("order_proofs")
      .update({
        status: nextStatus,
        decided_at: new Date().toISOString(),
        customer_comment: trimmedComment || null,
      })
      .eq("id", row.id)
      .eq("status", "sent");
    if (upErr) {
      return { ok: false, error: upErr.message };
    }

    revalidatePath(`/admin/production/${id}`);
    revalidatePath("/customer");
    return { ok: true, status: nextStatus };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save your decision.";
    return { ok: false, error: msg };
  }
}
