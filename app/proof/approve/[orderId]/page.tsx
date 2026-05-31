import {
  normalizeProofStatus,
  parseProofImageUrls,
  proofStatusLabel,
} from "@/lib/order-proof";
import { createSupabaseAdminClient } from "@/lib/supabase";

import { ProofApproveClient } from "./proof-approve-client";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ token?: string }>;
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:py-16">
      <div className="mb-6 flex items-center gap-2">
        <span className="inline-block h-6 w-2 rounded bg-brand-orange" />
        <span className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-navy">
          Boss Workwear
        </span>
      </div>
      {children}
    </div>
  );
}

export default async function ProofApprovePage({ params, searchParams }: PageProps) {
  const { orderId } = await params;
  const { token = "" } = await searchParams;

  const id = (orderId ?? "").trim();
  const tok = (token ?? "").trim();

  if (!id || !tok) {
    return (
      <Shell>
        <p className="text-sm text-slate-600">
          This link is missing a token. Please use the full link from your proof email.
        </p>
      </Shell>
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data: row } = await supabase
    .from("order_proofs")
    .select(
      "id, store_order_id, order_number, round, status, token, image_urls, note, decided_at, customer_comment",
    )
    .eq("store_order_id", id)
    .eq("token", tok)
    .maybeSingle();

  if (!row || (row.token ?? "").trim() !== tok) {
    return (
      <Shell>
        <p className="text-sm text-slate-600">
          This link is invalid or has expired. Please contact us if you need help.
        </p>
      </Shell>
    );
  }

  const status = normalizeProofStatus(row.status);
  const images = parseProofImageUrls(row.image_urls);
  const roundSuffix = row.round > 1 ? ` (revision ${row.round})` : "";

  return (
    <Shell>
      <h1 className="text-2xl font-semibold text-brand-navy">
        Design proof for order {row.order_number}
        {roundSuffix}
      </h1>
      <p className="mt-1 text-sm text-slate-600">
        Please review your design below and approve it, or request changes. Production begins once you approve.
      </p>

      {row.note ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {row.note}
        </div>
      ) : null}

      {images.length > 0 ? (
        <div className="mt-5 space-y-4">
          {images.map((url) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element -- proof images are supabase public URLs from arbitrary buckets */}
              <img
                src={url}
                alt="Design proof"
                className="w-full rounded-xl border border-slate-200 bg-white object-contain"
              />
            </a>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm text-amber-800">No proof images were attached. Please contact us.</p>
      )}

      <div className="mt-6">
        {status === "sent" ? (
          <ProofApproveClient storeOrderId={id} token={tok} />
        ) : status === "approved" ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-950">
            <p className="text-base font-semibold">This proof is approved.</p>
            <p className="mt-1">Thanks! Your order is in production.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950">
            <p className="text-base font-semibold">Changes requested.</p>
            {row.customer_comment ? <p className="mt-1">Your notes: {row.customer_comment}</p> : null}
            <p className="mt-1">We&apos;ll send you a revised proof to review shortly.</p>
          </div>
        )}
      </div>

      <p className="mt-8 text-xs text-slate-400">
        Status: {proofStatusLabel(status)}
      </p>
    </Shell>
  );
}
