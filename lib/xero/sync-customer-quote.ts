import type { AdminCustomerQuoteSheetV1 } from "@/app/admin/(panel)/store-orders/internal-order/actions";
import { ensureCustomerQuoteNumber } from "@/lib/customer-quote-number";
import { addCalendarDaysYmd, todayPerthYmd } from "@/lib/perth-calendar";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { XeroApiError } from "@/lib/xero/api-client";
import { connectionHasInvoiceScope } from "@/lib/xero/config";
import { findOrCreateXeroContact } from "@/lib/xero/contacts";
import { getActiveXeroConnection } from "@/lib/xero/connection-db";
import { createDraftSalesQuote, xeroQuoteViewUrl, type XeroQuoteLineInput } from "@/lib/xero/quotes";

export type SyncCustomerQuoteToXeroResult =
  | {
      ok: true;
      quoteId: string;
      quoteNumber: string;
      openUrl: string;
      contactId: string;
      alreadySynced: boolean;
    }
  | { ok: false; error: string; skipped?: boolean };

function centsToAud(cents: number): number {
  return Math.round(cents) / 100;
}

function buildLineDescription(item: AdminCustomerQuoteSheetV1["items"][number]): string {
  const parts = [item.productName.trim() || item.productId.trim() || "Product"];
  const extras = [item.serviceType, item.color, item.size, item.gender === "M" || item.gender === "F" ? item.gender : null]
    .map((value) => (value ?? "").trim())
    .filter(Boolean);
  if (extras.length) {
    parts.push(`(${extras.join(", ")})`);
  }
  return parts.join(" ");
}

function sheetToXeroLineItems(sheet: AdminCustomerQuoteSheetV1): XeroQuoteLineInput[] {
  const lines: XeroQuoteLineInput[] = [];

  for (const item of sheet.items) {
    const quantity = Math.max(0, Math.trunc(item.quantity));
    if (quantity <= 0) continue;

    const unitCents =
      item.unitPriceCents > 0
        ? item.unitPriceCents
        : item.lineTotalCents > 0
          ? Math.round(item.lineTotalCents / quantity)
          : 0;

    lines.push({
      description: buildLineDescription(item),
      quantity,
      unitAmountExclGst: centsToAud(unitCents),
    });
  }

  if (sheet.setupFeeCents > 0) {
    lines.push({
      description: "Set up fee",
      quantity: 1,
      unitAmountExclGst: centsToAud(sheet.setupFeeCents),
    });
  }

  if (sheet.quoteDeliveryFeeCents > 0) {
    lines.push({
      description: "Delivery fee",
      quantity: 1,
      unitAmountExclGst: centsToAud(sheet.quoteDeliveryFeeCents),
    });
  }

  return lines;
}

function withXeroQuoteMeta(
  sheet: AdminCustomerQuoteSheetV1,
  meta: { quoteId: string; quoteNumber: string },
): AdminCustomerQuoteSheetV1 {
  return {
    ...sheet,
    xeroQuoteId: meta.quoteId,
    xeroQuoteNumber: meta.quoteNumber,
    xeroQuoteSyncedAt: new Date().toISOString(),
  };
}

async function persistXeroQuoteMeta(
  quoteRequestId: string,
  sheet: AdminCustomerQuoteSheetV1,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("quote_requests")
    .update({ admin_customer_quote_sheet: sheet })
    .eq("id", quoteRequestId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function syncCustomerQuoteSheetToXero(
  sheetInput: AdminCustomerQuoteSheetV1,
  quoteRequestId: string | null = null,
): Promise<SyncCustomerQuoteToXeroResult> {
  const quoteRequestIdTrimmed = (quoteRequestId ?? "").trim();
  const sheet: AdminCustomerQuoteSheetV1 = {
    ...sheetInput,
    baseOrderNumber: ensureCustomerQuoteNumber(sheetInput.baseOrderNumber, {
      quoteRequestId: quoteRequestIdTrimmed || null,
    }),
  };

  const existingQuoteId = sheet.xeroQuoteId?.trim() || null;

  if (!sheet.customerEmail.trim()) {
    return { ok: false, error: "Customer email is required for Xero." };
  }
  if (!sheet.customerName.trim()) {
    return { ok: false, error: "Customer name is required for Xero." };
  }
  if (sheet.items.length === 0) {
    return { ok: false, error: "Add at least one quote line before sending to Xero." };
  }

  const lineItems = sheetToXeroLineItems(sheet);
  if (!lineItems.length) {
    return { ok: false, error: "No quantities to send to Xero." };
  }

  try {
    const connection = await getActiveXeroConnection();
    if (!connection) {
      return { ok: false, error: "Xero is not connected. Connect in Admin → Accounting.", skipped: true };
    }

    if (!connectionHasInvoiceScope(connection.scopes)) {
      return {
        ok: false,
        error: "Reconnect Xero with invoice permission (Accounting → Upgrade Xero for invoices & payments).",
        skipped: true,
      };
    }

    const contactId = await findOrCreateXeroContact(connection, {
      name: sheet.companyName.trim() || sheet.customerName.trim(),
      email: sheet.customerEmail.trim(),
    });

    const quoteDateYmd =
      sheet.orderDate.trim() && /^\d{4}-\d{2}-\d{2}$/.test(sheet.orderDate.trim())
        ? sheet.orderDate.trim()
        : todayPerthYmd();
    const expiryDate =
      sheet.dueDate.trim() && /^\d{4}-\d{2}-\d{2}$/.test(sheet.dueDate.trim())
        ? sheet.dueDate.trim()
        : addCalendarDaysYmd(quoteDateYmd, 30);

    const created = await createDraftSalesQuote(connection, {
      quoteId: existingQuoteId,
      contactId,
      quoteNumber: sheet.baseOrderNumber.trim(),
      reference: sheet.baseOrderNumber.trim(),
      quoteDate: quoteDateYmd,
      expiryDate,
      title: sheet.companyName.trim() ? `Quote — ${sheet.companyName.trim()}` : "Quote",
      summary: (sheet.quoteBoxNote ?? "").trim() ? (sheet.quoteBoxNote ?? "").trim().slice(0, 300) : undefined,
      lineItems,
    });

    const savedSheet = withXeroQuoteMeta(sheet, created);
    if (quoteRequestIdTrimmed) {
      await persistXeroQuoteMeta(quoteRequestIdTrimmed, savedSheet);
    }

    return {
      ok: true,
      quoteId: created.quoteId,
      quoteNumber: created.quoteNumber,
      openUrl: xeroQuoteViewUrl(created.quoteId),
      contactId,
      alreadySynced: false,
    };
  } catch (error) {
    if (error instanceof XeroApiError) {
      return { ok: false, error: error.message };
    }
    return { ok: false, error: error instanceof Error ? error.message : "Xero quote sync failed." };
  }
}
