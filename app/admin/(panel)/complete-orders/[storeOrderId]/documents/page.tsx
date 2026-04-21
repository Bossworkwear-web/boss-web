import Link from "next/link";
import { notFound } from "next/navigation";

import { StoreOrderBarcode } from "@/app/components/store-order-barcode";
import { appendCompleteOrdersDocQuery } from "@/lib/complete-orders-doc-query";
import { qualityCheckSheetHref } from "@/lib/quality-check-sheet-href";
import { storeOrderScanPayloadFromId } from "@/lib/store-order-scan-code";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f-]{36}$/i;

type Search = { list_date?: string; customer_order_id?: string };

function clickUpSheetHref(listDate: string, customerOrderId: string) {
  const q = new URLSearchParams();
  const ld = listDate.trim();
  const oid = customerOrderId.trim();
  if (ld) q.set("list_date", ld);
  if (oid) q.set("customer_order_id", oid);
  const s = q.toString();
  return appendCompleteOrdersDocQuery(s ? `/admin/click-up-sheet?${s}` : "/admin/click-up-sheet");
}

function completeStatementHref(listDate: string, customerOrderId: string) {
  const q = new URLSearchParams();
  const ld = listDate.trim();
  const oid = customerOrderId.trim();
  if (ld) q.set("list_date", ld);
  if (oid) q.set("customer_order_id", oid);
  const s = q.toString();
  return appendCompleteOrdersDocQuery(s ? `/admin/complete-statement?${s}` : "/admin/complete-statement");
}

const docLinkClass =
  "block rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-brand-orange/40 hover:bg-slate-50/80";

export default async function CompleteOrderDocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ storeOrderId: string }>;
  searchParams: Promise<Search>;
}) {
  const { storeOrderId } = await params;
  const id = (storeOrderId ?? "").trim();
  if (!UUID_RE.test(id)) {
    notFound();
  }

  const q = await searchParams;
  const listDate = (q.list_date ?? "").trim();
  const customerOrderIdParam = (q.customer_order_id ?? "").trim();

  let orderNumber = "";
  try {
    const supabase = createSupabaseAdminClient();
    const { data: order } = await supabase
      .from("store_orders")
      .select("order_number")
      .eq("id", id)
      .maybeSingle();
    orderNumber = (order?.order_number ?? "").trim();
  } catch {
    notFound();
  }

  if (!orderNumber) {
    notFound();
  }

  if (customerOrderIdParam && customerOrderIdParam !== orderNumber) {
    notFound();
  }

  const customerOrderId = customerOrderIdParam || orderNumber;
  const hasListDate = Boolean(listDate);
  const orderScanPayload = storeOrderScanPayloadFromId(id);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin/complete-orders" className="text-brand-orange hover:underline">
            Complete Orders
          </Link>{" "}
          / Documents
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Pre-process documents</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          이 주문(<span className="font-mono font-semibold">{orderNumber}</span>)에 쓰인 Click up·생산·품질·창고·스토어
          서류로 바로 갈 수 있습니다. Perth sheet 날짜·Order ID는 Complete Orders에서 넘어온 값입니다.
        </p>
        <p className="mt-3 max-w-3xl rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          아래 링크는 <strong>참고·열람</strong>용입니다. Complete Orders에 올라온 주문은 연결된 화면에서도{" "}
          <strong>DB·대기열을 바꾸는 작업</strong>(시트 수정, 생산 자산 업로드, Click up 이미지, QC/Dispatch 이동 등)이
          서버에서 막힙니다.
        </p>
        {!hasListDate ? (
          <p className="mt-3 max-w-3xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <strong>Perth sheet date</strong>가 비어 있으면 Click up / Quality Check / Complete statement 링크가
            불완전할 수 있습니다.{" "}
            <Link href="/admin/complete-orders" className="font-semibold text-brand-orange hover:underline">
              Complete Orders 목록
            </Link>
            의 <strong>VIEW</strong>를 사용하세요.
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-end gap-6">
          <StoreOrderBarcode value={orderScanPayload} className="max-w-[min(100%,18rem)]" />
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-navy">Click up · Supplier</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          <li>
            <Link href={clickUpSheetHref(listDate, customerOrderId)} className={docLinkClass}>
              <span className="text-sm font-semibold text-brand-navy">Click up sheet</span>
              <span className="mt-1 block text-xs text-slate-600">워크시트·라인 입력 (list date + order ID)</span>
            </Link>
          </li>
          <li>
            <Link
              href={appendCompleteOrdersDocQuery(
                `/admin/warehouse/worker/order-mockups?order=${encodeURIComponent(orderNumber)}`,
              )}
              className={docLinkClass}
            >
              <span className="text-sm font-semibold text-brand-navy">Order mockups</span>
              <span className="mt-1 block text-xs text-slate-600">Warehouse → Worker 목업·참고 이미지</span>
            </Link>
          </li>
          <li>
            <Link href={appendCompleteOrdersDocQuery("/admin/supplier-orders")} className={docLinkClass}>
              <span className="text-sm font-semibold text-brand-navy">Supplier orders</span>
              <span className="mt-1 block text-xs text-slate-600">시트·Ready for Processing</span>
            </Link>
          </li>
          <li>
            <Link href={appendCompleteOrdersDocQuery("/admin/work-process")} className={docLinkClass}>
              <span className="text-sm font-semibold text-brand-navy">Work process (Click up)</span>
              <span className="mt-1 block text-xs text-slate-600">Click up Order Form·시트 연결 목록</span>
            </Link>
          </li>
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-navy">Production · Quality</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          <li>
            <Link href={appendCompleteOrdersDocQuery(`/admin/production/${id}`)} className={docLinkClass}>
              <span className="text-sm font-semibold text-brand-navy">Production pack</span>
              <span className="mt-1 block text-xs text-slate-600">로고·자수/프린트 자산·인쇄용 팩</span>
            </Link>
          </li>
          <li>
            <Link href={appendCompleteOrdersDocQuery("/admin/quality-control")} className={docLinkClass}>
              <span className="text-sm font-semibold text-brand-navy">Quality Control hub</span>
              <span className="mt-1 block text-xs text-slate-600">QC 큐·Quality Check sheet 열기</span>
            </Link>
          </li>
          <li>
            <Link href={appendCompleteOrdersDocQuery(qualityCheckSheetHref(listDate, customerOrderId))} className={docLinkClass}>
              <span className="text-sm font-semibold text-brand-navy">Quality Check sheet</span>
              <span className="mt-1 block text-xs text-slate-600">체크리스트·검사·Move to Dispatch</span>
            </Link>
          </li>
          <li>
            <Link href={completeStatementHref(listDate, customerOrderId)} className={docLinkClass}>
              <span className="text-sm font-semibold text-brand-navy">Complete statement</span>
              <span className="mt-1 block text-xs text-slate-600">공정·추적·요약 한 페이지</span>
            </Link>
          </li>
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-navy">Store order · Dispatch</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          <li>
            <Link href={appendCompleteOrdersDocQuery(`/admin/store-orders/${id}/docket`)} className={docLinkClass}>
              <span className="text-sm font-semibold text-brand-navy">Delivery docket</span>
              <span className="mt-1 block text-xs text-slate-600">AusPost·배송지 도킷</span>
            </Link>
          </li>
          <li>
            <Link
              href={appendCompleteOrdersDocQuery(`/admin/store-orders/${id}/ordered-items-list`)}
              className={docLinkClass}
            >
              <span className="text-sm font-semibold text-brand-navy">Ordered items list</span>
              <span className="mt-1 block text-xs text-slate-600">피킹·패킹 품목 표</span>
            </Link>
          </li>
          <li>
            <Link href={appendCompleteOrdersDocQuery("/admin/store-orders")} className={docLinkClass}>
              <span className="text-sm font-semibold text-brand-navy">Store orders (admin)</span>
              <span className="mt-1 block text-xs text-slate-600">주문 상태·배송 정보 목록</span>
            </Link>
          </li>
          <li>
            <Link href={appendCompleteOrdersDocQuery("/admin/dispatch")} className={docLinkClass}>
              <span className="text-sm font-semibold text-brand-navy">Dispatch hub</span>
              <span className="mt-1 block text-xs text-slate-600">Dispatch 큐·Print docket·Complete</span>
            </Link>
          </li>
        </ul>
      </section>

      <p className="text-sm text-slate-600">
        <Link href="/admin/complete-orders" className="font-semibold text-brand-orange hover:underline">
          ← Complete Orders 목록
        </Link>
      </p>
    </div>
  );
}
