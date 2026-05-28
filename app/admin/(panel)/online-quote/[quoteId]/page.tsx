import Link from "next/link";
import { notFound } from "next/navigation";

import { createSupabaseAdminClient } from "@/lib/supabase";
import { loadOnlineQuoteSubmissionById } from "@/lib/crm/online-quote-submission";

import { OnlineQuoteSubmissionCard } from "../online-quote-submission-card";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ quoteId: string }>;
};

export default async function AdminOnlineQuotePreviewPage({ params }: Props) {
  const { quoteId } = await params;
  const supabase = createSupabaseAdminClient();
  const { quote, error } = await loadOnlineQuoteSubmissionById(supabase, quoteId);

  if (error && !quote) {
    notFound();
  }

  if (!quote) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header className="print:hidden">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin/customer-quote" className="text-brand-orange hover:underline">
            Customer Quote
          </Link>{" "}
          / Online Quote Preview
        </p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-medium text-brand-navy">Original quote submission</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Everything the customer entered on the public <strong>Get a Quote</strong> form.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/customer-quote?quote_id=${encodeURIComponent(quote.id)}`}
              className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-brand-navy hover:brightness-95"
            >
              Open pricing sheet
            </Link>
            <Link
              href="/admin/customer-quote"
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50"
            >
              ← Quote list
            </Link>
          </div>
        </div>
        {error ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Partial data only: {error}
          </p>
        ) : null}
      </header>

      <OnlineQuoteSubmissionCard quote={quote} showActions={false} />
    </div>
  );
}
