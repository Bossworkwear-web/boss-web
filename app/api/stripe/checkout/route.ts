import { cookies } from "next/headers";

import { extractAustralianPostcodeFromAddress } from "@/lib/customer-delivery-estimate";
import {
  computeStoreCreditToApplyCents,
  getCustomerStoreCreditBalanceCents,
} from "@/lib/customer-store-credit";
import { getStripeServer } from "@/lib/stripe-server";
import { totalEstimatedShippingWeightKg } from "@/lib/delivery-shipping-weight";
import { computeStorefrontCheckoutFees } from "@/lib/storefront-cart-checkout-fees";
import { hasPriorEmbroideryOrderForCustomerEmail } from "@/lib/storefront-prior-embroidery-order";
import type { StoreOrderCartLine } from "@/lib/store-order-cart-payload";
import { saveStoreCheckoutPending } from "@/lib/store-checkout-pending";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { validatePromotionCodeForCheckout } from "@/lib/promotion-codes";
import { validateSpecialDealPackageCartLines } from "@/lib/storefront-special-deal-package-cart";
import { storefrontCartNetProductSubtotalAfterVolumeAud, storefrontVolumeAdjustedCartLines } from "@/lib/storefront-volume-discount";

type CheckoutCartItem = StoreOrderCartLine;

function dollarsToCents(d: number): number {
  return Math.round(d * 100);
}

function assertCart(items: CheckoutCartItem[]): { ok: true } | { ok: false; error: string } {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: "Cart is empty." };
  if (items.length > 80) return { ok: false, error: "Too many cart lines." };
  for (const it of items) {
    if (!it.productName?.trim()) return { ok: false, error: "Invalid product name." };
    if (!it.productId?.trim()) return { ok: false, error: "Invalid product id." };
    if (!Number.isFinite(it.quantity) || it.quantity < 1 || it.quantity > 999) return { ok: false, error: "Invalid qty." };
    if (!Number.isFinite(it.unitPrice) || it.unitPrice < 0) return { ok: false, error: "Invalid unit price." };
    if (!Number.isFinite(it.totalPrice) || it.totalPrice < 0) return { ok: false, error: "Invalid line total." };
  }
  return { ok: true };
}

export async function POST(req: Request) {
  const stripe = getStripeServer();
  if (!stripe) {
    return Response.json({ ok: false, error: "Stripe is not configured (STRIPE_SECRET_KEY)." }, { status: 503 });
  }

  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}` : "http://localhost:3000");

  let body: {
    items?: CheckoutCartItem[];
    deliveryAddress?: string | null;
    promotionCodeId?: string | null;
    pickUp?: boolean;
    reorderedFromStoreOrderId?: string | null;
    applyStoreCredit?: boolean;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const check = assertCart(items);
  if (!check.ok) {
    return Response.json({ ok: false, error: check.error }, { status: 400 });
  }

  const dealCheck = validateSpecialDealPackageCartLines(
    items.map((it) => ({
      specialDealPackageId: it.specialDealPackageId,
      quantity: it.quantity,
      totalPrice: it.totalPrice,
      unitPrice: it.unitPrice,
      serviceType: it.serviceType ?? "",
      placements: it.placements,
      referenceImageUrls: it.referenceImageUrls,
    })),
  );
  if (!dealCheck.ok) {
    return Response.json({ ok: false, error: dealCheck.error }, { status: 400 });
  }

  const deliveryAddress = (body.deliveryAddress ?? "").trim();
  if (!deliveryAddress) {
    return Response.json({ ok: false, error: "Delivery address is required." }, { status: 400 });
  }
  const postcode = extractAustralianPostcodeFromAddress(deliveryAddress);
  const estimatedWeightKg = totalEstimatedShippingWeightKg(items);

  const priced = storefrontVolumeAdjustedCartLines(
    items.map((it) => ({ ...it, id: it.cartLineId })),
  );
  const pricedByCartLineId = new Map(
    priced
      .map((row) => {
        const key = String(row.id ?? "").trim();
        return key ? [key, row] as const : null;
      })
      .filter((entry): entry is [string, typeof priced[number]] => entry != null),
  );
  const subtotal = storefrontCartNetProductSubtotalAfterVolumeAud(items).net;

  const cookieStore = await cookies();
  const customerEmail = (cookieStore.get("customer_email")?.value ?? "").trim();
  const customerName = (cookieStore.get("customer_name")?.value ?? "").trim();
  if (!customerEmail || !customerName) {
    return Response.json({ ok: false, error: "Sign in and complete your details to pay." }, { status: 401 });
  }

  let hasPriorEmbroidery = false;
  let supabase;
  try {
    supabase = createSupabaseAdminClient();
    hasPriorEmbroidery = await hasPriorEmbroideryOrderForCustomerEmail(supabase, customerEmail);
  } catch {
    return Response.json({ ok: false, error: "Checkout is temporarily unavailable." }, { status: 503 });
  }

  const feeItems = items.map((it) => ({
    serviceType: typeof it.serviceType === "string" ? it.serviceType : "",
    referenceImageUrls: Array.isArray(it.referenceImageUrls) ? it.referenceImageUrls : undefined,
  }));
  const pickUp = body.pickUp === true;
  const fees = computeStorefrontCheckoutFees({
    subtotalAud: subtotal,
    items: feeItems,
    deliveryPostcode: postcode,
    estimatedWeightKg,
    isCustomerSignedIn: true,
    hasPriorEmbroideryOrder: hasPriorEmbroidery,
    pickUp,
  });
  const deliveryFee = fees.deliveryFeeAud;
  const logoSetupFee = fees.logoSetupFeeAud;
  const totalBeforePromo = fees.totalAud;

  const promotionCodeId = (body.promotionCodeId ?? "").trim();
  let promoDiscountCents = 0;
  let promoCodeLabel = "";
  let validatedPromoId: string | null = null;

  if (promotionCodeId) {
    const { data: promoRow } = await supabase
      .from("promotion_codes")
      .select("code")
      .eq("id", promotionCodeId)
      .maybeSingle();

    if (!promoRow?.code) {
      return Response.json({ ok: false, error: "Discount code is no longer valid." }, { status: 400 });
    }

    const promoCheck = await validatePromotionCodeForCheckout(supabase, {
      codeInput: promoRow.code,
      customerEmail,
      productSubtotalAud: subtotal,
      maxDiscountableAud: subtotal + logoSetupFee,
    });
    if (!promoCheck.ok) {
      return Response.json({ ok: false, error: promoCheck.error }, { status: 400 });
    }
    if (promoCheck.promotionCodeId !== promotionCodeId) {
      return Response.json({ ok: false, error: "Discount code is no longer valid." }, { status: 400 });
    }
    promoDiscountCents = dollarsToCents(promoCheck.discountAud);
    promoCodeLabel = promoCheck.code;
    validatedPromoId = promoCheck.promotionCodeId;
  }

  const total = Math.max(0, totalBeforePromo - promoDiscountCents / 100);
  const totalCents = dollarsToCents(total);

  const applyStoreCredit = body.applyStoreCredit !== false;
  let storeCreditAppliedCents = 0;
  if (applyStoreCredit) {
    const balanceCents = await getCustomerStoreCreditBalanceCents(supabase, customerEmail);
    storeCreditAppliedCents = computeStoreCreditToApplyCents(balanceCents, totalCents);
  }
  const cardPayCents = totalCents - storeCreditAppliedCents;

  if (cardPayCents === 0 && storeCreditAppliedCents > 0) {
    return Response.json({
      ok: true,
      creditOnly: true,
      storeCreditAppliedCents,
    });
  }

  try {
    const discounts: { coupon: string }[] = [];
    if (promoDiscountCents > 0 && validatedPromoId) {
      const coupon = await stripe.coupons.create({
        amount_off: promoDiscountCents,
        currency: "aud",
        duration: "once",
        name: `Discount ${promoCodeLabel}`.slice(0, 40),
      });
      discounts.push({ coupon: coupon.id });
    }
    if (storeCreditAppliedCents > 0) {
      const creditCoupon = await stripe.coupons.create({
        amount_off: storeCreditAppliedCents,
        currency: "aud",
        duration: "once",
        name: "Store credit",
      });
      discounts.push({ coupon: creditCoupon.id });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "aud",
      success_url: `${site}/payment?status=stripe_success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/payment?status=stripe_cancelled`,
      payment_method_options: {
        card: {
          restrictions: {
            brands_blocked: ["american_express"],
          },
        },
      },
      ...(discounts.length > 0 ? { discounts } : {}),
      line_items: [
        ...items.map((it, idx) => ({
          quantity: it.quantity,
          price_data: {
            currency: "aud",
            unit_amount: dollarsToCents(
              (it.cartLineId
                ? pricedByCartLineId.get(it.cartLineId)?.unitPrice
                : undefined) ??
                priced[idx]?.unitPrice ??
                it.unitPrice,
            ),
            product_data: { name: it.productName.slice(0, 120) },
          },
        })),
        ...(logoSetupFee > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: "aud",
                  unit_amount: dollarsToCents(logoSetupFee),
                  product_data: { name: "Logo setup fee (incl. GST)" },
                },
              },
            ]
          : []),
        ...(deliveryFee > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: "aud",
                  unit_amount: dollarsToCents(deliveryFee),
                  product_data: { name: "Delivery" },
                },
              },
            ]
          : []),
      ],
      metadata: {
        boss_web_total_cents: String(totalCents),
        ...(storeCreditAppliedCents > 0
          ? { store_credit_applied_cents: String(storeCreditAppliedCents) }
          : {}),
        ...(validatedPromoId
          ? {
              promotion_code_id: validatedPromoId,
              promotion_discount_cents: String(promoDiscountCents),
            }
          : {}),
      },
    });

    if (!session.id) {
      return Response.json({ ok: false, error: "Stripe did not return a session id." }, { status: 500 });
    }

    const reorderedFromStoreOrderId = (body.reorderedFromStoreOrderId ?? "").trim();
    const pendingSave = await saveStoreCheckoutPending(supabase, {
      stripeCheckoutSessionId: session.id,
      customerEmail,
      customerName,
      deliveryAddress,
      items,
      promotionCodeId: validatedPromoId,
      pickUp,
      reorderedFromStoreOrderId: reorderedFromStoreOrderId || null,
      storeCreditAppliedCents,
    });
    if (!pendingSave.ok) {
      console.error("[stripe/checkout] pending snapshot:", pendingSave.error);
      return Response.json(
        {
          ok: false,
          error:
            "Could not save checkout snapshot. Run supabase/migrations/20260524_store_checkout_pending.sql in Supabase, then try again.",
        },
        { status: 503 },
      );
    }

    return Response.json({ ok: true, url: session.url, id: session.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stripe error";
    // Log full error in dev to diagnose connectivity / auth issues.
    console.error("[stripe/checkout]", e);
    const hint =
      msg.toLowerCase().includes("connection") || msg.toLowerCase().includes("retried")
        ? "Stripe API connection failed. Check network/firewall, and confirm STRIPE_SECRET_KEY is a full sk_test_/sk_live_ value (no truncation)."
        : undefined;
    return Response.json({ ok: false, error: msg, ...(hint ? { hint } : {}) }, { status: 500 });
  }
}

