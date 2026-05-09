import type { Database } from "@/lib/database.types";
import { supplierOrderProductIdHeadTail } from "@/lib/supplier-order-product-id-parts";
import { normalizeSupplierOrderLineSupplierValue } from "@/lib/supplier-order-supplier-normalize";

export type SupplierOrderLineRow = Database["public"]["Tables"]["supplier_order_lines"]["Row"];

export function formatSupplierOrderSheetListDateTitle(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function escHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function productIdCellHtmlForPrint(raw: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return "—";
  const pt = supplierOrderProductIdHeadTail(trimmed);
  if (!pt) {
    return escHtml(trimmed);
  }
  return `<span style="color:rgba(100,116,139,0.6)">${escHtml(pt.head)}-</span><span style="font-size:1.2em;font-weight:700;color:#0f172a">${escHtml(pt.tail)}</span>`;
}

function lineTotalCents(row: SupplierOrderLineRow) {
  return Math.max(0, row.quantity) * Math.max(0, row.unit_price_cents);
}

const aud = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

/** Opens the system print dialog for one Perth list-date sheet (same layout as Admin → Supplier orders → Print). */
export function printSupplierOrderDaySheet(
  ymd: string,
  lines: SupplierOrderLineRow[],
  productImageByProductKey: Record<string, string | null>,
) {
  if (typeof document === "undefined") return;

  const title = `Supplier orders — ${ymd} (Australia/Perth)`;
  const head = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>${escHtml(title)}</title><style>
    body{font-family:ui-sans-serif,system-ui,sans-serif;padding:16px;color:#0f172a;}
    h1{font-size:1.65rem;margin:0 0 12px;font-weight:600;}
    p.meta{font-size:18px;color:#64748b;margin:0 0 16px;}
    table{border-collapse:collapse;width:100%;font-size:16.5px;}
    th,td{border:1px solid #cbd5e1;padding:6px 8px;vertical-align:top;text-align:left;}
    th{background:#f1f5f9;font-weight:600;}
    td.num{font-variant-numeric:tabular-nums;}
    td.product-id-print{text-transform:uppercase;}
    caption{caption-side:top;text-align:left;font-weight:600;padding-bottom:8px;}
  </style></head><body>`;
  const caption = escHtml(formatSupplierOrderSheetListDateTitle(ymd));
  const rowHtml =
    lines.length === 0
      ? `<tr><td colspan="11" style="text-align:left;color:#64748b;padding:24px">No lines for this date.</td></tr>`
      : lines
          .map((r) => {
            const line = aud.format(lineTotalCents(r) / 100);
            const unit = aud.format(Math.max(0, r.unit_price_cents) / 100);
            const imgUrl = productImageByProductKey[r.product_id.trim()] ?? null;
            const imgCell = imgUrl
              ? `<td class="num"><img src="${escHtml(imgUrl)}" alt="" style="max-height:84px;max-width:120px;object-fit:contain;vertical-align:middle;display:block"/></td>`
              : `<td class="num">—</td>`;
            return `<tr>
            <td>${escHtml(normalizeSupplierOrderLineSupplierValue(r.supplier))}</td>
            <td class="num">${escHtml(r.customer_order_id)}</td>
            ${imgCell}
            <td class="num product-id-print">${productIdCellHtmlForPrint(r.product_id ?? "")}</td>
            <td>${escHtml(r.colour)}</td>
            <td>${escHtml(r.size)}</td>
            <td class="num">${r.quantity}</td>
            <td class="num">${r.ordered_date ? escHtml(r.ordered_date) : "—"}</td>
            <td class="num">${r.received_date ? escHtml(r.received_date) : "—"}</td>
            <td class="num">${escHtml(unit)}</td>
            <td class="num">${escHtml(line)}</td>
          </tr>`;
          })
          .join("");
  const table = `<h1>${escHtml(title)}</h1>
    <p class="meta">Printed ${escHtml(new Date().toLocaleString("en-AU", { timeZone: "Australia/Perth", dateStyle: "medium", timeStyle: "short" }))}</p>
    <table><caption>${caption}</caption>
    <thead><tr>
      <th>Supplier name</th><th>Customer order ID</th><th>Image</th><th>Product ID</th><th>Colour</th><th>Size</th><th>Qty</th>
      <th>Ordered</th><th>Received</th><th>Unit (AUD)</th><th>Line</th>
    </tr></thead><tbody>${rowHtml}</tbody></table></body></html>`;

  const fullHtml = head + table;

  function writeAndPrint(target: Window) {
    target.document.open();
    target.document.write(fullHtml);
    target.document.close();
    target.focus();
    target.print();
  }

  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", "Supplier order sheet print");
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    inset: "0",
    width: "0",
    height: "0",
    border: "none",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(iframe);
  const iwin = iframe.contentWindow;
  if (!iwin) {
    document.body.removeChild(iframe);
    window.alert("Could not open print preview. Try allowing pop-ups for this site, or use your browser print (⌘P).");
    return;
  }
  writeAndPrint(iwin);
  const removeIframe = () => {
    if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
  };
  iwin.addEventListener("afterprint", removeIframe, { once: true });
  setTimeout(removeIframe, 120_000);
}
