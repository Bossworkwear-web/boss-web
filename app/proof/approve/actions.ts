"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase";
import { parseProofImageUrls } from "@/lib/order-proof";

/** Bucket holding proof snapshots + uploaded logos (mirror of proof-actions PROOF_LOGO_BUCKET). */
const PROOF_BUCKET = "click-up-sheet-images";
/** Only proof-owned objects (snapshots / uploaded logos) are safe to delete on cleanup. */
const PROOF_OWNED_PREFIXES = ["order-proofs/", "proof-logos/"];

/** Extract the storage object path for our proof bucket from a public URL, or null if it's elsewhere. */
function proofBucketObjectPath(url: string): string | null {
  const marker = `/storage/v1/object/public/${PROOF_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i < 0) return null;
  let path = url.slice(i + marker.length).split("?")[0];
  try {
    path = decodeURIComponent(path);
  } catch {
    // keep as-is
  }
  return path || null;
}

/**
 * After approval, keep only the approved round and remove every earlier round for the order, deleting their
 * proof-owned snapshot/logo objects that the approved round doesn't also use. Best-effort: cleanup failures
 * never block the approval.
 */
async function pruneSupersededProofRounds(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  storeOrderId: string,
  approvedProofId: string,
): Promise<void> {
  try {
    const { data: rows } = await supabase
      .from("order_proofs")
      .select("id, image_urls")
      .eq("store_order_id", storeOrderId);
    if (!rows?.length) return;

    const approved = rows.find((r) => String(r.id) === approvedProofId);
    const others = rows.filter((r) => String(r.id) !== approvedProofId);
    if (others.length === 0) return;

    const keepPaths = new Set(
      parseProofImageUrls(approved?.image_urls)
        .map(proofBucketObjectPath)
        .filter((p): p is string => Boolean(p)),
    );

    const removePaths = new Set<string>();
    for (const r of others) {
      for (const url of parseProofImageUrls(r.image_urls)) {
        const path = proofBucketObjectPath(url);
        if (!path || keepPaths.has(path)) continue;
        if (PROOF_OWNED_PREFIXES.some((pre) => path.startsWith(pre))) {
          removePaths.add(path);
        }
      }
    }

    if (removePaths.size > 0) {
      await supabase.storage.from(PROOF_BUCKET).remove([...removePaths]).catch(() => undefined);
    }

    await supabase
      .from("order_proofs")
      .delete()
      .eq("store_order_id", storeOrderId)
      .neq("id", approvedProofId);
  } catch {
    // best-effort cleanup only
  }
}

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

    // On approval, keep only the approved round and purge earlier rounds + their unused snapshot images.
    if (nextStatus === "approved") {
      await pruneSupersededProofRounds(supabase, id, row.id);
    }

    revalidatePath(`/admin/production/${id}`);
    revalidatePath("/admin/click-up-sheet");
    revalidatePath("/customer");
    return { ok: true, status: nextStatus };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not save your decision.";
    return { ok: false, error: msg };
  }
}
