"use server";

import { revalidatePath } from "next/cache";

import { assertAdminSession } from "@/lib/admin-auth";
import {
  getCustomerStoreCreditBalanceCents,
  getStoreCreditIssuedForOrderCents,
  issueCustomerStoreCredit,
} from "@/lib/customer-store-credit";
import { revalidateStoreOrderListPaths } from "@/lib/revalidate-store-order-lists";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type StoreCreditActionResult = { ok: true; balanceCents: number } | { ok: false; error: string };

export async function loadCustomerStoreCreditBalanceForAdmin(
  customerEmail: string,
): Promise<{ ok: true; balanceCents: number } | { ok: false; error: string }> {
  await assertAdminSession();
  const email = customerEmail.trim();
  if (!email) {
    return { ok: false, error: "Customer email is required." };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const balanceCents = await getCustomerStoreCreditBalanceCents(supabase, email);
    return { ok: true, balanceCents };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not load balance." };
  }
}

export async function loadStoreCreditPanelContext(
  orderId: string,
): Promise<
  | {
      ok: true;
      balanceCents: number;
      creditIssuedForOrderCents: number;
      maxCreditCents: number;
    }
  | { ok: false; error: string }
> {
  await assertAdminSession();
  const id = orderId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: false, error: "Invalid order." };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: order, error } = await supabase
      .from("store_orders")
      .select("customer_email, total_cents, refunded_cents")
      .eq("id", id)
      .maybeSingle();
    if (error || !order) {
      return { ok: false, error: error?.message ?? "Order not found." };
    }
    const email = (order.customer_email ?? "").trim();
    const [balanceCents, creditIssuedForOrderCents] = await Promise.all([
      getCustomerStoreCreditBalanceCents(supabase, email),
      getStoreCreditIssuedForOrderCents(supabase, id),
    ]);
    const refunded = Math.max(0, order.refunded_cents ?? 0);
    const maxCreditCents = Math.max(0, (order.total_cents ?? 0) - refunded - creditIssuedForOrderCents);
    return { ok: true, balanceCents, creditIssuedForOrderCents, maxCreditCents };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not load credit." };
  }
}

export async function issueStoreCreditForOrder(
  orderId: string,
  args: { amountCents: number; note?: string },
): Promise<StoreCreditActionResult> {
  await assertAdminSession();
  const id = orderId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: false, error: "Invalid order." };
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return { ok: false, error: "Database not configured." };
  }

  const { data: order, error } = await supabase
    .from("store_orders")
    .select("id, order_number, customer_email, total_cents, refunded_cents")
    .eq("id", id)
    .maybeSingle();

  if (error || !order) {
    return { ok: false, error: error?.message ?? "Order not found." };
  }

  const email = (order.customer_email ?? "").trim();
  if (!email) {
    return { ok: false, error: "Order has no customer email." };
  }

  const amountCents = Math.round(args.amountCents);
  if (!Number.isFinite(amountCents) || amountCents < 1) {
    return { ok: false, error: "Enter a credit amount of at least A$0.01." };
  }

  const alreadyIssued = await getStoreCreditIssuedForOrderCents(supabase, id);
  const refunded = Math.max(0, order.refunded_cents ?? 0);
  const maxFromOrder = Math.max(0, (order.total_cents ?? 0) - refunded - alreadyIssued);
  if (amountCents > maxFromOrder) {
    return {
      ok: false,
      error: `Credit cannot exceed A$${(maxFromOrder / 100).toFixed(2)} remaining on this order (after card refunds and credit already issued).`,
    };
  }

  const note =
    args.note?.trim() ||
    `Store credit for order ${order.order_number ?? id}${args.note ? "" : ""}`;

  const issued = await issueCustomerStoreCredit(supabase, {
    customerEmail: email,
    amountCents,
    sourceStoreOrderId: id,
    note,
    createdBy: "admin",
  });

  if (!issued.ok) {
    return issued;
  }

  revalidatePath("/admin/accounting/refunds");
  revalidatePath("/admin/online-orders");
  revalidatePath(`/admin/store-orders/${id}/ordered-items-list`);
  revalidateStoreOrderListPaths();

  return { ok: true, balanceCents: issued.balanceCents };
}
