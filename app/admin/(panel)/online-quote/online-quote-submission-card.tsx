import Link from "next/link";

import {
  buildPlacementDiagramSrc,
  formatOnlineQuoteSubmittedAt,
  placementServiceIconSrc,
  PLACEMENT_SERVICE_ICON_ROUNDED,
  type OnlineQuoteSubmissionView,
} from "@/lib/crm/online-quote-submission";

function ReadOnlyField({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1">
      <p className="text-sm font-semibold text-brand-navy">{label}</p>
      <div
        className={`min-h-[2.5rem] rounded-md border border-brand-navy/20 bg-white px-3 py-2 text-sm text-brand-navy ${
          mono ? "font-mono leading-relaxed" : ""
        }`}
      >
        {value || "—"}
      </div>
    </div>
  );
}

function ReadOnlyTextArea({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <p className="text-sm font-semibold text-brand-navy">{label}</p>
      <div className="min-h-[6.5rem] whitespace-pre-wrap rounded-md border border-brand-navy/20 bg-white px-3 py-2 font-mono text-sm leading-relaxed text-brand-navy">
        {value || "—"}
      </div>
    </div>
  );
}

export function OnlineQuoteSubmissionCard({
  quote,
  showActions = true,
  collapsible = false,
}: {
  quote: OnlineQuoteSubmissionView;
  showActions?: boolean;
  collapsible?: boolean;
}) {
  const placementRows = quote.placements;

  const actionButtons = showActions ? (
    <div className="flex flex-wrap gap-2">
      <Link
        href={`/admin/customer-quote?quote_id=${encodeURIComponent(quote.id)}`}
        className="rounded-lg bg-brand-orange px-3 py-2 text-xs font-semibold text-brand-navy hover:brightness-95"
      >
        Open in Customer Quote
      </Link>
      <Link
        href="/admin/crm"
        className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-brand-navy hover:bg-slate-200"
      >
        CRM
      </Link>
    </div>
  ) : null;

  const contactSummary = (
    <>
      <p className="text-sm text-slate-600">
        {quote.contactName} · {quote.email}
        {quote.phone ? ` · ${quote.phone}` : ""}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        Submitted {formatOnlineQuoteSubmittedAt(quote.createdAt)} (AWST)
      </p>
    </>
  );

  const submissionBody = (
    <div className="grid gap-6">
        <section className="grid gap-4">
          <p className="text-sm font-medium uppercase tracking-[0.1em] text-brand-navy/75">Contact Information</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnlyField label="Company Name *" value={quote.companyName} />
            <ReadOnlyField label="Contact Name *" value={quote.contactName} />
            <ReadOnlyField label="Email *" value={quote.email} />
            <ReadOnlyField label="Phone" value={quote.phone ?? ""} />
          </div>
          {quote.logoFileUrl ? (
            <div className="grid gap-1">
              <p className="text-sm font-semibold text-brand-navy">Logo file (PDF, AI, PNG)</p>
              <div className="rounded-md border border-brand-navy/20 bg-white px-3 py-3">
                {/\.(png|jpe?g|webp|gif)(\?|$)/i.test(quote.logoFileUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={quote.logoFileUrl}
                    alt="Uploaded logo"
                    className="max-h-40 rounded-lg border border-brand-navy/10 object-contain"
                  />
                ) : null}
                <a
                  href={quote.logoFileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-semibold text-brand-orange hover:underline"
                >
                  View uploaded logo file
                </a>
              </div>
            </div>
          ) : null}
        </section>

        <section className="grid gap-4">
          <p className="text-sm font-medium uppercase tracking-[0.1em] text-brand-navy/75">Product Options</p>
          <div className="grid gap-3 rounded-lg border border-brand-navy/15 p-4">
            <ReadOnlyTextArea label="Product details" value={quote.productSpec} />
            <div className="grid max-w-xs gap-1">
              <p className="text-sm font-semibold text-brand-navy">Total Quantity</p>
              <div className="rounded-md border border-brand-navy/20 bg-white px-3 py-2 text-sm text-brand-navy">
                {quote.quantity ?? "—"}
              </div>
            </div>
            {quote.productColor ? (
              <ReadOnlyField label="Colour (from product page)" value={quote.productColor} />
            ) : null}
          </div>
        </section>

        <section className="grid gap-3 rounded-lg border border-brand-navy/15 p-4">
          <h3 className="text-sm font-medium uppercase tracking-[0.1em] text-brand-navy/75">
            3. Service Type &amp; Placement Selector
          </h3>
          {quote.serviceType ? (
            <p className="text-sm text-brand-navy/70">
              Service type: <strong>{quote.serviceType}</strong>
            </p>
          ) : null}
          {placementRows.length === 0 ? (
            <p className="text-sm text-brand-navy/55">No placements selected.</p>
          ) : (
            <div className="grid gap-2">
              {placementRows.map((placement) => {
                const diagramSrc = buildPlacementDiagramSrc(placement);
                const iconSrc = placementServiceIconSrc(placement.service);
                return (
                  <div
                    key={`${placement.service}-${placement.id}`}
                    className={`grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl px-2 py-2 sm:px-3 sm:py-3 ${
                      placement.service === "Embroidery" ? "bg-brand-orange/10" : "bg-blue-100"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {diagramSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={diagramSrc}
                          alt=""
                          className="h-14 w-14 rounded-lg border border-brand-navy/10 bg-white object-contain"
                        />
                      ) : null}
                      <span className="text-sm font-semibold text-brand-navy">{placement.name}</span>
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={iconSrc}
                      alt={placement.service}
                      className={`h-12 w-12 object-contain ${PLACEMENT_SERVICE_ICON_ROUNDED}`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="grid gap-4">
          <p className="text-sm font-medium uppercase tracking-[0.1em] text-brand-navy/75">Additional Notes</p>
          <ReadOnlyTextArea label="Notes" value={quote.customerNotes ?? ""} />
          {quote.storedNotes ? (
            <ReadOnlyTextArea label="Stored notes (full database record)" value={quote.storedNotes} />
          ) : null}
        </section>
      </div>
  );

  if (collapsible) {
    return (
      <article className="overflow-hidden rounded-2xl border border-brand-navy/15 bg-white shadow-sm">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-3 px-6 py-4 marker:content-none [&::-webkit-details-marker]:hidden">
            <svg
              aria-hidden
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 shrink-0 text-brand-navy/50 transition group-open:rotate-90"
            >
              <path
                fillRule="evenodd"
                d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                clipRule="evenodd"
              />
            </svg>
            <h2 className="text-xl font-semibold text-brand-navy">{quote.companyName || "—"}</h2>
          </summary>
          <div className="border-t border-brand-navy/10 px-6 pb-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-brand-navy/10 py-4">
              <div>{contactSummary}</div>
              {actionButtons}
            </div>
            <div className="mt-6">{submissionBody}</div>
          </div>
        </details>
      </article>
    );
  }

  return (
    <article className="rounded-2xl border border-brand-navy/15 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-brand-navy/10 pb-4">
        <div>
          <h2 className="text-xl font-semibold text-brand-navy">{quote.companyName || "—"}</h2>
          {contactSummary}
        </div>
        {actionButtons}
      </div>
      <div className="mt-6">{submissionBody}</div>
    </article>
  );
}
