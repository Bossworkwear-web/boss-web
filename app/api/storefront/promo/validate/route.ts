import { cookies } from "next/headers";

import { validatePromotionCodeForCheckout } from "@/lib/promotion-codes";
import { createSupabaseAdminClient } from "@/lib/supabase";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const customerEmail = (cookieStore.get("customer_email")?.value ?? "").trim();
  if (!customerEmail) {
    return Response.json({ ok: false, error: "Sign in to use a discount code." }, { status: 401 });
  }

  let body: { code?: string; productSubtotalAud?: number; logoSetupFeeAud?: number } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const code = (body.code ?? "").toString();
  const productSubtotalAud = Number(body.productSubtotalAud);
  if (!Number.isFinite(productSubtotalAud) || productSubtotalAud < 0) {
    return Response.json({ ok: false, error: "Invalid order subtotal." }, { status: 400 });
  }
  const logoSetupFeeAud = Number(body.logoSetupFeeAud);
  // Discount may also offset the logo setup fee (e.g. a "FREESETUP" code), so the cap includes it.
  const maxDiscountableAud =
    productSubtotalAud + (Number.isFinite(logoSetupFeeAud) && logoSetupFeeAud > 0 ? logoSetupFeeAud : 0);

  let supabase;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return Response.json({ ok: false, error: "Discount codes are temporarily unavailable." }, { status: 503 });
  }

  const result = await validatePromotionCodeForCheckout(supabase, {
    codeInput: code,
    customerEmail,
    productSubtotalAud,
    maxDiscountableAud,
    preview: true,
  });

  if (!result.ok) {
    return Response.json({ ok: false, error: result.error }, { status: 400 });
  }

  return Response.json({
    ok: true,
    promotionCodeId: result.promotionCodeId,
    code: result.code,
    description: result.description,
    discountAud: result.discountAud,
    discountType: result.discountType,
    discountValue: result.discountValue,
  });
}
