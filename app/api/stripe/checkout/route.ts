import { cookies } from "next/headers";

import { extractAustralianPostcodeFromAddress } from "@/lib/customer-delivery-estimate";
import { getStripeServer } from "@/lib/stripe-server";
import { totalEstimatedShippingWeightKg } from "@/lib/delivery-shipping-weight";
import { computeStorefrontCheckoutFees } from "@/lib/storefront-cart-checkout-fees";
import { hasPriorEmbroideryOrderForCustomerEmail } from "@/lib/storefront-prior-embroidery-order";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { validatePromotionCodeForCheckout } from "@/lib/promotion-codes";
import { validateSpecialDealPackageCartLines } from "@/lib/storefront-special-deal-package-cart";
import { storefrontCartNetProductSubtotalAfterVolumeAud, storefrontVolumeAdjustedCartLines } from "@/lib/storefront-volume-discount";

type CartItem = {
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  listUnitPrice?: number;
  category?: string | null;
  serviceType?: string;
  referenceImageUrls?: string[];
  placements?: string[];
  specialDealPackageId?: string;
};

function dollarsToCents(d: number): number {
  return Math.round(d * 100);
}

function assertCart(items: CartItem[]): { ok: true } | { ok: false; error: string } {
  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: "Cart is empty." };
  if (items.length > 80) return { ok: false, error: "Too many cart lines." };
  for (const it of items) {
    if (!it.productName?.trim()) return { ok: false, error: "Invalid product name." };
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
    items?: CartItem[];
    deliveryAddress?: string | null;
    promotionCodeId?: string | null;
    pickUp?: boolean;
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
  const postcode = extractAustralianPostcodeFromAddress(deliveryAddress);
  const estimatedWeightKg = totalEstimatedShippingWeightKg(items);

  const priced = storefrontVolumeAdjustedCartLines(items);
  const subtotal = storefrontCartNetProductSubtotalAfterVolumeAud(items).net;

  const cookieStore = await cookies();
  const customerEmail = (cookieStore.get("customer_email")?.value ?? "").trim();
  if (!customerEmail) {
    return Response.json({ ok: false, error: "Sign in to pay." }, { status: 401 });
  }

  let hasPriorEmbroidery = false;
  let supabase;
  try {
    supabase = createSupabaseAdminClient();
    hasPriorEmbroidery = await hasPriorEmbroideryOrderForCustomerEmail(supabase, customerEmail);
  } catch {
    return Response.json({ ok: false, error: "Checkout is temporarily unavailable." }, { status: 503 });
  }

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
  const total = Math.max(0, totalBeforePromo - promoDiscountCents / 100);

  try {
    let discounts: { coupon: string }[] | undefined;
    if (promoDiscountCents > 0 && validatedPromoId) {
      const coupon = await stripe.coupons.create({
        amount_off: promoDiscountCents,
        currency: "aud",
        duration: "once",
        name: `Discount ${promoCodeLabel}`.slice(0, 40),
      });
      discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "aud",
      success_url: `${site}/payment?status=stripe_success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/payment?status=stripe_cancelled`,
      ...(discounts ? { discounts } : {}),
      line_items: [
        ...items.map((it, idx) => ({
          quantity: it.quantity,
          price_data: {
            currency: "aud",
            unit_amount: dollarsToCents(priced[idx]?.unitPrice ?? it.unitPrice),
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
        boss_web_total_cents: String(dollarsToCents(total)),
        ...(validatedPromoId
          ? {
              promotion_code_id: validatedPromoId,
              promotion_discount_cents: String(promoDiscountCents),
            }
          : {}),
      },
    });

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

