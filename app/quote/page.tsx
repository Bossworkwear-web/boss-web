import { redirect } from "next/navigation";

import {
  AlertTriangleIcon,
  BuildingIcon,
  NotesIcon,
  ProductIcon,
  XCircleIcon,
} from "@/app/components/icons";
import { MainWithSupplierRail } from "@/app/components/supplier-ad-banner";
import { TopNav } from "@/app/components/top-nav";
import { QuoteAnalyticsTracker } from "@/app/components/quote-analytics-tracker";
import { QuoteBackNav } from "@/app/components/quote-back-nav";
import { QuoteLogoDropzone } from "@/app/components/quote-logo-dropzone";
import {
  QuoteProductOptionsFields,
  type QuoteProductLine,
} from "@/app/components/quote-product-options-fields";
import { QUOTE_MIN_TOTAL_QUANTITY, QuoteQuantityProvider } from "@/app/components/quote-quantity-context";
import { QuoteSubmitSuccessPopup } from "@/app/components/quote-submit-success-popup";
import { QuoteSubmitButton } from "@/app/components/quote-submit-button";
import { QuoteServicePlacementFields } from "@/app/components/quote-service-placement-fields";
import { ImeFriendlyNameInput } from "@/app/components/ime-friendly-name-input";
import { runAfterQuoteSubmit } from "@/lib/crm/after-quote-submit";
import {
  buildWebsiteQuoteCustomerSheet,
  type WebsiteQuoteProductRow,
} from "@/lib/crm/website-quote-customer-sheet";
import { insertWebsiteQuoteRequest } from "@/lib/crm/insert-website-quote-request";
import { buildWebsiteQuoteSubmissionSnapshot, type WebsiteQuoteProductLineV1 } from "@/lib/crm/online-quote-submission";
import { getQuoteCatalogProducts, normalizeQuoteStyleCodeQuery, type QuoteCatalogProduct } from "@/lib/quote-catalog-products";
import { productCardDisplayLines } from "@/lib/product-card-copy";
import { isNextNavigationError } from "@/lib/safe-json-parse";
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
    if (code === "min_quantity") {
      return {
        tone: "invalid" as const,
        text: `Bulk quotes require at least ${QUOTE_MIN_TOTAL_QUANTITY} units total. Add products and quantities, then try again.`,
      };
    }
    if (code === "product_required") {
      return {
        tone: "invalid" as const,
        text: "Enter at least one product name or ID.",
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

  const compactStyleCode = normalizeQuoteStyleCodeQuery(spec);
  if (/^[A-Z0-9][A-Z0-9-]{1,11}$/.test(compactStyleCode)) {
    const esc = escapeIlikePattern(compactStyleCode);
    const escLower = escapeIlikePattern(compactStyleCode.toLowerCase());
    const { data: styleCandidates } = await supabase
      .from("products")
      .select("id, name, slug, supplier_name, description, available_colors")
      .or(
        `name.ilike.%${esc}%,slug.ilike.%${escLower}%,name.ilike.Biz Collection ${esc}%,name.ilike.Biz Care ${esc}%,name.ilike.Syzmik ${esc}%`,
      )
      .limit(24);

    const styleMatches = (styleCandidates ?? []).filter((row) => {
      const card = productCardDisplayLines(
        row.name,
        row.description,
        row.slug,
        row.supplier_name,
        row.available_colors,
        true,
      );
      return card.productCode && normalizeQuoteStyleCodeQuery(card.productCode) === compactStyleCode;
    });

    if (styleMatches.length === 1 && styleMatches[0].id) {
      return { productId: styleMatches[0].id, notesLine: null };
    }
    if (styleMatches.length > 1) {
      return {
        productId: null,
        notesLine: `Product ID ${spec} matches more than one catalog product. Please clarify in notes.`,
      };
    }
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

type ParsedQuoteProductLine = {
  productId: string | null;
  spec: string;
  color: string;
  quantity: number;
};

function parseQuoteProductLines(formData: FormData): ParsedQuoteProductLine[] {
  const productIds = formData.getAll("product_line_id").map((value) => String(value).trim());
  const specs = formData.getAll("product_line_spec").map((value) => String(value).trim());
  const colors = formData.getAll("product_line_color").map((value) => String(value).trim());
  const quantities = formData.getAll("product_line_quantity").map((value) => {
    const n = Number(String(value).trim());
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
  });
  const count = Math.max(productIds.length, specs.length, colors.length, quantities.length);
  const lines: ParsedQuoteProductLine[] = [];
  for (let i = 0; i < count; i++) {
    const spec = specs[i] ?? "";
    const quantity = quantities[i] ?? 0;
    const productIdRaw = productIds[i] ?? "";
    const productId = UUID_RE.test(productIdRaw)
      ? productIdRaw
      : UUID_RE.test(spec)
        ? spec
        : null;
    const color = colors[i] ?? "";
    if (!spec) continue;
    lines.push({
      productId,
      spec,
      color,
      quantity: quantity > 0 ? quantity : 1,
    });
  }
  return lines;
}

function formatQuoteProductLineLabel(line: ParsedQuoteProductLine): string {
  const colorSuffix = line.color ? ` (${line.color})` : "";
  return `${line.spec}${colorSuffix} — ${line.quantity} units`;
}

function buildProductSpecRaw(lines: ParsedQuoteProductLine[]): string {
  return lines.map((line) => formatQuoteProductLineLabel(line)).join("\n");
}

function buildProductQuantityNotes(lines: ParsedQuoteProductLine[]): string | null {
  if (lines.length <= 1) return null;
  return `Product quantities:\n${lines.map((line) => `- ${formatQuoteProductLineLabel(line)}`).join("\n")}`;
}

function buildSubmissionProductLines(lines: ParsedQuoteProductLine[]): WebsiteQuoteProductLineV1[] {
  return lines.map((line) => ({
    productId: line.productId,
    productName: line.spec,
    color: line.color || null,
    quantity: line.quantity,
  }));
}

function aggregateProductColor(lines: ParsedQuoteProductLine[]): string | null {
  const colors = [...new Set(lines.map((line) => line.color.trim()).filter(Boolean))];
  if (colors.length === 0) {
    return null;
  }
  return colors.join(", ");
}

async function loadWebsiteQuoteEnrichment(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  resolvedProductIds: string[],
  embroideryPositionIds: string[],
  printingPositionIds: string[],
) {
  const allPositionIds = [...new Set([...embroideryPositionIds, ...printingPositionIds])];
  const [{ data: productRows }, { data: positionRows }] = await Promise.all([
    resolvedProductIds.length
      ? supabase.from("products").select("id, name, slug, supplier_name").in("id", resolvedProductIds)
      : Promise.resolve({ data: [] as WebsiteQuoteProductRow[] }),
    allPositionIds.length
      ? supabase.from("embroidery_positions").select("id, name").in("id", allPositionIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const productById = new Map((productRows ?? []).map((row) => [row.id, row]));
  const positionNameById = new Map((positionRows ?? []).map((row) => [row.id, row.name.trim()]));

  return {
    resolvedProducts: resolvedProductIds
      .map((id) => productById.get(id))
      .filter((row): row is WebsiteQuoteProductRow => Boolean(row)),
    embroideryPlacements: embroideryPositionIds.map((id) => ({
      id,
      name: positionNameById.get(id) || id,
    })),
    printingPlacements: printingPositionIds.map((id) => ({
      id,
      name: positionNameById.get(id) || id,
    })),
  };
}

async function submitQuote(formData: FormData) {
  "use server";

  const companyName = String(formData.get("company_name") ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const productLines = parseQuoteProductLines(formData);
  const productSpecRaw = buildProductSpecRaw(productLines);
  const embroideryPositionIds = formUuidList(formData, "embroidery_position_id");
  const printingPositionIds = formUuidList(formData, "printing_position_id");
  const serviceType = String(formData.get("service_type") ?? "").trim();
  const placementLabelsRaw = String(formData.get("placement_labels") ?? "").trim();
  const quantityRaw = String(formData.get("quantity") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const logoFile = formData.get("logo_file");

  const totalQuantity = quantityRaw ? Number(quantityRaw) : NaN;

  if (!companyName || !contactName || !email) {
    redirect("/quote?status=invalid&code=required_fields");
  }
  if (productLines.length === 0) {
    redirect("/quote?status=invalid&code=product_required");
  }
  if (!Number.isFinite(totalQuantity) || totalQuantity < QUOTE_MIN_TOTAL_QUANTITY) {
    redirect("/quote?status=invalid&code=min_quantity");
  }

  const placementLabels = placementLabelsRaw
    ? placementLabelsRaw
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : null;

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

    const resolvedProductIds: string[] = [];
    const productTokenNotes: string[] = [];
    for (const line of productLines) {
      if (line.productId) {
        const { data } = await supabase.from("products").select("id").eq("id", line.productId).maybeSingle();
        if (data?.id && !resolvedProductIds.includes(data.id)) {
          resolvedProductIds.push(data.id);
          continue;
        }
      }

      const { productId, notesLine } = await resolveQuoteProductSpec(supabase, line.spec);
      if (productId && !resolvedProductIds.includes(productId)) {
        resolvedProductIds.push(productId);
      } else if (notesLine) {
        const colorNote = line.color ? `, colour ${line.color}` : "";
        productTokenNotes.push(`${notesLine} (qty ${line.quantity}${colorNote})`);
      }
    }
    const productColor = aggregateProductColor(productLines);
    const submissionProductLines = buildSubmissionProductLines(productLines);
    const multiLines = await appendMultiSelectQuoteNotes(supabase, resolvedProductIds);
    const productQuantityNotes = buildProductQuantityNotes(productLines);
    const mergedNotes =
      [...productTokenNotes, ...multiLines, productQuantityNotes, notes].filter(Boolean).join("\n\n") || null;

    const { resolvedProducts, embroideryPlacements, printingPlacements } = await loadWebsiteQuoteEnrichment(
      supabase,
      resolvedProductIds,
      embroideryPositionIds,
      printingPositionIds,
    );

    const placementLabelValues = [
      ...embroideryPlacements.map((placement) => `Embroidery: ${placement.name}`),
      ...printingPlacements.map((placement) => `Printing: ${placement.name}`),
    ];

    const adminCustomerQuoteSheet = buildWebsiteQuoteCustomerSheet({
      companyName,
      contactName,
      email,
      phone: phone || null,
      productSpecRaw,
      resolvedProducts,
      unresolvedProductLines: productTokenNotes,
      quantity: totalQuantity,
      serviceType: serviceType || null,
      productColor: productColor || null,
      embroideryPlacements,
      printingPlacements,
      logoFileUrl,
      customerNotes: notes || null,
      productLines: submissionProductLines,
    });

    const websiteQuoteSubmission = buildWebsiteQuoteSubmissionSnapshot({
      productSpecRaw,
      customerNotes: notes || null,
      serviceType: serviceType || null,
      productColor,
      quantity: totalQuantity,
      productLines: submissionProductLines,
      embroideryPlacements,
      printingPlacements,
      logoFileUrl,
    });

    const { data: inserted, error } = await insertWebsiteQuoteRequest(supabase, {
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
      placement_labels: placementLabelValues.length > 0 ? placementLabelValues : placementLabels,
      product_color: productColor,
      logo_file_url: logoFileUrl,
      quantity: totalQuantity,
      notes: mergedNotes,
      admin_customer_quote_sheet: adminCustomerQuoteSheet,
      website_quote_submission: websiteQuoteSubmission,
    });

    if (error || !inserted?.id) {
      console.error("[quote] save_failed", error);
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
  } catch (error) {
    if (isNextNavigationError(error)) {
      throw error;
    }
    console.error("[quote] submit failed", error);
    redirect("/quote?status=error");
  }

  redirect("/quote?status=success");
}

export default async function QuotePage({ searchParams }: QuotePageProps) {
  const params = await searchParams;
  const status = params.status;
  const code = params.code;
  const statusMessage = status === "success" ? null : getStatusMessage(status, code);
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

  let catalog: QuoteCatalogProduct[] = [];
  let positions: { id: string; name: string }[] = [];

  try {
    const supabase = createSupabaseClient();
    const [loadedCatalog, { data: positionData }] = await Promise.all([
      getQuoteCatalogProducts(),
      supabase.from("embroidery_positions").select("id, name").order("name"),
    ]);
    catalog = loadedCatalog;
    positions = positionData ?? [];
  } catch {
    catalog = [];
    positions = [];
  }

  const prefilledPlacementNames = positions
    .filter((item) => prefilledPlacementIds.includes(item.id))
    .map((item) => item.name);

  const prefilledProductNames = prefilledProductIds
    .map((id) => catalog.find((product) => product.id === id)?.displayName)
    .filter((name): name is string => Boolean(name));

  const prefilledProductLines: QuoteProductLine[] =
    prefilledProductIds.length > 0
      ? prefilledProductIds.map((id, index) => {
          const product = catalog.find((item) => item.id === id);
          return {
            productId: product?.id ?? (UUID_RE.test(id) ? id : null),
            spec: product?.displayName ?? product?.name ?? id,
            color: index === 0 ? prefilledColor : "",
            quantity: index === 0 && prefilledQuantity ? prefilledQuantity : 1,
          };
        })
      : [{ productId: null, spec: "", color: "", quantity: prefilledQuantity ?? 1 }];

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
          <QuoteAnalyticsTracker status={status} />
        <QuoteSubmitSuccessPopup show={status === "success"} />
          <h1 className="text-4xl font-medium">Get a Quote</h1>
          <p className="max-w-2xl text-sm text-brand-navy/75">
            Shop online for small team orders, or use this form for tailored bulk pricing (+50 Units) with logo
            embroidery or printing.
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

        <QuoteQuantityProvider>
        <form action={submitQuote} className="grid gap-6 rounded-2xl border border-brand-navy/15 p-6">
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
              <ImeFriendlyNameInput
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
            <QuoteProductOptionsFields catalog={catalog} initialLines={prefilledProductLines} />

            <QuoteServicePlacementFields
              placements={positions}
              prefilledServiceType={prefilledServiceType}
              prefilledPlacementIds={prefilledPlacementIds}
            />
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

          <QuoteSubmitButton />
        </form>
        </QuoteQuantityProvider>
        </div>
      </MainWithSupplierRail>
    </main>
  );
}
