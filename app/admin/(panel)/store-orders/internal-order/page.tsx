import Link from "next/link";

import { createSupabaseAdminClient } from "@/lib/supabase";

import {
  getTemplateByCustomerIdAndCompany,
  getTemplateByOrderNumber,
  getTemplateFromQuoteRequest,
  loadInternalOrderTemplate,
} from "./actions";
import { EMPTY_INTERNAL_ORDER_TEMPLATE } from "./empty-template";
import { InternalOrderForm } from "./internal-order-form";

export const dynamic = "force-dynamic";

type Search = {
  from?: string;
  customer_id?: string;
  company?: string;
  quote_id?: string;
  created?: string;
  error?: string;
};

export default async function AdminInternalOrderPage({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  const quoteId = (q.quote_id ?? "").trim();
  const from = (q.from ?? "").trim();
  const customerId = (q.customer_id ?? "").trim();
  const company = (q.company ?? "").trim();

  let template: Awaited<ReturnType<typeof getTemplateByOrderNumber>> | null = null;
  let loadError: string | null = null;

  if (quoteId || from || (customerId && company)) {
    try {
      // Ensure Supabase is configured early (gives clearer error on missing env).
      createSupabaseAdminClient();
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

  let banner: { kind: "ok" | "err"; text: string } | null = null;
  if (q.created) {
    banner = { kind: "ok", text: `Created: ${q.created}` };
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
          /{" "}
          <Link href="/admin/store-orders" className="text-brand-orange hover:underline">
            Store orders
          </Link>{" "}
          / Internal order
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Create internal order</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          고객 주문이 아닌 내부·현장·메시지·이메일 접수 등으로 주문을 만듭니다. 아래에서 템플릿 없이 바로 입력하거나, 기존 주문을
          불러와 수정한 뒤 저장하면 새 Customer Order ID가 <span className="font-mono">접두어_count</span> 형태로 생성됩니다.
          (접두어를 비우면 서버가 <span className="font-mono">INT_YYYYMMDD_…</span> 형식으로 자동 부여합니다.)
        </p>
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

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-navy">Load template</h2>
        <p className="mt-2 text-sm text-slate-600">
          선택 사항입니다. <strong>Customer Order ID</strong>(order_number)로 불러오거나, <strong>Customer ID</strong>(고객 프로필 UUID)와{" "}
          <strong>Company name</strong>(customer_profiles.organisation, 대소문자 무시 일치)로 해당 고객의{" "}
          <strong>가장 최근</strong> 스토어 주문을 불러옵니다. 둘 다 입력하면 Order ID가 우선합니다. 템플릿 없이 주문을 만들려면 아래{" "}
          <strong>주문 입력</strong> 양식만 작성하면 됩니다.
        </p>
        <form action={loadInternalOrderTemplate} className="mt-4 space-y-5">
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

      {quoteId && template && !loadError ? (
        <p className="rounded-lg border border-brand-navy/15 bg-brand-navy/5 px-4 py-3 text-sm text-brand-navy">
          <strong>CRM quote</strong>에서 불러왔습니다. 금액·배송지·라인을 확인한 뒤{" "}
          <strong>Save as new internal order</strong>로 저장하면 주문이 생성됩니다.
        </p>
      ) : null}

      <InternalOrderForm
        template={template ?? EMPTY_INTERNAL_ORDER_TEMPLATE}
        isBlankStarter={template === null || template.baseOrderNumber.trim() === ""}
      />
    </div>
  );
}

