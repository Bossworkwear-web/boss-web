import { revalidatePath } from "next/cache";

import { extractAustralianPostcodeFromAddress } from "@/lib/customer-delivery-estimate";
import { computeStorefrontCheckoutFees } from "@/lib/storefront-cart-checkout-fees";
import { hasPriorEmbroideryOrderForCustomerEmail } from "@/lib/storefront-prior-embroidery-order";
import { totalEstimatedShippingWeightKg } from "@/lib/delivery-shipping-weight";
import type { StoreOrderCartLine } from "@/lib/store-order-cart-payload";
import { storefrontVolumeAdjustedCartLines } from "@/lib/storefront-volume-discount";
import { sendStoreOrderConfirmationEmail } from "@/lib/store-order-email";
import { allocateNextBossStoreOrderNumber } from "@/lib/boss-customer-order-id";
import { getPerthYmd } from "@/lib/perth-calendar";
import { insertSupplierOrderLinesFromStoreCheckout } from "@/lib/supplier-order-lines-from-store-order";
import { ensureClickUpSheetListForSupplierListDate } from "@/lib/supplier-sheet-click-up-bootstrap";
import { formatMoneyFromCents, siteBaseUrl } from "@/lib/store-order-utils";
import {
  recordPromotionRedemption,
  validatePromotionCodeForCheckout,
} from "@/lib/promotion-codes";
import { validateSpecialDealPackageCartLines } from "@/lib/storefront-special-deal-package-cart";
import { retrievePaidCheckoutSession } from "@/lib/store-order-stripe";
import { markStoreCheckoutPendingFulfilled } from "@/lib/store-checkout-pending";
import {
  computeStoreCreditToApplyCents,
  getCustomerStoreCreditBalanceCents,
  redeemCustomerStoreCredit,
} from "@/lib/customer-store-credit";
import { createSupabaseAdminClient } from "@/lib/supabase";

function dollarsToCents(d: number): number {
  return Math.round(d * 100);
}

function sanitizeReferenceImageUrlsFromClient(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
  if (!base) {
    return [];
  }
  const prefix = `${base}/storage/v1/object/public/`;
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") {
      continue;
    }
    const t = x.trim();
    if (t.startsWith(prefix) && t.length < 2048 && !out.includes(t)) {
      out.push(t);
    }
  }
  return out;
}

function mergeNotesWithReferenceImageUrls(
  notes: string | null | undefined,
  urls: string[],
): string | null {
  const safe = urls.filter(Boolean);
  const base = (notes ?? "").trim();
  if (safe.length === 0) {
    return base.length > 0 ? base : null;
  }
  const block = safe.join("\n");
  const merged = base ? `${base}\n\n${block}` : block;
  const max = 12000;
  return merged.length > max ? merged.slice(0, max) : merged;
}

export type PlaceStoreOrderResult =
  | { ok: true; orderNumber: string; trackingToken: string; trackUrl: string; orderId: string }
  | { ok: false; error: string };

export type PlaceStoreOrderOptions = {
  reorderedFromStoreOrderId?: string;
  promotionCodeId?: string;
  pickUp?: boolean;
  stripeCheckoutSessionId?: string;
  /** When true, an existing paid order for the session returns ok instead of an error. */
  allowExistingStripeSession?: boolean;
  /** Apply available store credit (server validates balance). Default true when omitted. */
  applyStoreCredit?: boolean;
  /** Locked credit amount from checkout pending / Stripe session (do not recalculate). */
  storeCreditAppliedCents?: number;
};

export type PlaceStoreOrderCoreInput = {
  customerEmail: string;
  customerName: string;
  deliveryAddress: string;
  items: StoreOrderCartLine[];
  options?: PlaceStoreOrderOptions;
};

function escapeCustomerEmailForIlikeExact(email: string): string {
  return email.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

async function resolveReorderedFromStoreOrderIdForInsert(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  customerEmail: string,
  candidate: string | undefined,
): Promise<string | null> {
  const raw = (candidate ?? "").trim();
  if (!raw || !/^[0-9a-f-]{36}$/i.test(raw)) {
    return null;
  }
  const ilikeExact = escapeCustomerEmailForIlikeExact(customerEmail);
  const { data, error } = await supabase
    .from("store_orders")
    .select("id")
    .eq("id", raw)
    .ilike("customer_email", ilikeExact)
    .maybeSingle();
  if (error || !data?.id) {
    return null;
  }
  return data.id;
}

export async function findStoreOrderByStripeCheckoutSession(
  stripeCheckoutSessionId: string,
): Promise<{ orderId: string; orderNumber: string; trackingToken: string } | null> {
  const sessionId = stripeCheckoutSessionId.trim();
  if (!sessionId.startsWith("cs_")) {
    return null;
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return null;
  }

  const { data } = await supabase
    .from("store_orders")
    .select("id, order_number, tracking_token")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();

  if (!data?.id || !data.tracking_token) {
    return null;
  }

  return {
    orderId: data.id,
    orderNumber: data.order_number ?? data.id,
    trackingToken: data.tracking_token,
  };
}

export async function placeStoreOrderCore(
  input: PlaceStoreOrderCoreInput,
): Promise<PlaceStoreOrderResult> {
  const items = input.items;
  const customerEmail = input.customerEmail.trim();
  const customerName = input.customerName.trim();
  const deliveryAddress = input.deliveryAddress.trim();
  const options = input.options;

  if (!Array.isArray(items) || items.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }
  if (items.length > 80) {
    return { ok: false, error: "Too many lines in one order." };
  }

  if (!customerEmail || !customerName) {
    return { ok: false, error: "Please sign in and complete your details before paying." };
  }
  if (!deliveryAddress) {
    return { ok: false, error: "Please add a delivery address in your account details." };
  }

  for (const line of items) {
    if (
      !line.productName?.trim() ||
      !Number.isFinite(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 999 ||
      !Number.isFinite(line.unitPrice) ||
      !Number.isFinite(line.totalPrice)
    ) {
      return { ok: false, error: "Invalid cart line." };
    }
  }

  const dealCheck = validateSpecialDealPackageCartLines(items);
  if (!dealCheck.ok) {
    return { ok: false, error: dealCheck.error };
  }

  const postcode = extractAustralianPostcodeFromAddress(deliveryAddress);
  const weightKg = totalEstimatedShippingWeightKg(items);
  const pricedLines = storefrontVolumeAdjustedCartLines(items);
  const subtotalDollars = pricedLines.reduce((s, line) => s + line.totalPrice, 0);
  if (!Number.isFinite(subtotalDollars) || subtotalDollars < 0) {
    return { ok: false, error: "Invalid order total." };
  }
  const itemsPricedForOrder: StoreOrderCartLine[] = items.map((line, idx) => ({
    ...line,
    unitPrice: pricedLines[idx]!.unitPrice,
    totalPrice: pricedLines[idx]!.totalPrice,
  }));

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return { ok: false, error: "Orders are temporarily unavailable (database not configured)." };
  }

  const hasPriorEmbroidery = await hasPriorEmbroideryOrderForCustomerEmail(supabase, customerEmail);
  const fees = computeStorefrontCheckoutFees({
    subtotalAud: subtotalDollars,
    items: itemsPricedForOrder,
    deliveryPostcode: postcode,
    estimatedWeightKg: weightKg,
    isCustomerSignedIn: true,
    hasPriorEmbroideryOrder: hasPriorEmbroidery,
    pickUp: options?.pickUp === true,
  });
  const deliveryFeeDollars = fees.deliveryFeeAud;
  let promotionDiscountDollars = 0;
  let promotionCodeId: string | null = null;

  const promoIdCandidate = (options?.promotionCodeId ?? "").trim();
  if (promoIdCandidate) {
    const { data: promoRow } = await supabase
      .from("promotion_codes")
      .select("code")
      .eq("id", promoIdCandidate)
      .maybeSingle();

    if (!promoRow?.code) {
      return { ok: false, error: "Discount code is no longer valid." };
    }

    const promoCheck = await validatePromotionCodeForCheckout(supabase, {
      codeInput: promoRow.code,
      customerEmail,
      productSubtotalAud: subtotalDollars,
      maxDiscountableAud: subtotalDollars + fees.logoSetupFeeAud,
    });
    if (!promoCheck.ok) {
      return { ok: false, error: promoCheck.error };
    }
    if (promoCheck.promotionCodeId !== promoIdCandidate) {
      return { ok: false, error: "Discount code is no longer valid." };
    }
    promotionDiscountDollars = promoCheck.discountAud;
    promotionCodeId = promoCheck.promotionCodeId;
  }

  const totalDollars = Math.max(0, fees.totalAud - promotionDiscountDollars);

  const subtotalCents = dollarsToCents(subtotalDollars);
  const deliveryFeeCents = dollarsToCents(deliveryFeeDollars);
  const promotionDiscountCents = dollarsToCents(promotionDiscountDollars);
  const totalCents = dollarsToCents(totalDollars);

  const applyStoreCredit = options?.applyStoreCredit !== false;
  let storeCreditAppliedCents = 0;
  if (applyStoreCredit) {
    const locked = options?.storeCreditAppliedCents;
    if (locked != null && Number.isFinite(locked) && locked >= 0) {
      storeCreditAppliedCents = Math.min(Math.round(locked), totalCents);
    } else {
      const balanceCents = await getCustomerStoreCreditBalanceCents(supabase, customerEmail);
      storeCreditAppliedCents = computeStoreCreditToApplyCents(balanceCents, totalCents);
    }
  }

  if (storeCreditAppliedCents > totalCents) {
    return { ok: false, error: "Store credit exceeds order total." };
  }

  const stripeSessionId = (options?.stripeCheckoutSessionId ?? "").trim();
  let stripePaymentIntentId: string | null = null;
  const cardPayCents = totalCents - storeCreditAppliedCents;
  if (stripeSessionId) {
    const existing = await findStoreOrderByStripeCheckoutSession(stripeSessionId);
    if (existing) {
      if (options?.allowExistingStripeSession) {
        const trackUrl = `${siteBaseUrl()}/orders/track/${existing.trackingToken}`;
        return {
          ok: true,
          orderNumber: existing.orderNumber,
          trackingToken: existing.trackingToken,
          trackUrl,
          orderId: existing.orderId,
        };
      }
      return {
        ok: false,
        error: `This payment is already recorded as order ${existing.orderNumber}.`,
      };
    }

    const sessionRes = await retrievePaidCheckoutSession(stripeSessionId);
    if (!sessionRes.ok) {
      return { ok: false, error: sessionRes.error };
    }
    if (cardPayCents > 0 && sessionRes.info.amountTotalCents !== cardPayCents) {
      return { ok: false, error: "Payment amount does not match order total. Please contact support." };
    }
    if (cardPayCents === 0 && sessionRes.info.amountTotalCents > 0) {
      return { ok: false, error: "Payment amount does not match order total. Please contact support." };
    }
    stripePaymentIntentId = sessionRes.info.paymentIntentId;
  } else if (cardPayCents > 0) {
    return { ok: false, error: "Card payment is required for the remaining balance." };
  } else if (storeCreditAppliedCents < 1) {
    return { ok: false, error: "Could not place order — no payment method." };
  }

  const insertPayload = {
    customer_email: customerEmail,
    customer_name: customerName,
    delivery_address: deliveryAddress,
    delivery_fee_cents: deliveryFeeCents,
    subtotal_cents: subtotalCents,
    total_cents: totalCents,
    store_credit_applied_cents: storeCreditAppliedCents,
    promotion_discount_cents: promotionDiscountCents,
    ...(promotionCodeId ? { promotion_code_id: promotionCodeId } : {}),
    currency: "AUD",
    carrier: "Australia Post",
    status: "paid",
    ...(stripeSessionId
      ? {
          stripe_checkout_session_id: stripeSessionId,
          ...(stripePaymentIntentId ? { stripe_payment_intent_id: stripePaymentIntentId } : {}),
        }
      : {}),
  };

  let orderRow: { id: string; tracking_token: string } | null = null;
  let orderNumber = "";

  const reorderedFromResolved = await resolveReorderedFromStoreOrderIdForInsert(
    supabase,
    customerEmail,
    options?.reorderedFromStoreOrderId,
  );

  for (let attempt = 0; attempt < 8; attempt++) {
    const alloc = await allocateNextBossStoreOrderNumber(supabase);
    if (!alloc.ok) {
      return { ok: false, error: alloc.error };
    }
    orderNumber = alloc.orderNumber;

    const { data, error: orderErr } = await supabase
      .from("store_orders")
      .insert({
        ...insertPayload,
        order_number: orderNumber,
        ...(reorderedFromResolved ? { reordered_from_store_order_id: reorderedFromResolved } : {}),
      })
      .select("id, tracking_token")
      .single();

    if (data && !orderErr) {
      orderRow = data;
      break;
    }

    const msg = orderErr?.message ?? "";
    const dup =
      orderErr?.code === "23505" || msg.toLowerCase().includes("unique") || msg.includes("duplicate key");
    if (dup) {
      if (stripeSessionId) {
        const raced = await findStoreOrderByStripeCheckoutSession(stripeSessionId);
        if (raced) {
          const trackUrl = `${siteBaseUrl()}/orders/track/${raced.trackingToken}`;
          return {
            ok: true,
            orderNumber: raced.orderNumber,
            trackingToken: raced.trackingToken,
            trackUrl,
            orderId: raced.orderId,
          };
        }
      }
      continue;
    }

    if (msg.includes("store_orders") && msg.includes("schema cache")) {
      return {
        ok: false,
        error:
          "Order database is not set up. Open supabase/migrations/20260426_store_orders.sql in the repo, copy its full SQL into Supabase → SQL Editor (not the file path), Run, then try again.",
      };
    }
    return { ok: false, error: msg || "Could not save order." };
  }

  if (!orderRow) {
    return { ok: false, error: "Could not assign a unique order number. Please try again." };
  }

  const orderId = orderRow.id;
  const trackingToken = orderRow.tracking_token;

  const normalizedItems: StoreOrderCartLine[] = itemsPricedForOrder.map((line) => {
    const refUrls = sanitizeReferenceImageUrlsFromClient(line.referenceImageUrls);
    const mergedNotes = mergeNotesWithReferenceImageUrls(line.notes, refUrls);
    return {
      ...line,
      notes: mergedNotes ?? undefined,
    };
  });

  const itemRows = normalizedItems.map((line, idx) => ({
    order_id: orderId,
    product_id: line.productId ?? "",
    product_name: line.productName.trim(),
    quantity: Math.floor(line.quantity),
    unit_price_cents: dollarsToCents(line.unitPrice),
    line_total_cents: dollarsToCents(line.totalPrice),
    service_type: line.serviceType || null,
    color: line.color || null,
    size: line.size || null,
    placements: line.placements ?? [],
    notes: line.notes?.trim() || null,
    sort_order: idx,
  }));

  const { data: insertedItems, error: itemsErr } = await supabase.from("store_order_items").insert(itemRows).select("id");
  if (itemsErr) {
    await supabase.from("store_orders").delete().eq("id", orderId);
    const imsg = itemsErr.message;
    if (imsg.includes("store_order_items") && imsg.includes("schema cache")) {
      return {
        ok: false,
        error:
          "Order database is not set up. Open supabase/migrations/20260426_store_orders.sql in the repo, copy its full SQL into Supabase → SQL Editor (not the file path), Run, then try again.",
      };
    }
    return { ok: false, error: imsg };
  }

  if (promotionCodeId && promotionDiscountCents > 0) {
    const redemption = await recordPromotionRedemption(supabase, {
      promotionCodeId,
      customerEmail,
      discountCents: promotionDiscountCents,
      storeOrderId: orderId,
    });
    if (!redemption.ok) {
      await supabase.from("store_order_items").delete().eq("order_id", orderId);
      await supabase.from("store_orders").delete().eq("id", orderId);
      return { ok: false, error: redemption.error };
    }
  }

  if (storeCreditAppliedCents > 0) {
    const redeemed = await redeemCustomerStoreCredit(supabase, {
      customerEmail,
      amountCents: storeCreditAppliedCents,
      storeOrderId: orderId,
    });
    if (!redeemed.ok) {
      await supabase.from("store_order_items").delete().eq("order_id", orderId);
      await supabase.from("store_orders").delete().eq("id", orderId);
      return { ok: false, error: redeemed.error };
    }
  }

  const insertedIds = (insertedItems ?? []).map((r) => String((r as { id?: string }).id ?? "").trim());
  const storeOrderItemIds =
    insertedIds.length === normalizedItems.length && insertedIds.every((id) => /^[0-9a-f-]{36}$/i.test(id))
      ? insertedIds
      : null;

  const { ymd: supplierListDate } = getPerthYmd(new Date());
  await insertSupplierOrderLinesFromStoreCheckout(
    supabase,
    orderNumber,
    supplierListDate,
    normalizedItems,
    storeOrderItemIds,
  );
  const clickUpRes = await ensureClickUpSheetListForSupplierListDate(supabase, supplierListDate);
  if (!clickUpRes.ok) {
    console.error("[placeStoreOrderCore] click_up_sheet_list:", clickUpRes.error);
  }
  revalidatePath("/admin/supplier-orders");
  revalidatePath("/admin/online-orders");
  revalidatePath("/admin/instore-orders");
  revalidatePath("/admin/store-orders");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/work-process");
  revalidatePath("/admin/click-up-sheet");

  const totalFormatted = formatMoneyFromCents(totalCents, "AUD");
  let xeroInvoiceNumber: string | undefined;
  try {
    const { syncStoreOrderToXero } = await import("@/lib/xero/sync-store-order");
    const xeroRes = await syncStoreOrderToXero(orderId);
    if (xeroRes.ok) {
      xeroInvoiceNumber = xeroRes.invoiceNumber;
    } else if (!xeroRes.skipped) {
      console.error("[placeStoreOrderCore] xero sync:", xeroRes.error);
    }
  } catch (e) {
    console.error("[placeStoreOrderCore] xero sync:", e);
  }

  let taxInvoicePdf: { filename: string; base64: string } | undefined;
  if (xeroInvoiceNumber) {
    try {
      const { buildStoreTaxInvoicePdfForOrderId } = await import("@/lib/store-tax-invoice-for-order");
      const pdfRes = await buildStoreTaxInvoicePdfForOrderId(orderId);
      if (pdfRes.ok) {
        taxInvoicePdf = {
          filename: pdfRes.filename,
          base64: pdfRes.buffer.toString("base64"),
        };
      } else {
        console.error("[placeStoreOrderCore] tax invoice PDF:", pdfRes.error);
      }
    } catch (e) {
      console.error("[placeStoreOrderCore] tax invoice PDF:", e);
    }
  }

  const emailRes = await sendStoreOrderConfirmationEmail({
    to: customerEmail,
    customerName,
    orderNumber,
    trackingToken,
    totalFormatted,
    xeroInvoiceNumber,
    taxInvoicePdf,
  });
  if (!emailRes.ok) {
    console.error("[placeStoreOrderCore] confirmation email:", emailRes.error);
  }

  if (stripeSessionId) {
    await markStoreCheckoutPendingFulfilled(supabase, stripeSessionId, orderId);
  }

  const trackUrl = `${siteBaseUrl()}/orders/track/${trackingToken}`;
  return { ok: true, orderNumber, trackingToken, trackUrl, orderId };
}
