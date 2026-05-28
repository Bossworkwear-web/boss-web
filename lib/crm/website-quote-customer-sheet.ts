import type { AdminCustomerQuoteSheetV1 } from "@/app/admin/(panel)/store-orders/internal-order/actions";
import type { WebsiteQuoteProductLineV1 } from "@/lib/crm/online-quote-submission";
import { parseWebsiteQuoteSubmission } from "@/lib/crm/online-quote-submission";
import { todayPerthYmd } from "@/lib/perth-calendar";

export type WebsiteQuoteProductRow = {
  id: string;
  name: string;
  slug: string | null;
  supplier_name: string;
};

export type WebsiteQuotePlacementRow = {
  id: string;
  name: string;
};

export type WebsiteQuoteSheetInput = {
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  productSpecRaw: string;
  resolvedProducts: WebsiteQuoteProductRow[];
  unresolvedProductLines: string[];
  quantity: number | null;
  serviceType: string | null;
  productColor: string | null;
  embroideryPlacements: WebsiteQuotePlacementRow[];
  printingPlacements: WebsiteQuotePlacementRow[];
  logoFileUrl: string | null;
  customerNotes: string | null;
  productLines?: WebsiteQuoteProductLineV1[];
};

export type QuoteRequestRowForCustomerSheet = {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string | null;
  product_id: string | null;
  quantity: number | null;
  service_type: string | null;
  product_color: string | null;
  notes: string | null;
  logo_file_url: string | null;
  placement_labels: string[] | null;
  embroidery_position_id: string | null;
  embroidery_position_ids: string[] | null;
  printing_position_id: string | null;
  printing_position_ids: string[] | null;
  products?: { name: string; slug?: string | null; supplier_name?: string } | null;
};

function normalizeText(raw: unknown): string {
  return String(raw ?? "").trim();
}

function firstProductSpecToken(raw: string): string {
  const token = raw
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .find(Boolean);
  return token ?? "";
}

function buildPlacementLabels(input: {
  embroideryPlacements: WebsiteQuotePlacementRow[];
  printingPlacements: WebsiteQuotePlacementRow[];
}): string[] {
  const labels: string[] = [];
  for (const placement of input.embroideryPlacements) {
    labels.push(`Embroidery: ${placement.name}`);
  }
  for (const placement of input.printingPlacements) {
    labels.push(`Printing: ${placement.name}`);
  }
  return labels;
}

function buildItemNote(input: {
  serviceType: string | null;
  embroideryPlacements: WebsiteQuotePlacementRow[];
  printingPlacements: WebsiteQuotePlacementRow[];
}): string | null {
  const lines: string[] = [];
  if (input.serviceType) {
    lines.push(`Service: ${input.serviceType}`);
  }
  for (const placement of input.embroideryPlacements) {
    lines.push(`Embroidery: ${placement.name}`);
  }
  for (const placement of input.printingPlacements) {
    lines.push(`Printing: ${placement.name}`);
  }
  return lines.length > 0 ? lines.join("\n") : null;
}

function buildQuoteBoxNote(input: {
  customerNotes: string | null;
  resolvedProducts: WebsiteQuoteProductRow[];
  unresolvedProductLines: string[];
  productSpecRaw: string;
  productLines?: WebsiteQuoteProductLineV1[];
}): string {
  const parts: string[] = [];
  if (input.customerNotes?.trim()) {
    parts.push(input.customerNotes.trim());
  }
  if (!input.productLines?.length && input.resolvedProducts.length > 1) {
    parts.push(`Additional products: ${input.resolvedProducts.slice(1).map((p) => p.name).join("; ")}`);
  }
  if (input.unresolvedProductLines.length > 0) {
    parts.push(input.unresolvedProductLines.join("\n"));
  }
  const spec = input.productSpecRaw.trim();
  if (!input.resolvedProducts.length && spec) {
    parts.push(`Product request: ${spec}`);
  }
  return parts.join("\n\n");
}

function buildSheetItems(
  input: WebsiteQuoteSheetInput,
  placementsJson: string,
  itemNote: string | null,
): AdminCustomerQuoteSheetV1["items"] {
  if (input.productLines?.length) {
    const resolvedById = new Map(input.resolvedProducts.map((product) => [product.id, product]));
    return input.productLines.map((line, index) => {
      const resolved = line.productId ? resolvedById.get(line.productId) : undefined;
      const itemId =
        resolved?.slug?.trim() ||
        resolved?.name?.trim() ||
        line.productName.trim() ||
        firstProductSpecToken(input.productSpecRaw) ||
        "Product — confirm with customer";
      const productName = resolved?.name?.trim() || line.productName.trim() || itemId;
      const quantity = line.quantity > 0 ? line.quantity : 1;
      return {
        productId: itemId,
        productName,
        quantity,
        unitPriceCents: 0,
        lineTotalCents: 0,
        serviceType: resolved?.supplier_name?.trim() || null,
        color: line.color?.trim() ? line.color.trim() : null,
        size: null,
        placementsJson,
        notes: index === 0 ? itemNote : null,
        gender: "",
        quoteGroupId: index + 1,
      };
    });
  }

  const qty = typeof input.quantity === "number" && input.quantity > 0 ? input.quantity : 1;
  const primary = input.resolvedProducts[0];
  const itemId = primary?.slug?.trim() || primary?.name?.trim() || firstProductSpecToken(input.productSpecRaw);
  const supplier = primary?.supplier_name?.trim() || null;

  return [
    {
      productId: itemId,
      productName: primary?.name?.trim() || itemId || "Product — confirm with customer",
      quantity: qty,
      unitPriceCents: 0,
      lineTotalCents: 0,
      serviceType: supplier,
      color: input.productColor?.trim() ? input.productColor.trim() : null,
      size: null,
      placementsJson,
      notes: itemNote,
      gender: "",
      quoteGroupId: 1,
    },
  ];
}

/** Map a website Get a Quote submission into the admin Customer Quote spreadsheet shape. */
export function buildWebsiteQuoteCustomerSheet(input: WebsiteQuoteSheetInput): AdminCustomerQuoteSheetV1 {
  const placementsJson = JSON.stringify(buildPlacementLabels(input));
  const itemNote = buildItemNote(input);

  return {
    v: 1,
    baseOrderNumber: "",
    customerEmail: input.email,
    customerName: input.contactName,
    deliveryAddress: input.phone?.trim()
      ? `Phone: ${input.phone.trim()}`
      : "Address to be confirmed.",
    companyName: input.companyName,
    clientContact: input.phone?.trim() ?? "",
    orderDate: todayPerthYmd(),
    dueDate: "",
    setupFeeCents: 0,
    quoteDeliveryFeeCents: 0,
    depositCents: 0,
    currency: "AUD",
    carrier: "Australia Post",
    status: "unpaid",
    quoteBoxImageUrls: input.logoFileUrl?.trim() ? [input.logoFileUrl.trim()] : [],
    quoteBoxNote: buildQuoteBoxNote(input),
    items: buildSheetItems(input, placementsJson, itemNote),
  };
}

function parseProductLinesFromSpec(productSpec: string): WebsiteQuoteProductLineV1[] | undefined {
  const lines = productSpec
    .split("\n")
    .map((part) => part.trim())
    .filter(Boolean);
  if (lines.length <= 1) {
    return undefined;
  }

  const parsed = lines.map((line) => {
    const match = line.match(/^(.+?)\s*—\s*(\d+)\s*units?$/i);
    if (!match) {
      return {
        productId: null,
        productName: line,
        color: null,
        quantity: 1,
      };
    }

    const label = match[1]!.trim();
    const quantity = Math.max(1, Number.parseInt(match[2]!, 10) || 1);
    const colorMatch = label.match(/^(.+?)\s*\(([^)]+)\)$/);
    if (colorMatch) {
      return {
        productId: null,
        productName: colorMatch[1]!.trim(),
        color: colorMatch[2]!.trim(),
        quantity,
      };
    }

    return {
      productId: null,
      productName: label,
      color: null,
      quantity,
    };
  });

  return parsed.length > 1 ? parsed : undefined;
}

export function getWebsiteQuoteProductLines(websiteQuoteSubmission: unknown): WebsiteQuoteProductLineV1[] {
  const snapshot = parseWebsiteQuoteSubmission(websiteQuoteSubmission);
  if (snapshot?.productLines?.length) {
    return snapshot.productLines;
  }
  return parseProductLinesFromSpec(snapshot?.productSpec ?? "") ?? [];
}

function uniqOrderedPositionIds(ids: string[] | null | undefined, fallbackSingle: string | null): string[] {
  const raw =
    ids && ids.length > 0 ? ids.map((x) => String(x)) : fallbackSingle ? [String(fallbackSingle)] : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of raw) {
    const t = normalizeText(id);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/** Rebuild a Customer Quote sheet from a stored `quote_requests` row (for older submissions). */
export function buildWebsiteQuoteCustomerSheetFromRow(
  row: QuoteRequestRowForCustomerSheet,
  posNameById: Map<string, string>,
  options?: {
    websiteQuoteSubmission?: unknown;
    resolvedProducts?: WebsiteQuoteProductRow[];
  },
): AdminCustomerQuoteSheetV1 {
  const embIds = uniqOrderedPositionIds(row.embroidery_position_ids, row.embroidery_position_id);
  const prtIds = uniqOrderedPositionIds(row.printing_position_ids, row.printing_position_id);

  const embroideryPlacements = embIds.map((id) => ({
    id,
    name: posNameById.get(id) || id,
  }));
  const printingPlacements = prtIds.map((id) => ({
    id,
    name: posNameById.get(id) || id,
  }));

  const snapshot = parseWebsiteQuoteSubmission(options?.websiteQuoteSubmission ?? null);
  const productLines = getWebsiteQuoteProductLines(options?.websiteQuoteSubmission ?? null);
  const hasProductLines = productLines.length > 0 ? productLines : undefined;
  const product = row.products;
  const resolvedProducts =
    options?.resolvedProducts ??
    (row.product_id
      ? [
          {
            id: row.product_id,
            name: product?.name?.trim() || "Quoted product",
            slug: product?.slug ?? null,
            supplier_name: product?.supplier_name?.trim() || "",
          },
        ]
      : []);

  const customerNotes = snapshot?.customerNotes ?? row.notes?.trim() ?? null;

  return buildWebsiteQuoteCustomerSheet({
    companyName: normalizeText(row.company_name),
    contactName: normalizeText(row.contact_name),
    email: normalizeText(row.email),
    phone: row.phone?.trim() ? row.phone.trim() : null,
    productSpecRaw: snapshot?.productSpec || product?.name?.trim() || "",
    resolvedProducts,
    unresolvedProductLines: [],
    quantity: snapshot?.quantity ?? row.quantity,
    serviceType: snapshot?.serviceType ?? (row.service_type?.trim() ? row.service_type.trim() : null),
    productColor: snapshot?.productColor ?? (row.product_color?.trim() ? row.product_color.trim() : null),
    embroideryPlacements,
    printingPlacements,
    logoFileUrl: snapshot?.logoFileUrl ?? (row.logo_file_url?.trim() ? row.logo_file_url.trim() : null),
    customerNotes,
    productLines: hasProductLines,
  });
}

export function websiteQuoteCustomerSheetToInternalTemplate(
  sheet: AdminCustomerQuoteSheetV1,
): import("@/app/admin/(panel)/store-orders/internal-order/actions").InternalOrderTemplate {
  return {
    baseOrderNumber: sheet.baseOrderNumber,
    customerEmail: sheet.customerEmail,
    customerName: sheet.customerName,
    deliveryAddress: sheet.deliveryAddress,
    currency: sheet.currency,
    carrier: sheet.carrier,
    deliveryFeeCents: sheet.quoteDeliveryFeeCents,
    quoteCompanyName: sheet.companyName || undefined,
    quoteContactPhone: sheet.clientContact || undefined,
    customerQuoteDraft: {
      orderDate: sheet.orderDate,
      dueDate: sheet.dueDate,
      setupFeeCents: sheet.setupFeeCents,
      quoteDeliveryFeeCents: sheet.quoteDeliveryFeeCents,
      depositCents: sheet.depositCents,
      status: sheet.status === "paid" || sheet.status === "unpaid" ? sheet.status : "unpaid",
    },
    quoteBoxImageUrls: sheet.quoteBoxImageUrls ?? [],
    quoteBoxNote: sheet.quoteBoxNote ?? "",
    items: sheet.items.map((it) => ({
      productId: it.productId,
      productName: it.productName,
      quantity: it.quantity,
      unitPriceCents: it.unitPriceCents,
      lineTotalCents: it.lineTotalCents,
      serviceType: it.serviceType,
      color: it.color,
      size: it.size,
      placementsJson: it.placementsJson,
      notes: it.notes,
      gender: it.gender || null,
      quoteGroupId: it.quoteGroupId,
    })),
  };
}
