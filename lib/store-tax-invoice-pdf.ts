import PDFDocument from "pdfkit";

import { formatMoneyFromCents } from "@/lib/store-order-utils";
import { resolveTaxInvoiceLogoFilePath } from "@/lib/tax-invoice-logo";

import {
  billToDisplayName,
  sellerBankBlockLines,
  type TaxInvoiceLine,
  type TaxInvoiceOrder,
  type TaxInvoiceSeller,
} from "./store-tax-invoice";

type PdfDoc = InstanceType<typeof PDFDocument>;

/** Tighter than before so typical invoices stay on one A4 page. */
const PAGE_MARGIN = 40;
const TAX_INVOICE_TITLE_PT = 26; /* was 20; +30% */
const MUTED = "#64748b";
const BODY = "#0f172a";
const RULE = "#cbd5e1";

/** Storefront line totals are treated as GST-inclusive (10% GST). */
function exGstCents(inclusiveCents: number): number {
  const n = Number(inclusiveCents);
  if (!Number.isFinite(n) || n <= 0) {
    return 0;
  }
  return Math.round(n / 1.1);
}

export function buildStoreTaxInvoicePdfBuffer(
  seller: TaxInvoiceSeller,
  order: TaxInvoiceOrder,
  lines: TaxInvoiceLine[],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({
      size: "A4",
      margin: PAGE_MARGIN,
      info: {
        Title: `Tax invoice ${order.order_number}`,
        Author: seller.legalName || "Store",
      },
    });

    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageW = doc.page.width;
    const contentW = pageW - PAGE_MARGIN * 2;
    const innerRight = pageW - PAGE_MARGIN;
    const currency = order.currency || "AUD";

    const invoiceDateStr = new Date(order.created_at).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Australia/Perth",
    });

    const metaW = 132;
    const metaX = innerRight - metaW;
    const headerTop = PAGE_MARGIN;
    const logoPath = resolveTaxInvoiceLogoFilePath();
    const logoSlotH = 38;
    /** Blank space under logo ≈ two lines of meta text before company / Invoice Date. */
    const LOGO_UNDER_TWO_LINES_PT = 22;
    let logoRendered = false;

    doc.fillColor(BODY).font("Helvetica-Bold").fontSize(TAX_INVOICE_TITLE_PT).text("TAX INVOICE", PAGE_MARGIN, headerTop + 6, {
      width: metaX - PAGE_MARGIN - 16,
      lineBreak: false,
    });
    const leftHeaderBottom = doc.y;

    let yMeta = headerTop;
    if (logoPath) {
      try {
        doc.image(logoPath, metaX, yMeta, { fit: [metaW, logoSlotH] });
        logoRendered = true;
      } catch {
        /* invalid image */
      }
    }
    if (logoRendered) {
      yMeta = headerTop + logoSlotH + LOGO_UNDER_TWO_LINES_PT;
      if (seller.legalName) {
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(BODY).text(seller.legalName, metaX, yMeta, { width: metaW });
        yMeta = doc.y + 1;
      }
      if (seller.abn) {
        doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(`ABN ${seller.abn}`, metaX, yMeta, { width: metaW });
        yMeta = doc.y + 1;
      }
      yMeta += 5;
    }

    doc.font("Helvetica").fontSize(7).fillColor(MUTED).text("Invoice Date", metaX, yMeta, { width: metaW });
    yMeta = doc.y + 1;
    doc.fontSize(9.5).fillColor(BODY).text(invoiceDateStr, metaX, yMeta, { width: metaW });
    yMeta = doc.y + 6;
    doc.fontSize(7).fillColor(MUTED).text("Invoice Number", metaX, yMeta, { width: metaW });
    yMeta = doc.y + 1;
    doc.fontSize(9.5).fillColor(BODY).text(order.order_number ?? "—", metaX, yMeta, { width: metaW });
    yMeta = doc.y + 6;
    doc.fontSize(7).fillColor(MUTED).text("Reference", metaX, yMeta, { width: metaW });
    yMeta = doc.y + 1;
    const refText = (order.invoice_reference ?? "").trim();
    if (refText) {
      doc.fontSize(9.5).fillColor(BODY).text(refText, metaX, yMeta, { width: metaW });
      yMeta = doc.y + 6;
    } else {
      yMeta += 9;
    }

    let y = Math.max(leftHeaderBottom + 6, yMeta + 6);

    const addr = (seller.addressLines ?? "").trim();
    if (addr) {
      doc.font("Helvetica").fontSize(9.5).fillColor(BODY).text(addr, PAGE_MARGIN, y, {
        width: metaX - PAGE_MARGIN - 16,
        lineGap: 2,
      });
      y = doc.y + 4;
    }

    const contactLabelW = 14;
    const contactX = PAGE_MARGIN + contactLabelW;
    doc.font("Helvetica").fontSize(9).fillColor(BODY);
    if (seller.phone) {
      const rowTop = y;
      doc.font("Helvetica-Bold").text("M", PAGE_MARGIN, rowTop, { width: contactLabelW });
      doc.font("Helvetica").text(seller.phone, contactX, rowTop, { width: metaX - contactX - 16 });
      y = Math.max(doc.y, rowTop + 10) + 3;
    }
    if (seller.email) {
      const rowTop = y;
      doc.font("Helvetica-Bold").text("E", PAGE_MARGIN, rowTop, { width: contactLabelW });
      doc.font("Helvetica").text(seller.email, contactX, rowTop, { width: metaX - contactX - 16 });
      y = Math.max(doc.y, rowTop + 10) + 3;
    }
    if (seller.website) {
      const rowTop = y;
      doc.font("Helvetica-Bold").text("W", PAGE_MARGIN, rowTop, { width: contactLabelW });
      doc.font("Helvetica").text(seller.website, contactX, rowTop, { width: metaX - contactX - 16 });
      y = Math.max(doc.y, rowTop + 10) + 3;
    }

    y += 10;

    doc.font("Helvetica-Bold").fontSize(11.25).fillColor(MUTED).text("BILL TO", PAGE_MARGIN, y);
    y = doc.y + 4;
    const billBlock = billToDisplayName(order);
    doc.font("Helvetica").fontSize(14.25).fillColor(BODY).text(billBlock, PAGE_MARGIN, y, {
      width: contentW,
      lineGap: 3,
    });
    y = doc.y + 14;

    /** Description share was 0.36 of content width; +30% width → 0.36 × 1.3. */
    const descW = Math.round(contentW * 0.36 * 1.3);
    const qtyW = 52;
    const unitW = 78;
    const gstW = 36;
    const amtW = contentW - descW - qtyW - unitW - gstW - 24;
    const qtyX = PAGE_MARGIN + descW + 6;
    const unitX = qtyX + qtyW + 6;
    const gstX = unitX + unitW + 6;
    const amtX = gstX + gstW + 6;

    doc.font("Helvetica-Bold").fontSize(7).fillColor(MUTED);
    doc.text("Description", PAGE_MARGIN, y, { width: descW });
    doc.text("Quantity", qtyX, y, { width: qtyW, align: "right" });
    doc.text("Unit Price", unitX, y, { width: unitW, align: "right" });
    doc.text("GST", gstX, y, { width: gstW, align: "right" });
    doc.text("Amount AUD", amtX, y, { width: amtW, align: "right" });
    y = doc.y + 4;
    doc.moveTo(PAGE_MARGIN, y).lineTo(innerRight, y).strokeColor(RULE).lineWidth(0.75).stroke();
    y += 6;

    doc.font("Helvetica").fontSize(8.5).fillColor(BODY);

    let tableExSum = 0;

    const drawLineRow = (desc: string, qty: number, unitExCents: number, lineExCents: number) => {
      const rowTop = y;
      doc.text(desc, PAGE_MARGIN, rowTop, { width: descW, lineGap: 0.5 });
      const descBottom = doc.y;
      doc.text(qty.toFixed(2), qtyX, rowTop, { width: qtyW, align: "right" });
      doc.text(formatMoneyFromCents(unitExCents, currency), unitX, rowTop, { width: unitW, align: "right" });
      doc.text("10%", gstX, rowTop, { width: gstW, align: "right" });
      doc.text(formatMoneyFromCents(lineExCents, currency), amtX, rowTop, { width: amtW, align: "right" });
      tableExSum += lineExCents;
      y = Math.max(descBottom, rowTop + 11) + 4;
    };

    if (lines.length === 0) {
      doc.fillColor(MUTED).text("No line items", PAGE_MARGIN, y);
      y = doc.y + 8;
    } else {
      for (const row of lines) {
        const bits = [row.service_type, row.color, row.size]
          .map((x) => (x ?? "").trim())
          .filter(Boolean);
        const name = row.product_name ?? "";
        const descPlain = bits.length > 0 ? `${name} (${bits.join(" · ")})` : name;
        const qRaw = Number(row.quantity);
        const q = Number.isFinite(qRaw) && qRaw > 0 ? qRaw : 1;
        const lineEx = exGstCents(row.line_total_cents);
        const unitEx = Math.round(lineEx / q);
        drawLineRow(descPlain, q, unitEx, lineEx);
      }
    }

    if (order.delivery_fee_cents > 0) {
      const dEx = exGstCents(order.delivery_fee_cents);
      drawLineRow("Delivery", 1, dEx, dEx);
    }

    y += 3;
    doc.moveTo(PAGE_MARGIN, y).lineTo(innerRight, y).strokeColor(RULE).lineWidth(0.5).stroke();
    y += 8;

    const totalInc = Number(order.total_cents) || 0;
    const gstComponent = Math.max(0, totalInc - tableExSum);
    const totalsLabelW = 200;
    const totalsX = amtX - totalsLabelW - 8;

    doc.font("Helvetica").fontSize(9.5).fillColor(BODY);
    doc.text("Subtotal", totalsX, y, { width: totalsLabelW, align: "right" });
    doc.text(formatMoneyFromCents(tableExSum, currency), amtX, y, { width: amtW, align: "right" });
    y = doc.y + 6;

    doc.font("Helvetica-Bold").fontSize(9.5).text("TOTAL GST 10%", totalsX, y, { width: totalsLabelW, align: "right" });
    doc.text(formatMoneyFromCents(gstComponent, currency), amtX, y, { width: amtW, align: "right" });
    y = doc.y + 6;

    doc.font("Helvetica-Bold").fontSize(10.5).text("TOTAL AUD", totalsX, y, { width: totalsLabelW, align: "right" });
    doc.text(formatMoneyFromCents(totalInc, currency), amtX, y, { width: amtW, align: "right" });
    y = doc.y + 10;

    const bankLines = sellerBankBlockLines(seller);
    const bankBlock = bankLines.join("\n");
    /** Space reserved for “-- 1 of 1 --” under the bank block. */
    const FOOTER_BAND_PT = 22;
    const bankLineGap = 2;
    if (bankBlock) {
      doc.font("Helvetica").fontSize(8.5).fillColor(BODY);
      const h = doc.heightOfString(bankBlock, { width: contentW, lineGap: bankLineGap });
      const bankBottomLimit = doc.page.maxY() - FOOTER_BAND_PT;
      let bankY = Math.max(y, bankBottomLimit - h);
      if (bankY + h > bankBottomLimit) {
        bankY = bankBottomLimit - h;
      }
      if (bankY < y - 0.5) {
        bankY = y;
      }
      doc.font("Helvetica").fontSize(8.5).fillColor(BODY).lineGap(bankLineGap);
      doc.text(bankBlock, PAGE_MARGIN, bankY, { width: contentW, lineGap: bankLineGap });
    }

    // Footer must sit above page.maxY() minus one line height, or PDFKit's
    // LineWrapper calls continueOnNewPage() and emits a blank second page.
    doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
    const footerLineH = doc.currentLineHeight(true);
    const footerY = doc.page.maxY() - footerLineH - 4;
    doc.text("-- 1 of 1 --", PAGE_MARGIN, footerY, { width: contentW, align: "center" });

    doc.end();
  });
}
