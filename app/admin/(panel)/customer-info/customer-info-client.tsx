"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

import { ImageUrlLightbox } from "@/app/components/image-url-lightbox";

import {
  deleteCustomerFromCustomerInfo,
  deleteCustomerMasterLogo,
  deleteCustomerSpecialRequest,
  deleteClickUpSheetImageForCustomerInfo,
  getCustomerInfoPayload,
  listAllCustomersForCustomerInfo,
  replaceCustomerMasterLogo,
  searchCustomersForCustomerInfo,
  updateCustomerProfile,
  upsertCustomerSpecialRequest,
  type CustomerInfoPayload,
  type CustomerListRow,
} from "./actions";

const CUSTOMERS_PER_PAGE = 15;

function audFromCents(cents: number): string {
  const n = Number(cents ?? 0) / 100;
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

function formatMarketingOptInAt(iso: string | null | undefined): string | null {
  if (!iso?.trim()) {
    return null;
  }
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) {
    return null;
  }
  return new Intl.DateTimeFormat("en-AU", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Australia/Perth",
  }).format(new Date(t));
}

function MarketingConsentBadge({
  optedIn,
  optedInAt,
  compact = false,
}: {
  optedIn: boolean | null;
  optedInAt?: string | null;
  compact?: boolean;
}) {
  if (optedIn === null) {
    return <span className="text-slate-400">—</span>;
  }
  if (optedIn) {
    const when = formatMarketingOptInAt(optedInAt);
    return (
      <span
        className={`inline-flex items-center rounded-full border border-green-300 bg-green-100 font-semibold text-green-900 ${
          compact ? "px-2 py-0.5 text-[0.65rem] uppercase tracking-wide" : "px-2.5 py-1 text-xs"
        }`}
        title={when ? `Consented on ${when}` : "Marketing consent granted"}
      >
        {compact ? "Yes" : "Consented"}
        {!compact && when ? <span className="ml-1.5 font-normal text-green-800">· {when}</span> : null}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-full border border-red-300 bg-red-100 font-semibold text-red-900 ${
        compact ? "px-2 py-0.5 text-[0.65rem] uppercase tracking-wide" : "px-2.5 py-1 text-xs"
      }`}
    >
      {compact ? "No" : "Not consented"}
    </span>
  );
}

function signInStatusLabel(
  status: NonNullable<CustomerInfoPayload["profile"]>["sign_in_status"],
): string {
  switch (status) {
    case "supabase_auth":
      return "Email/password via Supabase Auth (password not stored in database).";
    case "legacy_hashed":
      return "Legacy account — hashed password only; migrates to Supabase Auth on next login.";
    case "legacy_plain":
      return "Legacy account — plain password still in database until customer logs in again.";
    case "oauth_only":
      return "OAuth-only — no email/password login until a password is set.";
    default:
      return "Unknown sign-in status.";
  }
}

/** Drag-and-drop (or click-to-browse) picker for the master logo image. Selecting a file uploads it. */
function MasterLogoDropzone({
  onSelect,
  disabled,
  uploading,
}: {
  onSelect: (file: File) => void;
  disabled: boolean;
  uploading: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);

  function pickFromList(list: FileList | null) {
    if (!list || list.length === 0) return;
    const arr = Array.from(list);
    const img = arr.find((f) => f.type.startsWith("image/")) ?? arr[0];
    if (img) onSelect(img);
  }

  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (disabled) return;
        pickFromList(e.dataTransfer.files);
      }}
      className={`mt-2 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition ${
        dragOver
          ? "border-brand-orange bg-brand-orange/5"
          : "border-slate-300 bg-white hover:border-brand-orange/60"
      } ${disabled ? "opacity-60" : ""}`}
    >
      <input
        type="file"
        accept="image/*"
        disabled={disabled}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onSelect(f);
          e.target.value = "";
        }}
        className="hidden"
      />
      <span className="text-sm font-medium text-brand-navy">
        {uploading ? "Uploading…" : "Drag & drop the logo image to upload"}
      </span>
      <span className="text-xs text-slate-500">or click to choose · PNG, JPEG, SVG, WebP</span>
    </label>
  );
}

function customerImpersonateUrl(email: string) {
  return `/api/admin/impersonate-customer?email=${encodeURIComponent(email.trim().toLowerCase())}`;
}

function openCustomerAccount(email: string) {
  const emailNorm = email.trim().toLowerCase();
  if (!emailNorm) {
    return;
  }
  const url = customerImpersonateUrl(emailNorm);
  // Open on the click gesture (no prior `confirm()` — that often blocks popups).
  // Do not pass `noopener` in the features string: it makes `window.open` return `null`
  // even when the tab opens, so we cannot detect a real popup block.
  const win = window.open(url, "_blank", "noreferrer");
  if (win) {
    win.opener = null;
    return;
  }
  if (
    window.confirm(
      `Popup blocked. Open My account signed in as ${emailNorm} in this tab instead?\n\n(Your admin tab will leave Customer info.)`,
    )
  ) {
    window.location.assign(url);
  }
}

type CustomerInfoClientProps = {
  initialImpersonateError?: string | null;
  initialEmail?: string | null;
};

export function CustomerInfoClient({
  initialImpersonateError = null,
  initialEmail = null,
}: CustomerInfoClientProps) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<
    Array<{
      email: string;
      name: string | null;
      phone: string | null;
      organisation: string | null;
      marketingOptIn: boolean | null;
    }>
  >([]);
  const [allCustomers, setAllCustomers] = useState<CustomerListRow[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [listPage, setListPage] = useState(1);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [payload, setPayload] = useState<CustomerInfoPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [logoLightboxOpen, setLogoLightboxOpen] = useState(false);
  const [masterLogoFile, setMasterLogoFile] = useState<File | null>(null);

  const profileStats = useMemo(() => {
    if (!payload) return null;
    const ordersCount = payload.orderHistory.length;
    const totalCents = payload.orderHistory.reduce((sum, o) => sum + (Number.isFinite(o.total_cents) ? o.total_cents : 0), 0);

    let years: number | null = null;
    const createdAt = payload.profile?.created_at;
    if (createdAt) {
      const t = new Date(createdAt).getTime();
      if (Number.isFinite(t)) {
        const ms = Date.now() - t;
        years = ms > 0 ? ms / (365.25 * 24 * 60 * 60 * 1000) : 0;
      }
    }

    return {
      ordersCount,
      totalLabel: audFromCents(totalCents),
      yearsLabel: years == null ? "—" : `${years.toFixed(1)} yrs`,
    };
  }, [payload]);

  const profileDraft = useMemo(() => {
    const p = payload?.profile;
    if (!p) return null;
    return {
      profileId: p.id,
      customer_name: p.customer_name,
      organisation: p.organisation,
      contact_number: p.contact_number,
      delivery_address: p.delivery_address,
      billing_address: p.billing_address,
    };
  }, [payload?.profile]);
  const [profileForm, setProfileForm] = useState<typeof profileDraft>(null);

  const [specialRequestBody, setSpecialRequestBody] = useState("");

  useEffect(() => {
    if (profileDraft) {
      setProfileForm(profileDraft);
    } else {
      setProfileForm(null);
    }
  }, [profileDraft]);

  useEffect(() => {
    setSpecialRequestBody(payload?.specialRequest?.body ?? "");
  }, [payload?.specialRequest?.body]);

  function refreshCustomerList() {
    startTransition(() => {
      void (async () => {
        const res = await listAllCustomersForCustomerInfo();
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setAllCustomers(res.customers);
        setListLoaded(true);
      })();
    });
  }

  useEffect(() => {
    refreshCustomerList();
     
  }, []);

  useEffect(() => {
    if (initialImpersonateError) {
      setError(initialImpersonateError);
    }
  }, [initialImpersonateError]);

  useEffect(() => {
    if (!initialEmail?.trim()) {
      return;
    }
    loadCustomer(initialEmail.trim().toLowerCase());
     
  }, [initialEmail]);

  function runSearch() {
    setError(null);
    startTransition(() => {
      void (async () => {
        const res = await searchCustomersForCustomerInfo(q);
        if (!res.ok) {
          setError(res.error);
          setHits([]);
          return;
        }
        setHits(res.hits);
      })();
    });
  }

  function deleteCustomerRow(c: CustomerListRow) {
    const label = (c.name ?? c.organisation ?? c.email).trim() || c.email;
    const orderNote =
      c.orderCount > 0
        ? `\n\nThis will also permanently delete ${c.orderCount} storefront order${c.orderCount === 1 ? "" : "s"} and related production records.`
        : "";
    if (
      !window.confirm(
        `Permanently delete customer "${label}" (${c.email})?\n\nThis removes their profile, login account (if any), quotes, chat history, logos, special requests, and all linked order data. This cannot be undone.${orderNote}`,
      )
    ) {
      return;
    }

    setError(null);
    startTransition(() => {
      void (async () => {
        const res = await deleteCustomerFromCustomerInfo(c.email);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        if (selectedEmail === c.email) {
          setSelectedEmail(null);
          setPayload(null);
        }
        refreshCustomerList();
      })();
    });
  }

  function loadCustomer(email: string, opts?: { scrollToDetail?: boolean }) {
    const scrollToDetail = opts?.scrollToDetail !== false;
    setSelectedEmail(email);
    setError(null);
    setMasterLogoFile(null);
    startTransition(() => {
      void (async () => {
        const res = await getCustomerInfoPayload(email);
        if (!res.ok) {
          setError(res.error);
          setPayload(null);
          return;
        }
        setPayload(res.payload);
        if (scrollToDetail) {
          window.setTimeout(() => {
            document.getElementById("customer-info-detail")?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }, 50);
        }
      })();
    });
  }

  async function saveProfile() {
    if (!profileForm) return;
    setError(null);
    startTransition(() => {
      void (async () => {
        const res = await updateCustomerProfile(profileForm);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        if (selectedEmail) {
          loadCustomer(selectedEmail, { scrollToDetail: false });
        }
      })();
    });
  }

  async function saveSpecialRequest() {
    const email = selectedEmail ?? payload?.email ?? "";
    if (!email) return;
    setError(null);
    startTransition(() => {
      void (async () => {
        const res = await upsertCustomerSpecialRequest({ customerEmail: email, body: specialRequestBody });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        loadCustomer(email, { scrollToDetail: false });
      })();
    });
  }

  async function clearSpecialRequest() {
    const email = selectedEmail ?? payload?.email ?? "";
    if (!email) return;
    setError(null);
    startTransition(() => {
      void (async () => {
        const res = await deleteCustomerSpecialRequest({ customerEmail: email });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        loadCustomer(email, { scrollToDetail: false });
      })();
    });
  }

  async function clearMasterLogo() {
    const email = selectedEmail ?? payload?.email ?? "";
    if (!email) return;
    setError(null);
    startTransition(() => {
      void (async () => {
        const res = await deleteCustomerMasterLogo({ customerEmail: email });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        loadCustomer(email, { scrollToDetail: false });
      })();
    });
  }

  function uploadMasterLogo(fileArg?: File) {
    const email = selectedEmail ?? payload?.email ?? "";
    const file = fileArg ?? masterLogoFile;
    if (!email || !file) return;
    setError(null);
    startTransition(() => {
      void (async () => {
        const res = await replaceCustomerMasterLogo({ customerEmail: email, file });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setMasterLogoFile(null);
        loadCustomer(email, { scrollToDetail: false });
      })();
    });
  }

  const listFilter = q.trim().toLowerCase();
  const filteredCustomers = listFilter
    ? allCustomers.filter((c) => {
        const hay = [c.email, c.name ?? "", c.organisation ?? "", c.phone ?? ""].join(" ").toLowerCase();
        return hay.includes(listFilter);
      })
    : allCustomers;

  const listTotalPages = Math.max(1, Math.ceil(filteredCustomers.length / CUSTOMERS_PER_PAGE));
  const safeListPage = Math.min(listPage, listTotalPages);
  const listPageStart = (safeListPage - 1) * CUSTOMERS_PER_PAGE;
  const pagedCustomers = filteredCustomers.slice(listPageStart, listPageStart + CUSTOMERS_PER_PAGE);
  const listRangeLabel =
    filteredCustomers.length === 0
      ? "0 customers"
      : `Showing ${listPageStart + 1}–${Math.min(listPageStart + CUSTOMERS_PER_PAGE, filteredCustomers.length)} of ${filteredCustomers.length}`;

  useEffect(() => {
    setListPage(1);
  }, [listFilter]);

  useEffect(() => {
    if (listPage > listTotalPages) {
      setListPage(listTotalPages);
    }
  }, [listPage, listTotalPages]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            <Link href="/admin" className="text-brand-orange hover:underline">
              Dashboard
            </Link>{" "}
            / Customer info
          </p>
          <h1 className="mt-1 text-3xl font-medium text-brand-navy">Customer info</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">
            Search by <strong>name</strong>, <strong>email</strong>, or <strong>phone</strong>.{" "}
            <strong>View details</strong> loads profile / logo / orders on this page.{" "}
            <strong>Log in as customer</strong> opens My account in a new tab as that customer.
          </p>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Search</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. alice@company.com / Alice / 04xx"
            className="min-w-[min(28rem,100%)] flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={runSearch}
            disabled={pending || !q.trim()}
            className="rounded-lg border border-brand-orange bg-brand-orange px-4 py-2 text-sm font-semibold text-brand-navy hover:brightness-95 disabled:opacity-50"
          >
            {pending ? "…" : "Search"}
          </button>
        </div>
        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
        ) : null}
        {hits.length ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {hits.map((h) => (
              <li key={h.email}>
                <button
                  type="button"
                  onClick={() => loadCustomer(h.email)}
                  className={`w-full rounded-xl border px-4 py-3 text-left shadow-sm transition ${
                    selectedEmail === h.email ? "border-brand-orange bg-brand-orange/5" : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <p className="text-sm font-semibold text-brand-navy">{h.email}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {(h.organisation ?? "").trim() || "—"} · {(h.name ?? "").trim() || "—"} · {(h.phone ?? "").trim() || "—"}
                  </p>
                  <p className="mt-2">
                    <MarketingConsentBadge optedIn={h.marketingOptIn ?? null} compact />
                  </p>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">All customers</h2>
            <p className="mt-1 text-xs text-slate-600">
              {listLoaded
                ? `${allCustomers.length} customer${allCustomers.length === 1 ? "" : "s"} (profiles and checkout emails). ${CUSTOMERS_PER_PAGE} per page.`
                : "Loading…"}
            </p>
          </div>
          <button
            type="button"
            onClick={refreshCustomerList}
            disabled={pending}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Refresh list
          </button>
        </div>
        {listLoaded && filteredCustomers.length > 0 ? (
          <>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Organisation</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Marketing</th>
                  <th className="px-4 py-3 text-right">Orders</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagedCustomers.map((c) => (
                  <tr
                    key={c.email}
                    className={selectedEmail === c.email ? "bg-brand-orange/5" : "hover:bg-slate-50/80"}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => loadCustomer(c.email)}
                        className="font-medium text-brand-navy hover:underline"
                      >
                        {c.email}
                      </button>
                      {!c.hasProfile ? (
                        <span className="ml-2 text-[0.65rem] font-semibold uppercase text-amber-700">Orders only</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{(c.name ?? "").trim() || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{(c.organisation ?? "").trim() || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{(c.phone ?? "").trim() || "—"}</td>
                    <td className="px-4 py-3">
                      <MarketingConsentBadge
                        optedIn={c.hasProfile ? c.marketingOptIn : null}
                        optedInAt={c.marketingOptInAt}
                        compact
                      />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{c.orderCount}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openCustomerAccount(c.email)}
                          disabled={pending}
                          className="rounded-lg border border-brand-navy/15 bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-navy/90 disabled:opacity-50"
                        >
                          Log in as customer
                        </button>
                        <button
                          type="button"
                          onClick={() => loadCustomer(c.email)}
                          disabled={pending}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          View details
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteCustomerRow(c)}
                          disabled={pending}
                          className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-sm text-slate-700">
              <span className="font-semibold text-brand-navy">
                Page {safeListPage} / {listTotalPages}
              </span>
              <span className="mx-2 text-slate-300">·</span>
              <span className="text-slate-600">{listRangeLabel}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setListPage(1)}
                disabled={safeListPage <= 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-brand-navy transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                First
              </button>
              <button
                type="button"
                onClick={() => setListPage((p) => Math.max(1, p - 1))}
                disabled={safeListPage <= 1}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-brand-navy transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setListPage((p) => Math.min(listTotalPages, p + 1))}
                disabled={safeListPage >= listTotalPages}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-brand-navy transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => setListPage(listTotalPages)}
                disabled={safeListPage >= listTotalPages}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-brand-navy transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Last
              </button>
            </div>
          </div>
          </>
        ) : listLoaded ? (
          <p className="mt-4 text-sm text-slate-600">No customers yet.</p>
        ) : null}
      </section>

      {payload ? (
        <div id="customer-info-detail" className="scroll-mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Master logo</h2>
            {payload.masterLogo ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setLogoLightboxOpen(true)}
                  className="flex w-full cursor-zoom-in items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-6"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={payload.masterLogo.public_url}
                    alt="Master logo"
                    className="pointer-events-none h-60 w-full max-w-[54rem] object-contain"
                    loading="lazy"
                    decoding="async"
                  />
                </button>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={clearMasterLogo}
                    disabled={pending}
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    Clear master logo
                  </button>
                  <p className="text-xs text-slate-500">
                    Stored as {payload.masterLogo.storage_bucket}/{payload.masterLogo.storage_path}
                  </p>
                </div>
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Replace master logo</p>
                  <MasterLogoDropzone
                    onSelect={(f) => uploadMasterLogo(f)}
                    disabled={pending || !payload.email}
                    uploading={pending}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <p className="text-sm text-slate-600">No master logo set.</p>
                <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Upload master logo</p>
                  <MasterLogoDropzone
                    onSelect={(f) => uploadMasterLogo(f)}
                    disabled={pending || !payload.email}
                    uploading={pending}
                  />
                </div>
              </div>
            )}

            <ImageUrlLightbox
              open={logoLightboxOpen}
              onClose={() => setLogoLightboxOpen(false)}
              src={payload.masterLogo?.public_url ?? ""}
              ariaLabel="Enlarged master logo"
              enlarged
            />
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Customer profile</h2>
            {profileStats ? (
              <p className="mt-2 text-sm text-slate-700">
                <span className="font-semibold text-brand-navy">{profileStats.ordersCount}</span> orders ·{" "}
                <span className="font-semibold text-brand-navy">{profileStats.totalLabel}</span> total ·{" "}
                <span className="font-semibold text-brand-navy">{profileStats.yearsLabel}</span> member
              </p>
            ) : null}
            {!payload.profile ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-slate-600">No `customer_profiles` row for this email.</p>
                {payload.orderHistory.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => openCustomerAccount(payload.email)}
                    disabled={pending}
                    className="rounded-lg border border-brand-navy bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy/90 disabled:opacity-50"
                  >
                    Log in as customer (orders only)
                  </button>
                ) : null}
              </div>
            ) : profileForm ? (
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</span>
                  <input
                    readOnly
                    value={payload.profile.email_address}
                    autoComplete="off"
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                  />
                </label>
                <div className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sign-in</span>
                  <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    {signInStatusLabel(payload.profile.sign_in_status)}
                  </p>
                </div>
                <div className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Marketing &amp; promotions consent
                  </span>
                  <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <MarketingConsentBadge
                      optedIn={payload.profile.marketing_opt_in}
                      optedInAt={payload.profile.marketing_opt_in_at}
                    />
                    <p className="mt-2 text-xs text-slate-600">
                      Recorded from the Customer Details opt-in checkbox (promotions and advertising).
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openCustomerAccount(payload.email)}
                    disabled={pending}
                    className="rounded-lg border border-brand-navy bg-brand-navy px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy/90 disabled:opacity-50"
                  >
                    Log in as customer
                  </button>
                  <p className="self-center text-xs text-slate-500">
                    Opens My account in a new tab, signed in as this customer.
                  </p>
                </div>
                {(
                  [
                    ["Organisation", "organisation"],
                    ["Customer name", "customer_name"],
                    ["Phone", "contact_number"],
                    ["Delivery address", "delivery_address"],
                    ["Billing address", "billing_address"],
                  ] as const
                ).map(([label, key]) => (
                  <label key={key} className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
                    <textarea
                      rows={key.includes("address") ? 3 : 1}
                      value={profileForm[key]}
                      onChange={(e) => setProfileForm((cur) => (cur ? { ...cur, [key]: e.target.value } : cur))}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                ))}
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={pending}
                  className="rounded-lg border border-brand-orange bg-brand-orange px-4 py-2 text-sm font-semibold text-brand-navy hover:brightness-95 disabled:opacity-50"
                >
                  Save profile
                </button>
              </div>
            ) : null}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Special request</h2>
            <textarea
              className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={6}
              value={specialRequestBody}
              onChange={(e) => setSpecialRequestBody(e.target.value)}
              placeholder="Internal notes / special request…"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveSpecialRequest}
                disabled={pending || !payload.email}
                className="rounded-lg border border-brand-orange bg-brand-orange px-4 py-2 text-sm font-semibold text-brand-navy hover:brightness-95 disabled:opacity-50"
              >
                Save special request
              </button>
              <button
                type="button"
                onClick={clearSpecialRequest}
                disabled={pending || !payload.email}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Customer order history</h2>
            {payload.orderHistory.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No orders found for this email.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm">
                {payload.orderHistory.map((o) => (
                  <li key={o.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="font-semibold text-brand-navy">
                      <Link href={`/admin/store-orders?q=${encodeURIComponent(o.order_number)}`} className="hover:underline">
                        {o.order_number}
                      </Link>{" "}
                      <span className="font-normal text-slate-500">· {o.status}</span>
                    </p>
                    <p className="text-xs text-slate-600">
                      Subtotal {audFromCents(o.subtotal_cents)} · Total {audFromCents(o.total_cents)} · {o.created_at}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">All mock-up history</h2>
            {payload.mockupHistory.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">No click-up sheet images found for this customer’s orders.</p>
            ) : (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {payload.mockupHistory.map((m) => (
                  <li key={m.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.public_url} alt="" className="h-44 w-full bg-white object-contain" loading="lazy" />
                    <div className="border-t border-slate-100 bg-slate-50 px-3 py-2">
                      <p className="text-xs font-semibold text-brand-navy">
                        {m.is_mockup ? "Mock-up" : "Reference"} · {m.customer_order_id}
                      </p>
                      <p className="mt-1 text-[0.7rem] text-slate-600">
                        {m.list_date} · {m.created_at}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => {
                            if (!window.confirm("Delete this click-up sheet image?")) return;
                            startTransition(() => {
                              void (async () => {
                                const res = await deleteClickUpSheetImageForCustomerInfo({ imageId: m.id });
                                if (!res.ok) {
                                  setError(res.error);
                                  return;
                                }
                                const email = selectedEmail ?? payload?.email ?? "";
                                if (email) {
                                  loadCustomer(email, { scrollToDetail: false });
                                }
                              })();
                            });
                          }}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          Delete
                        </button>
                        <a
                          href={m.public_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Open
                        </a>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

