import Stripe from "stripe";
import { cookies } from "next/headers";

import { extractAustralianPostcodeFromAddress } from "@/lib/customer-delivery-estimate";
import { totalEstimatedShippingWeightKg } from "@/lib/delivery-shipping-weight";
import { computeStorefrontCheckoutFees } from "@/lib/storefront-cart-checkout-fees";
import { hasPriorEmbroideryOrderForCustomerEmail } from "@/lib/storefront-prior-embroidery-order";
import { createSupabaseAdminClient } from "@/lib/supabase";
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
  const secretRaw = process.env.STRIPE_SECRET_KEY ?? "";
  // Defend against copy/paste issues: newlines / quotes / whitespace can corrupt the Authorization header.
  const secret = secretRaw.replace(/[\r\n\t "']/g, "").trim();
  if (!secret) {
    return Response.json({ ok: false, error: "Stripe is not configured (STRIPE_SECRET_KEY)." }, { status: 503 });
  }
  if (/\s/.test(secretRaw)) {
    return Response.json(
      {
        ok: false,
        error: "Stripe key contains whitespace/newlines. Re-copy the full sk_test_/sk_live_ value with no spaces.",
      },
      { status: 400 },
    );
  }
  // Prefer Stripe SDK default API version unless you intentionally lock it.
  const stripe = new Stripe(secret);

  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}` : "http://localhost:3000");

  let body: { items?: CartItem[]; deliveryAddress?: string | null } = {};
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
  try {
    const supabase = createSupabaseAdminClient();
    hasPriorEmbroidery = await hasPriorEmbroideryOrderForCustomerEmail(supabase, customerEmail);
  } catch {
    return Response.json({ ok: false, error: "Checkout is temporarily unavailable." }, { status: 503 });
  }

  const feeItems = items.map((it) => ({
    serviceType: typeof it.serviceType === "string" ? it.serviceType : "",
    referenceImageUrls: Array.isArray(it.referenceImageUrls) ? it.referenceImageUrls : undefined,
  }));
  const fees = computeStorefrontCheckoutFees({
    subtotalAud: subtotal,
    items: feeItems,
    deliveryPostcode: postcode,
    estimatedWeightKg,
    isCustomerSignedIn: true,
    hasPriorEmbroideryOrder: hasPriorEmbroidery,
  });
  const deliveryFee = fees.deliveryFeeAud;
  const logoSetupFee = fees.logoSetupFeeAud;
  const total = fees.totalAud;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      currency: "aud",
      success_url: `${site}/payment?status=stripe_success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/payment?status=stripe_cancelled`,
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

