import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { PIPELINE_LABELS, isPipelineStage, type PipelineStage } from "@/lib/crm/pipeline";

import { ensureQuotePortalToken } from "../../actions";
import { loadCrmQuoteRowById } from "../../load-crm-quote-row";
import { CustomerEmailDraftForm } from "./customer-email-draft-form";
import { CustomerQuotePortalLink } from "./customer-quote-portal-link";
import { MarkQuoteSentButton } from "./mark-quote-sent-button";
import { EmbroideryPrintServiceBox } from "./embroidery-print-service-box";
import { QuoteMockupUploader } from "./quote-mockup-uploader";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Perth",
  });
}

function detail(text: string | null | undefined) {
  const t = text?.trim();
  return t ? t : "—";
}

async function requestOrigin(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = (h.get("x-forwarded-proto") ?? "https").split(",")[0]?.trim() ?? "https";
  return host ? `${proto}://${host}` : "";
}

type PageProps = { params: Promise<{ quoteId: string }> };

export default async function CrmSendQuotePage({ params }: PageProps) {
  const { quoteId } = await params;
  let quote = await loadCrmQuoteRowById(quoteId);
  if (!quote) notFound();

  if (quote.pipeline_stage === "quote" && !(quote.quote_portal_token ?? "").trim()) {
    await ensureQuotePortalToken(quoteId);
    quote = (await loadCrmQuoteRowById(quoteId))!;
  }

  const origin = await requestOrigin();
  const portalToken = (quote.quote_portal_token ?? "").trim();
  const customerAcceptAbsoluteUrl =
    quote.pipeline_stage === "quote" && portalToken
      ? `${origin}/quote/accept/${encodeURIComponent(quote.id)}?token=${encodeURIComponent(portalToken)}`
      : null;
  const customerAcceptIframeSrc = customerAcceptAbsoluteUrl
    ? `${customerAcceptAbsoluteUrl}&embed=1`
    : null;

  const stage: PipelineStage = isPipelineStage(quote.pipeline_stage) ? quote.pipeline_stage : "enquiry";
  const stageLabel = PIPELINE_LABELS[stage] ?? quote.pipeline_stage;
  const canAdvanceFromEnquiry = stage === "enquiry";

  const placement =
    quote.placement_labels && quote.placement_labels.length > 0
      ? quote.placement_labels.join(", ")
      : "—";
  const qty =
    quote.quantity === null || quote.quantity === undefined ? "—" : String(quote.quantity);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin" className="text-brand-orange hover:underline">
            Dashboard
          </Link>{" "}
          /{" "}
          <Link href="/admin/crm" className="text-brand-orange hover:underline">
            CRM
          </Link>{" "}
          / Send quote
        </p>
        <h1 className="text-3xl font-medium text-brand-navy">Quote page</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Draft the customer email (product, GST-inclusive total, lead time, delivery), then review the enquiry below.
          Use <strong>Mark as quote sent</strong> to email the draft to the customer; the deal moves to{" "}
          <strong>Quote sent</strong> only after that email is accepted by the provider (Resend).
        </p>
      </header>

      {!canAdvanceFromEnquiry ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          This lead is not in <strong>Enquiry</strong> (current stage: <strong>{stageLabel}</strong>). Use the CRM
          pipeline or lead table to change the stage if you need to move it elsewhere.
        </p>
      ) : null}

      {customerAcceptAbsoluteUrl ? (
        <CustomerQuotePortalLink absoluteUrl={customerAcceptAbsoluteUrl} />
      ) : null}

      {quote.quote_customer_accepted_at ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-sm text-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">Customer acceptance</p>
          <p className="mt-1 text-xs text-slate-600">
            Accepted online ·{" "}
            <span className="font-medium text-slate-800">{formatWhen(quote.quote_customer_accepted_at)}</span>
            {" · "}
            Pipeline is now <strong>Approval</strong> (or later if moved again).
          </p>
          {typeof quote.quote_customer_accept_payload === "object" &&
          quote.quote_customer_accept_payload !== null &&
          "email_body_snapshot" in quote.quote_customer_accept_payload &&
          typeof (quote.quote_customer_accept_payload as { email_body_snapshot?: unknown }).email_body_snapshot ===
            "string" ? (
            <pre className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-emerald-100 bg-white p-3 font-sans text-xs leading-relaxed text-slate-800">
              {(quote.quote_customer_accept_payload as { email_body_snapshot: string }).email_body_snapshot}
            </pre>
          ) : null}
          {quote.quote_customer_accept_comment?.trim() ? (
            <div className="mt-3">
              <p className="text-xs font-semibold text-emerald-900">Customer comment</p>
              <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-emerald-100 bg-white p-3 font-sans text-xs leading-relaxed text-slate-800">
                {quote.quote_customer_accept_comment.trim()}
              </pre>
            </div>
          ) : null}
        </section>
      ) : null}

      <CustomerEmailDraftForm
        quoteId={quote.id}
        contactName={quote.contact_name}
        customerEmail={quote.email}
        companyName={quote.company_name}
        catalogProductId={quote.product_id ?? ""}
        catalogProductName={quote.product_name ?? ""}
        catalogProductColour={quote.product_color ?? ""}
        catalogQuantity={
          quote.quantity !== null && quote.quantity !== undefined ? String(quote.quantity) : ""
        }
        savedQuoteEmailProducts={quote.quote_email_products}
        savedQuoteEmailLeadTime={quote.quote_email_lead_time}
        savedQuoteEmailDeliveryAddress1={quote.quote_email_delivery_address_1}
        savedQuoteEmailDeliveryAddress2={quote.quote_email_delivery_address_2}
        savedQuoteEmailDeliverySuburb={quote.quote_email_delivery_suburb}
        savedQuoteEmailDeliveryState={quote.quote_email_delivery_state}
        savedQuoteEmailDeliveryCountry={quote.quote_email_delivery_country}
        customerAcceptIframeSrc={customerAcceptIframeSrc}
      />

      <EmbroideryPrintServiceBox
        quoteId={quote.id}
        savedEmbroidery={quote.quote_email_embroidery_service}
        savedPrint={quote.quote_email_print_service}
        enquiryServiceType={quote.service_type}
        enquiryEmbroideryPositions={quote.position_name}
        enquiryPrintingPositions={quote.printing_position_name}
      />

      <QuoteMockupUploader quoteId={quote.id} urls={quote.quote_mockup_image_urls ?? []} />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Company</p>
            <p className="mt-1 text-xl font-semibold text-brand-navy">{quote.company_name}</p>
            <p className="mt-1 text-xs text-slate-500">
              Submitted · <span className="font-medium text-slate-700">{formatWhen(quote.created_at)}</span>
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Pipeline stage: <span className="font-semibold text-slate-800">{stageLabel}</span>
            </p>
          </div>
          <Link
            href="/admin/crm"
            className="shrink-0 self-start rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to CRM
          </Link>
        </div>

        <div className="mt-6 space-y-6 text-sm">
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</p>
            <dl className="mt-2 space-y-1.5 text-slate-800">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-xs text-slate-500 sm:w-32">Contact name</dt>
                <dd>{detail(quote.contact_name)}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-xs text-slate-500 sm:w-32">Email</dt>
                <dd className="break-all">{detail(quote.email)}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-xs text-slate-500 sm:w-32">Phone</dt>
                <dd>{detail(quote.phone ?? undefined)}</dd>
              </div>
            </dl>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What they asked for</p>
            <dl className="mt-2 space-y-1.5 text-slate-800">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-xs text-slate-500 sm:w-32">Product</dt>
                <dd>{detail(quote.product_name ?? undefined)}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-xs text-slate-500 sm:w-32">Embroidery position</dt>
                <dd>{detail(quote.position_name ?? undefined)}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-xs text-slate-500 sm:w-32">Printing position</dt>
                <dd>{detail(quote.printing_position_name ?? undefined)}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-xs text-slate-500 sm:w-32">Service type</dt>
                <dd>{detail(quote.service_type ?? undefined)}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-xs text-slate-500 sm:w-32">Colour</dt>
                <dd>{detail(quote.product_color ?? undefined)}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-xs text-slate-500 sm:w-32">Quantity</dt>
                <dd>{qty}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-xs text-slate-500 sm:w-32">Placement labels</dt>
                <dd className="break-words">{placement}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-xs text-slate-500 sm:w-32">Logo file</dt>
                <dd>
                  {quote.logo_file_url?.trim() ? (
                    <a
                      href={quote.logo_file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-brand-orange underline-offset-2 hover:underline"
                    >
                      Open uploaded file
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes (from form)</p>
            <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-3 font-sans text-xs leading-relaxed text-slate-800">
              {quote.notes?.trim() ? quote.notes : "—"}
            </pre>
          </section>

          {quote.internal_notes?.trim() ? (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Internal notes</p>
              <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-amber-100 bg-amber-50/80 p-3 font-sans text-xs text-slate-800">
                {quote.internal_notes}
              </pre>
            </section>
          ) : null}

          <div className="border-t border-slate-100 pt-6">
            <MarkQuoteSentButton quoteId={quote.id} disabled={!canAdvanceFromEnquiry} />
          </div>
        </div>
      </section>
    </div>
  );
}
