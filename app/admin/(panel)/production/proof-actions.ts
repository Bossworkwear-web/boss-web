"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";

import { assertAdminSessionForPathSegment } from "@/lib/admin-auth";
import { sendOrderProofEmail } from "@/lib/order-proof-email";
import {
  normalizeProofStatus,
  parseProofImageUrls,
  proofApproveUrl,
  type OrderProofRecord,
} from "@/lib/order-proof";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type ListOrderProofsResult =
  | { ok: true; proofs: OrderProofRecord[] }
  | { ok: false; error: string };

function mapProofRow(row: {
  id: string;
  store_order_id: string;
  order_number: string;
  round: number;
  status: string;
  token: string;
  image_urls: unknown;
  note: string | null;
  sent_to: string;
  sent_at: string;
  decided_at: string | null;
  customer_comment: string | null;
}): OrderProofRecord {
  return {
    id: row.id,
    storeOrderId: row.store_order_id,
    orderNumber: row.order_number,
    round: row.round,
    status: normalizeProofStatus(row.status),
    token: row.token,
    imageUrls: parseProofImageUrls(row.image_urls),
    note: row.note,
    sentTo: row.sent_to,
    sentAt: row.sent_at,
    decidedAt: row.decided_at,
    customerComment: row.customer_comment,
  };
}

export async function listOrderProofs(storeOrderId: string): Promise<ListOrderProofsResult> {
  try {
    await assertAdminSessionForPathSegment("/admin/production");
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const id = (storeOrderId ?? "").trim();
  if (!id) {
    return { ok: true, proofs: [] };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("order_proofs")
      .select(
        "id, store_order_id, order_number, round, status, token, image_urls, note, sent_to, sent_at, decided_at, customer_comment",
      )
      .eq("store_order_id", id)
      .order("round", { ascending: false });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true, proofs: (data ?? []).map(mapProofRow) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Load failed";
    return { ok: false, error: msg };
  }
}

export type SendOrderProofResult =
  | { ok: true; round: number }
  | { ok: false; error: string };

/** Create a new proof round, email it to the order customer with a no-login approve link. */
export async function sendOrderProofForApproval(args: {
  storeOrderId: string;
  imageUrls: string[];
  note: string;
}): Promise<SendOrderProofResult> {
  try {
    await assertAdminSessionForPathSegment("/admin/production");
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const storeOrderId = (args.storeOrderId ?? "").trim();
  if (!storeOrderId) {
    return { ok: false, error: "Missing order id." };
  }

  const imageUrls = parseProofImageUrls(args.imageUrls);
  if (imageUrls.length === 0) {
    return { ok: false, error: "Select at least one proof image to send." };
  }

  const note = (args.note ?? "").trim();

  try {
    const supabase = createSupabaseAdminClient();

    const { data: order, error: orderErr } = await supabase
      .from("store_orders")
      .select("id, order_number, customer_email, customer_name")
      .eq("id", storeOrderId)
      .maybeSingle();
    if (orderErr) {
      return { ok: false, error: orderErr.message };
    }
    if (!order) {
      return { ok: false, error: "Order not found." };
    }

    const customerEmail = (order.customer_email ?? "").trim();
    if (!customerEmail) {
      return { ok: false, error: "This order has no customer email to send the proof to." };
    }

    const { data: latest, error: latestErr } = await supabase
      .from("order_proofs")
      .select("round")
      .eq("store_order_id", storeOrderId)
      .order("round", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestErr) {
      return { ok: false, error: latestErr.message };
    }
    const nextRound = (latest?.round ?? 0) + 1;

    const token = randomBytes(24).toString("hex");

    const emailResult = await sendOrderProofEmail({
      to: customerEmail,
      contactName: order.customer_name ?? "",
      orderNumber: order.order_number,
      round: nextRound,
      imageUrls,
      note: note || null,
      approveUrl: proofApproveUrl(storeOrderId, token),
    });

    if (!emailResult.ok) {
      const hint = emailResult.skipped
        ? " (Email is not configured: set RESEND_API_KEY.)"
        : "";
      return { ok: false, error: `Could not send the proof email${hint}: ${emailResult.error}` };
    }

    const { error: insErr } = await supabase.from("order_proofs").insert({
      store_order_id: storeOrderId,
      order_number: order.order_number,
      round: nextRound,
      status: "sent",
      token,
      image_urls: imageUrls,
      note: note || null,
      sent_to: customerEmail,
    });
    if (insErr) {
      return { ok: false, error: `Email sent, but saving the proof record failed: ${insErr.message}` };
    }

    revalidatePath(`/admin/production/${storeOrderId}`);
    revalidatePath("/customer");
    return { ok: true, round: nextRound };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Send failed";
    return { ok: false, error: msg };
  }
}
