"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { PIPELINE_LABELS, PIPELINE_STAGES, type PipelineStage } from "@/lib/crm/pipeline";
import { formatMoneyFromCents } from "@/lib/store-order-utils";

import {
  addCrmNote,
  deleteCustomerProfile,
  linkQuoteToCustomer,
  markQuoteContactedNow,
  updateCustomerProfile,
  updateQuoteAutomationPaused,
  updateQuoteFollowUp,
  updateQuoteInternalNotes,
  updateQuotePipelineStage,
} from "./actions";
import type { CrmActivityRow, CrmCustomerRow, CrmNotificationRow, CrmQuoteRow } from "./page";

type Tab = "pipeline" | "leads" | "customers" | "notifications";

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Perth",
  });
}

function toDatetimeLocalValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatStoreOrderTotals(totals: { currency: string; cents: number }[]) {
  if (totals.length === 0) return "—";
  return totals.map((t) => formatMoneyFromCents(t.cents, t.currency)).join(" + ");
}

export function CrmWorkspace({
  quotes,
  customers,
  activities,
  notifications,
  migrationHint,
  serverNowMs,
}: {
  quotes: CrmQuoteRow[];
  customers: CrmCustomerRow[];
  activities: CrmActivityRow[];
  notifications: CrmNotificationRow[];
  migrationHint: string | null;
  /** Single timestamp from the server RSC pass so “due now” matches SSR + hydration. */
  serverNowMs: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>("pipeline");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editCustomer, setEditCustomer] = useState<CrmCustomerRow | null>(null);
  const [pipelineQuoteDetail, setPipelineQuoteDetail] = useState<CrmQuoteRow | null>(null);

  const activitiesByQuote = useMemo(() => {
    const m = new Map<string, CrmActivityRow[]>();
    for (const a of activities) {
      const list = m.get(a.quote_request_id) ?? [];
      if (list.length < 25) {
        list.push(a);
        m.set(a.quote_request_id, list);
      }
    }
    return m;
  }, [activities]);

  const dueFollowUps = useMemo(() => {
    return quotes.filter((q) => {
      if (!q.next_follow_up_at) return false;
      if (q.pipeline_stage === "completion") return false;
      if (q.automation_paused) return false;
      return new Date(q.next_follow_up_at).getTime() <= serverNowMs;
    });
  }, [quotes, serverNowMs]);

  const byStage = useMemo(() => {
    const m: Record<PipelineStage, CrmQuoteRow[]> = {
      enquiry: [],
      quote: [],
      approval: [],
      completion: [],
    };
    for (const q of quotes) {
      const s = (PIPELINE_STAGES as readonly string[]).includes(q.pipeline_stage)
        ? (q.pipeline_stage as PipelineStage)
        : "enquiry";
      m[s].push(q);
    }
    return m;
  }, [quotes]);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setMessage(null);
    startTransition(async () => {
      const r = await action();
      if (!r.ok) {
        setMessage(r.error ?? "Something went wrong");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {migrationHint && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{migrationHint}</p>
      )}

      {dueFollowUps.length > 0 && (
        <section className="rounded-xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-950">
          <p className="font-medium">Follow-ups due ({dueFollowUps.length})</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {dueFollowUps.slice(0, 8).map((q) => (
              <li key={q.id}>
                <strong>{q.company_name}</strong> — {q.contact_name} ({q.email}) · due {q.next_follow_up_at ? formatWhen(q.next_follow_up_at) : "—"}
              </li>
            ))}
          </ul>
          {dueFollowUps.length > 8 && <p className="mt-2 text-xs">+{dueFollowUps.length - 8} more in the table below.</p>}
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["pipeline", "Pipeline"],
              ["leads", "All leads"],
              ["customers", "Customers"],
              ["notifications", "Notifications"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                tab === id ? "bg-brand-navy text-white" : "bg-slate-200 text-slate-800 hover:bg-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <a
          href="/api/admin/crm/export"
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-brand-navy hover:bg-slate-50"
        >
          Export CSV
        </a>
      </div>

      {message && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {message}
        </p>
      )}

      {tab === "pipeline" && (
        <div className="grid gap-3 lg:grid-cols-4">
          {PIPELINE_STAGES.map((stage) => (
            <div key={stage} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-600">{PIPELINE_LABELS[stage]}</p>
              <p className="text-2xl font-medium text-brand-navy">{byStage[stage].length}</p>
              <ul className="mt-3 space-y-2">
                {byStage[stage].map((q) => (
                  <li key={q.id} className="space-y-1.5">
                    <button
                      type="button"
                      className="w-full rounded-lg border border-slate-200 bg-white p-2 text-left text-xs shadow-sm transition hover:border-brand-orange/50 hover:bg-slate-50/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange"
                      onClick={() => setPipelineQuoteDetail(q)}
                    >
                      <p className="font-medium text-brand-navy">{q.company_name}</p>
                      <p className="text-slate-600">{q.contact_name}</p>
                      <p className="truncate text-slate-500">{q.email}</p>
                      <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-brand-orange">View details</p>
                    </button>
                    {stage === "enquiry" ? (
                      <Link
                        href={`/admin/crm/send-quote/${encodeURIComponent(q.id)}`}
                        className="block w-full rounded-lg border border-brand-orange/40 bg-brand-orange/10 px-2 py-1.5 text-center text-[11px] font-semibold text-brand-navy transition hover:border-brand-orange/60 hover:bg-brand-orange/20"
                      >
                        Sending Quote
                      </Link>
                    ) : null}
                    {stage === "completion" ? (
                      <Link
                        href={`/admin/store-orders/internal-order?quote_id=${encodeURIComponent(q.id)}`}
                        className="block w-full rounded-lg border border-emerald-700/30 bg-emerald-50 px-2 py-1.5 text-center text-[11px] font-semibold text-emerald-900 transition hover:border-emerald-700/50 hover:bg-emerald-100/80"
                      >
                        Create order
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {tab === "leads" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Company / contact</th>
                <th className="px-3 py-2">Stage</th>
                <th className="px-3 py-2">Follow-up</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Customer link</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                    No quote requests yet. Submissions from <code className="rounded bg-slate-100 px-1">/quote</code> appear
                    here.
                  </td>
                </tr>
              ) : (
                quotes.map((q) => {
                  const open = expanded === q.id;
                  const acts = activitiesByQuote.get(q.id) ?? [];
                  return (
                    <Fragment key={q.id}>
                      <tr className="border-b border-slate-100 hover:bg-slate-50/80">
                        <td className="px-3 py-2 align-top">
                          <p className="font-semibold text-brand-navy">{q.company_name}</p>
                          <p className="text-slate-700">
                            {q.contact_name} · {q.email}
                          </p>
                          {q.phone && <p className="text-xs text-slate-500">{q.phone}</p>}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <select
                            className="w-full max-w-[140px] rounded border border-slate-200 px-1 py-1 text-xs font-semibold"
                            value={q.pipeline_stage}
                            disabled={pending}
                            onChange={(e) =>
                              run(() => updateQuotePipelineStage(q.id, e.target.value))
                            }
                          >
                            {PIPELINE_STAGES.map((s) => (
                              <option key={s} value={s}>
                                {PIPELINE_LABELS[s]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <input
                            type="datetime-local"
                            className="w-full min-w-[180px] rounded border border-slate-200 px-1 py-1 text-xs"
                            defaultValue={toDatetimeLocalValue(q.next_follow_up_at)}
                            suppressHydrationWarning
                            disabled={pending}
                            onBlur={(e) => {
                              const v = e.target.value;
                              const iso = v ? new Date(v).toISOString() : null;
                              run(() => updateQuoteFollowUp(q.id, iso));
                            }}
                          />
                          <label className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                            <input
                              type="checkbox"
                              checked={q.automation_paused}
                              disabled={pending}
                              onChange={(e) => run(() => updateQuoteAutomationPaused(q.id, e.target.checked))}
                            />
                            Pause reminders
                          </label>
                        </td>
                        <td className="px-3 py-2 align-top text-xs text-slate-700">
                          {q.product_name ?? "—"}
                          {q.position_name && (
                            <span className="block text-slate-500">{q.position_name}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <select
                            className="w-full max-w-[200px] rounded border border-slate-200 px-1 py-1 text-xs"
                            value={q.customer_profile_id ?? ""}
                            disabled={pending}
                            onChange={(e) => {
                              const v = e.target.value;
                              run(() => linkQuoteToCustomer(q.id, v || null));
                            }}
                          >
                            <option value="">— Not linked —</option>
                            {customers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.organisation ? `${c.organisation} (${c.email_address})` : c.email_address}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <button
                            type="button"
                            className="mb-1 block text-xs font-medium text-brand-orange hover:underline"
                            onClick={() => setExpanded(open ? null : q.id)}
                          >
                            {open ? "Hide" : "Details"}
                          </button>
                          <button
                            type="button"
                            className="block text-xs font-semibold text-slate-600 hover:underline"
                            disabled={pending}
                            onClick={() => run(() => markQuoteContactedNow(q.id))}
                          >
                            Mark contacted now
                          </button>
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-b border-slate-100 bg-slate-50/90">
                          <td colSpan={6} className="px-3 py-4">
                            <div className="grid gap-4 lg:grid-cols-2">
                              <div>
                                <p className="text-xs font-medium uppercase text-slate-500">Internal notes</p>
                                <textarea
                                  className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                                  rows={4}
                                  defaultValue={q.internal_notes ?? ""}
                                  disabled={pending}
                                  onBlur={(e) =>
                                    run(() => updateQuoteInternalNotes(q.id, e.target.value))
                                  }
                                />
                              </div>
                              <div>
                                <p className="text-xs font-medium uppercase text-slate-500">Add note (timeline)</p>
                                <AddNoteForm
                                  quoteId={q.id}
                                  disabled={pending}
                                  onAdded={() => {
                                    router.refresh();
                                  }}
                                />
                                <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-xs text-slate-700">
                                  {acts.map((a) => (
                                    <li key={a.id} className="rounded border border-slate-200 bg-white px-2 py-1">
                                      <span className="font-semibold text-slate-500">{a.kind}</span> ·{" "}
                                      {formatWhen(a.created_at)}
                                      <br />
                                      {a.body}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "customers" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Organisation</th>
                <th className="px-3 py-2">Contact</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Phone</th>
                <th className="px-3 py-2" title="Store checkout orders (non-cancelled), matched by email">
                  Store orders
                </th>
                <th className="px-3 py-2">Store total</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                    No customer profiles yet (e.g. sign-ups / account data).
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                    <td className="px-3 py-2 font-semibold text-brand-navy">
                      {c.organisation?.trim() ? c.organisation : "—"}
                    </td>
                    <td className="px-3 py-2">{c.customer_name}</td>
                    <td className="px-3 py-2">{c.email_address}</td>
                    <td className="px-3 py-2">{c.contact_number}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">{c.store_order_count}</td>
                    <td className="px-3 py-2 tabular-nums text-slate-800">
                      {formatStoreOrderTotals(c.store_order_totals)}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          className="text-left text-xs font-semibold text-brand-orange hover:underline disabled:opacity-50"
                          disabled={pending}
                          onClick={() => {
                            setMessage(null);
                            setEditCustomer(c);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-left text-xs font-semibold text-red-700 hover:underline disabled:opacity-50"
                          disabled={pending}
                          onClick={() => {
                            const label =
                              c.organisation?.trim() || c.customer_name || c.email_address || "this customer";
                            if (
                              !window.confirm(
                                `Delete customer "${label}"? Linked quotes will be unlinked (not deleted).`,
                              )
                            ) {
                              return;
                            }
                            run(() => deleteCustomerProfile(c.id));
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          {editCustomer && (
            <CustomerEditDialog
              key={editCustomer.id}
              customer={editCustomer}
              pending={pending}
              onClose={() => setEditCustomer(null)}
              onSave={(fields) => {
                setMessage(null);
                startTransition(async () => {
                  const r = await updateCustomerProfile(editCustomer.id, fields);
                  if (!r.ok) {
                    setMessage(r.error ?? "Something went wrong");
                    return;
                  }
                  setEditCustomer(null);
                  router.refresh();
                });
              }}
            />
          )}
        </div>
      )}

      {pipelineQuoteDetail && (
        <QuoteLeadDetailDialog quote={pipelineQuoteDetail} onClose={() => setPipelineQuoteDetail(null)} />
      )}

      {tab === "notifications" && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Lead</th>
                <th className="px-3 py-2">Channel</th>
                <th className="px-3 py-2">Template</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {notifications.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                    No notification log entries yet. Configure Resend/Twilio (README) to send email/SMS; skipped sends still
                    log as &quot;skipped&quot;.
                  </td>
                </tr>
              ) : (
                notifications.map((n) => (
                  <tr key={n.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 whitespace-nowrap text-xs">{formatWhen(n.created_at)}</td>
                    <td className="px-3 py-2 text-xs">{n.company_name ?? "—"}</td>
                    <td className="px-3 py-2">{n.channel}</td>
                    <td className="px-3 py-2 font-mono text-xs">{n.template_key}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          n.status === "sent"
                            ? "bg-emerald-100 text-emerald-900"
                            : n.status === "skipped"
                              ? "bg-slate-100 text-slate-700"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {n.status}
                      </span>
                      {n.error && (
                        <span
                          className={`ml-2 text-xs ${
                            n.status === "skipped" ? "text-slate-600" : "text-red-600"
                          }`}
                          title={
                            n.status === "skipped"
                              ? "Email/SMS was not sent. Add RESEND_API_KEY and RESEND_FROM_EMAIL to send customer mail; CRM_INTERNAL_NOTIFY_EMAIL for internal new-lead alerts. Twilio vars for SMS."
                              : undefined
                          }
                        >
                          {n.error}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function quoteDetailValue(text: string | null | undefined) {
  const t = text?.trim();
  return t ? t : "—";
}

function isLikelyImageLogoUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return /\.(png|jpe?g|gif|webp|svg)(\?|$)/.test(path);
  } catch {
    return /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(url);
  }
}

function formatFileSizeBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function QuoteLogoPreviewDialog({ url, onClose }: { url: string; onClose: () => void }) {
  const [fileSizeBytes, setFileSizeBytes] = useState<number | null>(null);
  const [sizeState, setSizeState] = useState<"idle" | "loading" | "done">("loading");
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = isLikelyImageLogoUrl(url) && !imgFailed;

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;
    setSizeState("loading");
    setFileSizeBytes(null);

    (async () => {
      try {
        const res = await fetch(url, { method: "HEAD", signal: ac.signal, mode: "cors", cache: "no-store" });
        const cl = res.headers.get("Content-Length");
        if (!cancelled && cl && /^\d+$/.test(cl.trim())) {
          setFileSizeBytes(Number(cl.trim()));
        }
      } catch {
        /* CORS or no HEAD — size stays unknown */
      } finally {
        if (!cancelled) setSizeState("done");
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [url]);

  const sizeLabel =
    sizeState === "loading" ? "Loading file size…" : fileSizeBytes !== null ? formatFileSizeBytes(fileSizeBytes) : "Unavailable (open in new tab to check)";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-labelledby="quote-logo-preview-title"
        aria-modal="true"
        className="max-h-[min(92vh,48rem)] w-full max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 id="quote-logo-preview-title" className="text-base font-semibold text-brand-navy">
              Uploaded file
            </h2>
            <p className="mt-1 text-xs text-slate-600">
              File size: <span className="font-medium text-slate-800">{sizeLabel}</span>
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-brand-orange hover:bg-slate-50"
            >
              Open in new tab
            </a>
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
        <div className="max-h-[min(78vh,40rem)] overflow-auto bg-slate-100 p-4">
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote CRM logo URL from storage
            <img
              src={url}
              alt="Customer uploaded logo"
              className="mx-auto max-h-[min(70vh,36rem)] w-auto max-w-full object-contain shadow-sm"
              onError={() => setImgFailed(true)}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-700">
              {imgFailed && isLikelyImageLogoUrl(url) ? (
                <p>The image could not be loaded. Use &quot;Open in new tab&quot; to view the file.</p>
              ) : (
                <p>Preview is not available for this file type. Use &quot;Open in new tab&quot; to download or open it.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuoteLeadDetailDialog({ quote, onClose }: { quote: CrmQuoteRow; onClose: () => void }) {
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (logoPreviewUrl) {
        setLogoPreviewUrl(null);
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, logoPreviewUrl]);

  const placement =
    quote.placement_labels && quote.placement_labels.length > 0
      ? quote.placement_labels.join(", ")
      : "—";
  const qty =
    quote.quantity === null || quote.quantity === undefined ? "—" : String(quote.quantity);

  return (
    <>
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-labelledby="quote-lead-detail-title"
        aria-modal="true"
        className="max-h-[min(90vh,40rem)] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="quote-lead-detail-title" className="text-lg font-semibold text-brand-navy">
              Quote request
            </h2>
            <p className="mt-0.5 text-sm font-medium text-slate-800">{quote.company_name}</p>
            <p className="mt-1 text-xs text-slate-500">
              Submitted · <span className="font-medium text-slate-700">{formatWhen(quote.created_at)}</span>
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4 text-sm">
          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</p>
            <dl className="mt-2 space-y-1.5 text-slate-800">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-xs text-slate-500 sm:w-28">Contact name</dt>
                <dd>{quoteDetailValue(quote.contact_name)}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-xs text-slate-500 sm:w-28">Email</dt>
                <dd className="break-all">{quoteDetailValue(quote.email)}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-xs text-slate-500 sm:w-28">Phone</dt>
                <dd>{quoteDetailValue(quote.phone ?? undefined)}</dd>
              </div>
            </dl>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">What they asked for</p>
            <dl className="mt-2 space-y-1.5 text-slate-800">
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-xs text-slate-500 sm:w-28">Product</dt>
                <dd>{quoteDetailValue(quote.product_name ?? undefined)}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-xs text-slate-500 sm:w-28">Embroidery position</dt>
                <dd>{quoteDetailValue(quote.position_name ?? undefined)}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-xs text-slate-500 sm:w-28">Printing position</dt>
                <dd>{quoteDetailValue(quote.printing_position_name ?? undefined)}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-xs text-slate-500 sm:w-28">Service type</dt>
                <dd>{quoteDetailValue(quote.service_type ?? undefined)}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-xs text-slate-500 sm:w-28">Colour</dt>
                <dd>{quoteDetailValue(quote.product_color ?? undefined)}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-xs text-slate-500 sm:w-28">Quantity</dt>
                <dd>{qty}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-xs text-slate-500 sm:w-28">Placement labels</dt>
                <dd className="break-words">{placement}</dd>
              </div>
              <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                <dt className="shrink-0 text-xs text-slate-500 sm:w-28">Logo file</dt>
                <dd>
                  {quote.logo_file_url?.trim() ? (
                    <button
                      type="button"
                      className="font-medium text-brand-orange underline-offset-2 hover:underline"
                      onClick={() => setLogoPreviewUrl(quote.logo_file_url!.trim())}
                    >
                      Open uploaded file
                    </button>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes (from form)</p>
            <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-3 font-sans text-xs leading-relaxed text-slate-800">
              {quote.notes?.trim() ? quote.notes : "—"}
            </pre>
          </section>

          {quote.quote_customer_accepted_at ? (
            <section>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer acceptance</p>
              <p className="mt-2 text-xs text-slate-700">
                Accepted online ·{" "}
                <span className="font-medium text-slate-800">{formatWhen(quote.quote_customer_accepted_at)}</span>
              </p>
              {typeof quote.quote_customer_accept_payload === "object" &&
              quote.quote_customer_accept_payload !== null &&
              "email_body_snapshot" in quote.quote_customer_accept_payload &&
              typeof (quote.quote_customer_accept_payload as { email_body_snapshot?: unknown })
                .email_body_snapshot === "string" ? (
                <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-emerald-100 bg-emerald-50/60 p-2 font-sans text-[11px] leading-relaxed text-slate-800">
                  {(quote.quote_customer_accept_payload as { email_body_snapshot: string }).email_body_snapshot}
                </pre>
              ) : null}
              {quote.quote_customer_accept_comment?.trim() ? (
                <div className="mt-2">
                  <p className="text-xs font-semibold text-slate-600">Customer comment</p>
                  <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg border border-emerald-100 bg-white p-2 font-sans text-[11px] text-slate-800">
                    {quote.quote_customer_accept_comment.trim()}
                  </pre>
                </div>
              ) : null}
            </section>
          ) : null}

          <section>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pipeline</p>
            <p className="mt-2 text-xs text-slate-700">
              Stage: <span className="font-semibold capitalize">{quote.pipeline_stage}</span>
              {" · "}
              Lead source: <span className="font-semibold">{quote.lead_source}</span>
            </p>
            {quote.internal_notes?.trim() ? (
              <div className="mt-2">
                <p className="text-xs text-slate-500">Internal notes</p>
                <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-lg border border-amber-100 bg-amber-50/80 p-2 font-sans text-xs text-slate-800">
                  {quote.internal_notes}
                </pre>
              </div>
            ) : null}
            {quote.pipeline_stage === "completion" ? (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <Link
                  href={`/admin/store-orders/internal-order?quote_id=${encodeURIComponent(quote.id)}`}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-emerald-700/35 bg-emerald-50 px-3 py-2 text-center text-xs font-semibold text-emerald-950 transition hover:bg-emerald-100"
                >
                  Create order
                </Link>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
    {logoPreviewUrl ? <QuoteLogoPreviewDialog url={logoPreviewUrl} onClose={() => setLogoPreviewUrl(null)} /> : null}
    </>
  );
}

function CustomerEditDialog({
  customer,
  pending,
  onClose,
  onSave,
}: {
  customer: CrmCustomerRow;
  pending: boolean;
  onClose: () => void;
  onSave: (fields: {
    organisation: string;
    customer_name: string;
    email_address: string;
    contact_number: string;
    delivery_address: string;
    billing_address: string;
    login_password: string;
  }) => void;
}) {
  const [organisation, setOrganisation] = useState(customer.organisation);
  const [customerName, setCustomerName] = useState(customer.customer_name);
  const [email, setEmail] = useState(customer.email_address);
  const [phone, setPhone] = useState(customer.contact_number);
  const [password, setPassword] = useState(customer.login_password ?? "");
  const [deliveryAddress, setDeliveryAddress] = useState(customer.delivery_address);
  const [billingAddress, setBillingAddress] = useState(customer.billing_address);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={pending ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-labelledby="customer-edit-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="customer-edit-title" className="text-lg font-semibold text-brand-navy">
          Customer profile
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Account created ·{" "}
          <span className="font-medium text-slate-700">{formatWhen(customer.created_at)}</span>
        </p>
        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSave({
              organisation,
              customer_name: customerName,
              email_address: email,
              contact_number: phone,
              delivery_address: deliveryAddress,
              billing_address: billingAddress,
              login_password: password,
            });
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</p>
          <label className="block text-xs font-medium text-slate-600">
            Organisation
            <input
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              value={organisation}
              disabled={pending}
              onChange={(e) => setOrganisation(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Contact name
            <input
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              value={customerName}
              disabled={pending}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Email
            <input
              type="email"
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              value={email}
              disabled={pending}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Phone
            <input
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              value={phone}
              disabled={pending}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>

          <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Sign-in</p>
          <label className="block text-xs font-medium text-slate-600">
            Password (stored value)
            <input
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 font-mono text-sm"
              autoComplete="off"
              value={password}
              disabled={pending}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="mt-0.5 block text-[11px] font-normal text-slate-500">
              Leave empty for OAuth-only accounts (email/password login disabled).
            </span>
          </label>

          <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Addresses</p>
          <label className="block text-xs font-medium text-slate-600">
            Delivery address
            <textarea
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              rows={3}
              value={deliveryAddress}
              disabled={pending}
              onChange={(e) => setDeliveryAddress(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-slate-600">
            Billing address
            <textarea
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
              rows={3}
              value={billingAddress}
              disabled={pending}
              onChange={(e) => setBillingAddress(e.target.value)}
            />
          </label>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-brand-orange px-3 py-1.5 text-sm font-medium text-brand-navy hover:opacity-95 disabled:opacity-50"
              disabled={pending}
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddNoteForm({
  quoteId,
  disabled,
  onAdded,
}: {
  quoteId: string;
  disabled: boolean;
  onAdded: () => void;
}) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="mt-1 flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const t = text.trim();
        if (!t) return;
        startTransition(async () => {
          const r = await addCrmNote(quoteId, t);
          if (r.ok) {
            setText("");
            onAdded();
          }
        });
      }}
    >
      <input
        className="min-w-[200px] flex-1 rounded border border-slate-200 px-2 py-1 text-sm"
        placeholder="Call outcome, meeting notes…"
        value={text}
        disabled={disabled || pending}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="submit"
        disabled={disabled || pending || !text.trim()}
        className="rounded-lg bg-brand-orange px-3 py-1 text-xs font-medium text-brand-navy disabled:opacity-50"
      >
        Add note
      </button>
    </form>
  );
}
