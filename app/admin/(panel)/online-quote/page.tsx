import Link from "next/link";

import { createSupabaseAdminClient } from "@/lib/supabase";
import { getPerthDayUtcRange } from "@/lib/perth-calendar";
import { loadOnlineQuoteSubmissionsForDay } from "@/lib/crm/online-quote-submission";

import { OnlineQuoteSubmissionCard } from "./online-quote-submission-card";

export const dynamic = "force-dynamic";

type Search = {
  date?: string;
};

function parseDateParam(raw: string | undefined): Date {
  const value = (raw ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T12:00:00+08:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

export default async function AdminOnlineQuotePage({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  const selectedDate = parseDateParam(q.date);
  const dayRange = getPerthDayUtcRange(selectedDate);

  let quotes: Awaited<ReturnType<typeof loadOnlineQuoteSubmissionsForDay>>["quotes"] = [];
  let loadError: string | null = null;

  try {
    const supabase = createSupabaseAdminClient();
    const result = await loadOnlineQuoteSubmissionsForDay(supabase, dayRange);
    quotes = result.quotes;
    loadError = result.error;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load online quotes.";
  }

  const prevDate = new Date(Date.parse(`${dayRange.label}T12:00:00+08:00`) - 24 * 60 * 60 * 1000);
  const nextDate = new Date(Date.parse(`${dayRange.label}T12:00:00+08:00`) + 24 * 60 * 60 * 1000);
  const prevLabel = getPerthDayUtcRange(prevDate).label;
  const nextLabel = getPerthDayUtcRange(nextDate).label;
  const todayLabel = getPerthDayUtcRange(new Date()).label;
  const isToday = dayRange.label === todayLabel;

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin" className="text-brand-orange hover:underline">
            Dashboard
          </Link>{" "}
          / Online Quote
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Online Quote</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Today&apos;s website <strong>Get a Quote</strong> submissions, shown in the original form layout. Use{" "}
          <Link href="/admin/customer-quote" className="font-semibold text-brand-orange hover:underline">
            Customer Quote
          </Link>{" "}
          to price and save a quote for the customer.
        </p>
      </header>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-brand-navy">
            {isToday ? "Today" : dayRange.label}{" "}
            <span className="font-normal text-slate-600">(Australia/Perth)</span>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {quotes.length} submission{quotes.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/online-quote?date=${encodeURIComponent(prevLabel)}`}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50"
          >
            ← Previous day
          </Link>
          {!isToday ? (
            <Link
              href="/admin/online-quote"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50"
            >
              Today
            </Link>
          ) : null}
          <Link
            href={`/admin/online-quote?date=${encodeURIComponent(nextLabel)}`}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-slate-50"
          >
            Next day →
          </Link>
        </div>
      </section>

      {loadError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950">{loadError}</p>
      ) : null}

      {quotes.length === 0 && !loadError ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-10 text-center text-sm text-slate-600">
          No website quote submissions for {isToday ? "today" : dayRange.label}.
        </p>
      ) : (
        <div className="grid gap-6">
          {quotes.map((quote) => (
            <OnlineQuoteSubmissionCard key={quote.id} quote={quote} collapsible />
          ))}
        </div>
      )}
    </div>
  );
}
