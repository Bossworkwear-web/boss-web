import { redirect } from "next/navigation";

import {
  AlertTriangleIcon,
  BuildingIcon,
  CheckCircleIcon,
  ClipboardIcon,
  NotesIcon,
  ProductIcon,
  XCircleIcon,
} from "@/app/components/icons";
import { MainWithSupplierRail } from "@/app/components/supplier-ad-banner";
import { TopNav } from "@/app/components/top-nav";
import { QuoteBackNav } from "@/app/components/quote-back-nav";
import { QuoteLogoDropzone } from "@/app/components/quote-logo-dropzone";
import { runAfterQuoteSubmit } from "@/lib/crm/after-quote-submit";
import { isBizCorporatesCatalogProduct } from "@/lib/product-visibility";
import { createSupabaseAdminClient, createSupabaseClient } from "@/lib/supabase";
import { SITE_PAGE_INNER_SHELL_CLASS } from "@/lib/site-layout";

export const dynamic = "force-dynamic";

type QuotePageProps = {
  searchParams: Promise<{
    status?: string;
    code?: string;
    product_id?: string;
    service?: string;
    placements?: string;
    color?: string;
    quantity?: string;
  }>;
};

const MAX_LOGO_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function toSafeFileBaseName(filename: string) {
  const withoutExt = filename.replace(/\.[^/.]+$/, "");
  const normalized = withoutExt
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "logo-file";
}

function getStatusMessage(status?: string, code?: string) {
  if (status === "success") {
    return {
      tone: "success" as const,
      text: "Quote request submitted successfully.",
    };
  }

  if (status === "invalid") {
    if (code === "required_fields") {
      return {
        tone: "invalid" as const,
        text: "Please fill in all required fields (Company Name, Contact Name, Email).",
      };
    }
    if (code === "unsupported_file_type") {
      return {
        tone: "invalid" as const,
        text: "Unsupported logo file type. Only PDF, AI, PNG are allowed.",
      };
    }
    if (code === "file_too_large") {
      return {
        tone: "invalid" as const,
        text: "Logo file is too large. Maximum file size is 10MB.",
      };
    }
    return {
      tone: "invalid" as const,
      text: "Please check your input and try again.",
    };
  }

  if (status === "error") {
    if (code === "upload_failed") {
      return {
        tone: "error" as const,
        text: "Logo upload failed. Please try a different file or retry.",
      };
    }
    if (code === "save_failed") {
      return {
        tone: "error" as const,
        text: "Could not save your quote request. Please try again.",
      };
    }
    return {
      tone: "error" as const,
      text: "An unexpected error occurred. Please try again.",
    };
  }

  return null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function escapeIlikePattern(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

type SupabaseAdmin = ReturnType<typeof createSupabaseAdminClient>;

/** One token: model name, slug, or product UUID → id and/or staff note. */
async function resolveQuoteProductSpec(
  supabase: SupabaseAdmin,
  raw: string,
): Promise<{ productId: string | null; notesLine: string | null }> {
  const spec = raw.trim();
  if (!spec) {
    return { productId: null, notesLine: null };
  }

  if (UUID_RE.test(spec)) {
    const { data } = await supabase.from("products").select("id").eq("id", spec).maybeSingle();
    if (data?.id) {
      return { productId: data.id, notesLine: null };
    }
    return {
      productId: null,
      notesLine: `Product UUID (not found in catalog): ${spec}`,
    };
  }

  const safeExact = escapeIlikePattern(spec);
  const { data: exactNameRows } = await supabase.from("products").select("id").ilike("name", safeExact).limit(3);
  if (exactNameRows?.length === 1 && exactNameRows[0].id) {
    return { productId: exactNameRows[0].id, notesLine: null };
  }
  if ((exactNameRows?.length ?? 0) > 1) {
    return {
      productId: null,
      notesLine: `Product name is ambiguous in catalog (“${spec}”). Please identify the SKU in notes.`,
    };
  }

  const { data: slugRow } = await supabase.from("products").select("id").eq("slug", spec).maybeSingle();
  if (slugRow?.id) {
    return { productId: slugRow.id, notesLine: null };
  }

  const { data: slugIlikeRows } = await supabase.from("products").select("id").ilike("slug", safeExact).limit(3);
  if (slugIlikeRows?.length === 1 && slugIlikeRows[0].id) {
    return { productId: slugIlikeRows[0].id, notesLine: null };
  }

  const esc = escapeIlikePattern(spec);
  const { data: partialRows } = await supabase
    .from("products")
    .select("id")
    .ilike("name", `%${esc}%`)
    .limit(3);
  if (partialRows?.length === 1 && partialRows[0].id) {
    return { productId: partialRows[0].id, notesLine: null };
  }

  return {
    productId: null,
    notesLine: `Product (customer entry — verify in catalog): ${spec}`,
  };
}

function splitProductEntryTokens(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function resolveQuoteProductField(
  supabase: SupabaseAdmin,
  raw: string,
): Promise<{ productIds: string[]; noteLines: string[] }> {
  const tokens = splitProductEntryTokens(raw);
  const productIds: string[] = [];
  const noteLines: string[] = [];
  for (const token of tokens) {
    const { productId, notesLine } = await resolveQuoteProductSpec(supabase, token);
    if (productId && !productIds.includes(productId)) {
      productIds.push(productId);
    } else if (notesLine) {
      noteLines.push(notesLine);
    }
  }
  return { productIds, noteLines };
}

function formUuidList(formData: FormData, key: string): string[] {
  const raw = formData.getAll(key);
  return [...new Set(raw.map((v) => String(v).trim()).filter((s) => UUID_RE.test(s)))];
}

async function appendMultiSelectQuoteNotes(supabase: SupabaseAdmin, productIds: string[]): Promise<string[]> {
  const lines: string[] = [];
  if (productIds.length > 1) {
    const rest = productIds.slice(1);
    const { data: rows } = await supabase.from("products").select("id, name").in("id", rest);
    const labels = rest.map((id) => rows?.find((r) => r.id === id)?.name ?? id);
    lines.push(`Additional products: ${labels.join("; ")}`);
  }
  return lines;
}

async function submitQuote(formData: FormData) {
  "use server";

  const companyName = String(formData.get("company_name") ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const productSpecRaw = String(formData.get("product_spec") ?? "");
  const embroideryPositionIds = formUuidList(formData, "embroidery_position_id");
  const printingPositionIds = formUuidList(formData, "printing_position_id");
  const serviceType = String(formData.get("service_type") ?? "").trim();
  const placementLabelsRaw = String(formData.get("placement_labels") ?? "").trim();
  const productColor = String(formData.get("product_color") ?? "").trim();
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const logoFile = formData.get("logo_file");

  const quantity = quantityRaw ? Number(quantityRaw) : null;
  const placementLabels = placementLabelsRaw
    ? placementLabelsRaw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : null;

  if (!companyName || !contactName || !email) {
    redirect("/quote?status=invalid&code=required_fields");
  }

  try {
    const supabase = createSupabaseAdminClient();
    let logoFileUrl: string | null = null;

    if (logoFile instanceof File && logoFile.size > 0) {
      const filename = logoFile.name.toLowerCase();
      const extension = filename.split(".").pop() ?? "";
      const allowedExtensions = new Set(["pdf", "ai", "png"]);
      if (!allowedExtensions.has(extension)) {
        redirect("/quote?status=invalid&code=unsupported_file_type");
      }

      if (logoFile.size > MAX_LOGO_FILE_SIZE_BYTES) {
        redirect("/quote?status=invalid&code=file_too_large");
      }

      const bucketName = process.env.SUPABASE_STORAGE_BUCKET ?? "quote-logos";
      const safeBaseName = toSafeFileBaseName(filename);
      const filePath = `quotes/${Date.now()}-${safeBaseName}-${crypto.randomUUID()}.${extension}`;
      const fileBytes = new Uint8Array(await logoFile.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, fileBytes, {
          contentType: logoFile.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) {
        redirect("/quote?status=error&code=upload_failed");
      }

      const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
      logoFileUrl = data.publicUrl;
    }

    const { productIds: resolvedProductIds, noteLines: productTokenNotes } = await resolveQuoteProductField(
      supabase,
      productSpecRaw,
    );
    const multiLines = await appendMultiSelectQuoteNotes(supabase, resolvedProductIds);
    const mergedNotes = [...productTokenNotes, ...multiLines, notes].filter(Boolean).join("\n\n") || null;

    const { data: inserted, error } = await supabase
      .from("quote_requests")
      .insert({
        company_name: companyName,
        contact_name: contactName,
        email,
        phone: phone || null,
        product_id: resolvedProductIds[0] ?? null,
        embroidery_position_id: embroideryPositionIds[0] ?? null,
        embroidery_position_ids: embroideryPositionIds.length > 0 ? embroideryPositionIds : null,
        printing_position_id: printingPositionIds[0] ?? null,
        printing_position_ids: printingPositionIds.length > 0 ? printingPositionIds : null,
        service_type: serviceType || null,
        placement_labels: placementLabels,
        product_color: productColor || null,
        logo_file_url: logoFileUrl,
        quantity: Number.isFinite(quantity) ? quantity : null,
        notes: mergedNotes,
      })
      .select("id")
      .single();

    if (error || !inserted?.id) {
      redirect("/quote?status=error&code=save_failed");
    }

    try {
      await runAfterQuoteSubmit({
        quoteId: inserted.id,
        email,
        contactName,
        companyName,
        phone: phone || null,
      });
    } catch (crmError) {
      console.error("[crm] post-submit automation", crmError);
    }
  } catch {
    redirect("/quote?status=error");
  }

  redirect("/quote?status=success");
}

export default async function QuotePage({ searchParams }: QuotePageProps) {
  const params = await searchParams;
  const status = params.status;
  const code = params.code;
  const statusMessage = getStatusMessage(status, code);
  const prefilledProductIds = (params.product_id ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const prefilledServiceType = params.service ?? "";
  const prefilledColor = params.color ?? "";
  const prefilledPlacementIds = (params.placements ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const prefilledQuantity =
    params.quantity && Number.isFinite(Number(params.quantity)) ? Number(params.quantity) : undefined;

  let products: { id: string; name: string; slug: string | null }[] = [];
  let positions: { id: string; name: string }[] = [];

  try {
    const supabase = createSupabaseClient();
    const [{ data: productData }, { data: positionData }] = await Promise.all([
      supabase.from("products").select("id, name, slug").order("name"),
      supabase.from("embroidery_positions").select("id, name").order("name"),
    ]);
    products = (productData ?? []).filter((p) => !isBizCorporatesCatalogProduct(p.name));
    positions = positionData ?? [];
  } catch {
    products = [];
    positions = [];
  }

  const prefilledPlacementNames = positions
    .filter((item) => prefilledPlacementIds.includes(item.id))
    .map((item) => item.name);

  const prefilledProductNames = prefilledProductIds
    .map((id) => products.find((p) => p.id === id)?.name)
    .filter((n): n is string => Boolean(n));

  const prefilledProductFieldValue =
    prefilledProductNames.length > 0
      ? prefilledProductNames.join(", ")
      : prefilledProductIds.length > 0
        ? prefilledProductIds.join(", ")
        : "";

  const prefilledNotes = [
    prefilledServiceType ? `Service: ${prefilledServiceType}` : "",
    prefilledColor ? `Colour: ${prefilledColor}` : "",
    prefilledPlacementNames.length
      ? `Placement: ${prefilledPlacementNames.join(", ")}`
      : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return (
    <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <TopNav />
      <MainWithSupplierRail>
        <div
          className={`${SITE_PAGE_INNER_SHELL_CLASS} quote-page-inner-narrow quote-page-body-text-120 space-y-8`}
        >
        <header className="flex flex-col gap-3">
          <QuoteBackNav />
          <h1 className="text-4xl font-medium">Get a Quote</h1>
          <p className="max-w-2xl text-sm text-brand-navy/75">
            Tell us what uniform products you need and we will prepare a tailored quote.
          </p>
        </header>

        {(prefilledProductIds.length > 0 ||
          prefilledServiceType ||
          prefilledColor ||
          prefilledPlacementNames.length > 0) && (
          <div className="rounded-xl border border-brand-navy/15 bg-brand-navy/5 px-4 py-3 text-sm text-brand-navy">
            <p className="font-semibold">Pre-filled from product detail</p>
            <p className="mt-1 text-brand-navy/75">
              {prefilledProductNames.length ? `Products: ${prefilledProductNames.join(", ")}. ` : ""}
              {prefilledServiceType ? `Service: ${prefilledServiceType}. ` : ""}
              {prefilledColor ? `Colour: ${prefilledColor}. ` : ""}
              {prefilledPlacementNames.length
                ? `Placements: ${prefilledPlacementNames.join(", ")}.`
                : ""}
            </p>
          </div>
        )}

        {statusMessage?.tone === "error" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <XCircleIcon className="h-4 w-4" />
            {statusMessage.text}
          </p>
        )}
        {statusMessage?.tone === "invalid" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700">
            <AlertTriangleIcon className="h-4 w-4" />
            {statusMessage.text}
          </p>
        )}

        <form action={submitQuote} className="grid gap-6 rounded-2xl border border-brand-navy/15 p-6">
          <input type="hidden" name="service_type" value={prefilledServiceType} />
          <input type="hidden" name="product_color" value={prefilledColor} />
          <input type="hidden" name="placement_labels" value={prefilledPlacementNames.join(",")} />

          <p className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.1em] text-brand-navy/75">
            <BuildingIcon className="h-4 w-4" />
            Contact Information
          </p>
          <div className="grid gap-2">
            <label htmlFor="company_name" className="text-sm font-semibold">
              Company Name *
            </label>
            <input
              id="company_name"
              name="company_name"
              required
              className="rounded-md border border-brand-navy/20 px-3 py-2"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
            <div className="grid gap-2 sm:col-span-2">
              <label htmlFor="contact_name" className="text-sm font-semibold">
                Contact Name *
              </label>
              <input
                id="contact_name"
                name="contact_name"
                required
                className="rounded-md border border-brand-navy/20 px-3 py-2"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="email" className="text-sm font-semibold">
                Email *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="rounded-md border border-brand-navy/20 px-3 py-2"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="phone" className="text-sm font-semibold">
                Phone
              </label>
              <input id="phone" name="phone" className="rounded-md border border-brand-navy/20 px-3 py-2" />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <label htmlFor="logo_file" className="text-sm font-semibold">
                Logo file (PDF, AI, PNG)
              </label>
              <QuoteLogoDropzone inputId="logo_file" inputName="logo_file" />
            </div>
          </div>

          <p className="mt-[2lh] inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.1em] text-brand-navy/75">
            <ProductIcon className="h-4 w-4" />
            Product Options
          </p>
          <div className="grid gap-8">
            <div className="grid gap-3 rounded-lg border border-brand-navy/15 p-4">
              <label htmlFor="product_spec" className="text-sm font-semibold text-brand-navy">
                Product details
              </label>
              <p className="text-sm text-brand-navy/60">
                Enter one or more <strong>catalog product names</strong>, <strong>store slugs</strong> (e.g. work-shirt),
                or <strong>product UUIDs</strong>. Separate with commas or new lines. The first match is linked on the
                quote; other matches and anything we cannot resolve are added to <strong>Notes</strong> for staff.
              </p>
              <textarea
                id="product_spec"
                name="product_spec"
                rows={4}
                defaultValue={prefilledProductFieldValue}
                placeholder={"e.g. Premium Work Polo\nwork-shirt\n(paste product UUID if you have it)"}
                className="min-h-[6.5rem] rounded-md border border-brand-navy/20 px-3 py-2 font-mono text-sm leading-relaxed text-brand-navy"
              />
              <div className="grid max-w-xs gap-2">
                <label htmlFor="quantity" className="text-sm font-semibold">
                  Total Quantity
                </label>
                <input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min={1}
                  defaultValue={prefilledQuantity}
                  className="rounded-md border border-brand-navy/20 px-3 py-2"
                />
              </div>
            </div>

            <fieldset className="grid gap-3 rounded-lg border border-brand-navy/15 p-4">
              <legend className="text-sm font-semibold text-brand-navy">Embroidery position — select any that apply</legend>
              <p className="text-sm text-brand-navy/60">
                Same rule: the <strong>first checked</strong> position is stored on the quote; extras go to{" "}
                <strong>Notes</strong>.
              </p>
              {positions.length === 0 ? (
                <p className="text-sm text-brand-navy/55">No positions loaded.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-md border border-brand-navy/10 bg-white p-3 sm:max-h-64">
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {positions.map((item) => (
                      <li key={item.id}>
                        <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-1 py-1.5 hover:bg-brand-navy/5">
                          <input
                            type="checkbox"
                            name="embroidery_position_id"
                            value={item.id}
                            defaultChecked={prefilledPlacementIds.includes(item.id)}
                            className="mt-1 h-4 w-4 shrink-0 rounded border-brand-navy/30 text-brand-orange focus:ring-brand-orange"
                          />
                          <span className="text-sm leading-snug text-brand-navy">{item.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </fieldset>

            <fieldset className="grid gap-3 rounded-lg border border-brand-navy/15 p-4">
              <legend className="text-sm font-semibold text-brand-navy">Printing position — select any that apply</legend>
              <p className="text-sm text-brand-navy/60">
                Choose where printing or heat transfer should go. The <strong>first checked</strong> position is stored
                on the quote; extras go to <strong>Notes</strong> (same rule as embroidery).
              </p>
              {positions.length === 0 ? (
                <p className="text-sm text-brand-navy/55">No positions loaded.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-md border border-brand-navy/10 bg-white p-3 sm:max-h-64">
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {positions.map((item) => (
                      <li key={`print-${item.id}`}>
                        <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-1 py-1.5 hover:bg-brand-navy/5">
                          <input
                            type="checkbox"
                            name="printing_position_id"
                            value={item.id}
                            defaultChecked={false}
                            className="mt-1 h-4 w-4 shrink-0 rounded border-brand-navy/30 text-brand-orange focus:ring-brand-orange"
                          />
                          <span className="text-sm leading-snug text-brand-navy">{item.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </fieldset>
          </div>

          <p className="mt-[2lh] inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.1em] text-brand-navy/75">
            <NotesIcon className="h-4 w-4" />
            Additional Notes
          </p>
          <div className="grid gap-2">
            <label htmlFor="notes" className="text-sm font-semibold">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={prefilledNotes}
              className="rounded-md border border-brand-navy/20 px-3 py-2"
              placeholder="Tell us logo size, thread color, deadlines, and special requirements."
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="inline-flex w-fit items-center gap-2 rounded-xl bg-brand-orange px-6 py-3 text-sm font-medium text-brand-navy transition hover:brightness-95"
            >
              <ClipboardIcon className="h-4 w-4" />
              Submit Quote Request
            </button>
            {statusMessage?.tone === "success" && (
              <p className="inline-flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-800">
                <CheckCircleIcon className="h-4 w-4 shrink-0" />
                {statusMessage.text}
              </p>
            )}
          </div>
        </form>
        </div>
      </MainWithSupplierRail>
    </main>
  );
}
