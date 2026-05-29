import Link from "next/link";

import { ensureCustomerQuoteNumber } from "@/lib/customer-quote-number";
import { getQuoteCatalogProducts } from "@/lib/quote-catalog-products";
import { createSupabaseAdminClient } from "@/lib/supabase";

import { CustomerQuoteList, type CustomerQuoteListRow } from "./customer-quote-list";
import {
  getTemplateByCustomerIdAndCompany,
  getTemplateByOrderNumber,
  getTemplateFromQuoteRequest,
  loadCustomerQuoteTemplate,
  type InternalOrderTemplate,
} from "../store-orders/internal-order/actions";
import { EMPTY_INTERNAL_ORDER_TEMPLATE } from "../store-orders/internal-order/empty-template";
import { InternalOrderForm } from "../store-orders/internal-order/internal-order-form";

export const dynamic = "force-dynamic";

function withAutoQuoteNumber(template: InternalOrderTemplate, quoteRequestId: string): InternalOrderTemplate {
  return {
    ...template,
    baseOrderNumber: ensureCustomerQuoteNumber(template.baseOrderNumber, {
      quoteRequestId: quoteRequestId || null,
    }),
  };
}

type Search = {
  create?: string;
  from?: string;
  customer_id?: string;
  company?: string;
  quote_id?: string;
  created?: string;
  quote_saved?: string;
  deleted?: string;
  error?: string;
};

export default async function AdminCustomerQuotePage({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  const createFlag = (q.create ?? "").trim();
  const createMode = createFlag === "1" || createFlag === "true";
  const quoteId = (q.quote_id ?? "").trim();
  const from = (q.from ?? "").trim();
  const customerId = (q.customer_id ?? "").trim();
  const company = (q.company ?? "").trim();
  const hasTemplateLoad = Boolean(quoteId || from || (customerId && company));
  /** Success-only URL (`?created=`) shows the list + banner; errors still open the form. */
  const showForm = createMode || hasTemplateLoad || Boolean(q.error);

  let template: Awaited<ReturnType<typeof getTemplateByOrderNumber>> | null = null;
  let loadError: string | null = null;

  if (showForm && (quoteId || from || (customerId && company))) {
    try {
      if (quoteId) {
        template = await getTemplateFromQuoteRequest(quoteId);
      } else if (from) {
        template = await getTemplateByOrderNumber(from);
      } else {
        template = await getTemplateByCustomerIdAndCompany(customerId, company);
      }
    } catch (e) {
      loadError = e instanceof Error ? e.message : "Could not load template.";
    }
  }

  let quoteList: CustomerQuoteListRow[] = [];
  if (!showForm) {
    try {
      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("quote_requests")
        .select("id, company_name, contact_name, email, pipeline_stage, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!error && data?.length) {
        quoteList = data as CustomerQuoteListRow[];
      }
    } catch {
      quoteList = [];
    }
  }

  let catalog: Awaited<ReturnType<typeof getQuoteCatalogProducts>> = [];
  if (showForm) {
    try {
      catalog = await getQuoteCatalogProducts();
    } catch {
      catalog = [];
    }
  }

  let banner: { kind: "ok" | "err"; text: string } | null = null;
  if (q.created) {
    banner = { kind: "ok", text: `Created order: ${q.created}` };
  } else if (q.quote_saved === "1") {
    banner = { kind: "ok", text: "견적이 저장되어 Quote list에 반영되었습니다." };
  } else if (q.deleted === "1") {
    banner = { kind: "ok", text: "견적이 목록에서 삭제되었습니다." };
  } else if (q.error === "invalid_quote_id") {
    banner = { kind: "err", text: "삭제할 견적 ID가 올바르지 않습니다." };
  } else if (q.error === "missing_order_number") {
    banner = { kind: "err", text: "Customer Order ID를 입력하세요." };
  } else if (q.error === "missing_lookup_fields") {
    banner = {
      kind: "err",
      text: "Customer Order ID를 입력하거나, Customer ID(UUID)와 Company name을 함께 입력하세요.",
    };
  } else if (q.error === "missing_fields") {
    banner = { kind: "err", text: "Customer email/name, delivery address는 필수입니다." };
  } else if (q.error === "invalid_items_json") {
    banner = { kind: "err", text: "Items payload가 올바르지 않습니다. 새로고침 후 다시 시도하세요." };
  } else if (q.error === "no_items") {
    banner = { kind: "err", text: "최소 1개 아이템이 필요합니다." };
  } else if (q.error === "missing_sheet" || q.error === "invalid_sheet_json" || q.error === "invalid_sheet") {
    banner = { kind: "err", text: "견적 저장 데이터가 올바르지 않습니다. 새로고침 후 다시 시도하세요." };
  } else if (q.error === "invalid_sheet_version" || q.error === "invalid_sheet_items") {
    banner = { kind: "err", text: "저장된 견적 형식이 맞지 않습니다." };
  } else if (q.error) {
    try {
      banner = { kind: "err", text: decodeURIComponent(q.error.replace(/\+/g, " ")) };
    } catch {
      banner = { kind: "err", text: q.error };
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin" className="text-brand-orange hover:underline">
            Dashboard
          </Link>{" "}
          / Customer Quote
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Customer Quote</h1>
        {showForm ? (
          <p className="mt-2 max-w-3xl text-sm text-slate-600 print:hidden">
            <strong>Internal order</strong>와 동일한 품목·금액 표를 사용합니다. 기존 주문을 불러오거나 빈 견적으로 시작한 뒤 라인·가격·주소를
            수정하세요. <strong>Save Quote</strong>로 CRM 견적 목록에 저장하고, 확정 시 <strong>Make Store order</strong>로 새 스토어 주문을 만듭니다 (
            <Link href="/admin/instore-orders/internal-order" className="font-semibold text-brand-orange hover:underline">
              Instore order
            </Link>
            과 동일한 주문 생성 규칙).
          </p>
        ) : (
          <p className="mt-2 max-w-3xl text-sm text-slate-600 print:hidden">
            CRM 견적 목록에서 열거나 <strong>Create Quote</strong>로 새 견적 폼을 시작합니다.
          </p>
        )}
      </header>

      {banner ? (
        <div
          className={
            banner.kind === "ok"
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
              : "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950"
          }
        >
          {banner.text}
        </div>
      ) : null}

      {!showForm ? (
        <CustomerQuoteList quotes={quoteList} />
      ) : (
        <>
          <p className="print:hidden">
            <Link
              href="/admin/customer-quote"
              className="text-sm font-semibold text-brand-orange hover:underline"
            >
              ← Quote list
            </Link>
          </p>

          <section className="customer-quote-load-template print:hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-brand-navy">Load template</h2>
            <p className="mt-2 text-sm text-slate-600">
              Internal order와 동일하게 <strong>Customer Order ID</strong> 또는 <strong>Customer ID</strong> + <strong>Company name</strong>
              으로 최근 스토어 주문 품목을 불러옵니다. CRM에서는 <span className="font-mono">?quote_id=</span> 로도 열 수 있습니다.
            </p>
            <form action={loadCustomerQuoteTemplate} className="mt-4 space-y-5">
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex min-w-[16rem] flex-1 flex-col gap-1 text-xs font-semibold text-slate-600">
                  Customer Order ID
                  <input
                    name="order_number"
                    defaultValue={from}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-brand-navy"
                    placeholder="BOS_20260416_001"
                  />
                </label>
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Or by customer</p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs font-semibold text-slate-600">
                  Customer ID
                  <input
                    name="customer_id"
                    defaultValue={customerId}
                    className="rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm text-brand-navy"
                    placeholder="customer_profiles.id (UUID)"
                    autoComplete="off"
                  />
                </label>
                <label className="flex min-w-[14rem] flex-1 flex-col gap-1 text-xs font-semibold text-slate-600">
                  Company name
                  <input
                    name="company_name"
                    defaultValue={company}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-brand-navy"
                    placeholder="Matches organisation on profile"
                    autoComplete="organization"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-navy/90"
                >
                  Load
                </button>
              </div>
            </form>
            {loadError ? (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                {loadError}
              </p>
            ) : null}
          </section>

          {quoteId ? (
            <p className="rounded-lg border border-brand-orange/30 bg-brand-orange/10 px-4 py-3 text-sm text-brand-navy">
              고객이 보낸 원본 내용은{" "}
              <Link
                href={`/admin/online-quote/${encodeURIComponent(quoteId)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-brand-orange hover:underline"
              >
                Preview original submission
              </Link>
              에서 확인하세요. 아래 표는 staff용 견적 가격표입니다.
            </p>
          ) : null}

          {quoteId && template && !loadError ? (
            <p className="rounded-lg border border-brand-navy/15 bg-brand-navy/5 px-4 py-3 text-sm text-brand-navy">
              <strong>CRM quote</strong>에서 불러왔습니다. 금액·배송지·라인을 조정한 뒤 <strong>Save Quote</strong>로 목록에 저장하거나{" "}
              <strong>Make Store order</strong>로 주문을 생성하세요.
            </p>
          ) : null}

          <InternalOrderForm
            template={withAutoQuoteNumber(template ?? EMPTY_INTERNAL_ORDER_TEMPLATE, quoteId)}
            isBlankStarter={template === null || template.baseOrderNumber.trim() === ""}
            variant="customer-quote"
            quoteRequestId={quoteId || null}
            catalog={catalog}
          />
        </>
      )}
    </div>
  );
}
