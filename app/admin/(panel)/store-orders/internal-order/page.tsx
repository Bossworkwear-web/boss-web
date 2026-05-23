import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type Search = {
  from?: string;
  customer_id?: string;
  company?: string;
  quote_id?: string;
  created?: string;
  error?: string;
};

/** Legacy URL — internal order form moved to /admin/instore-orders/internal-order */
export default async function AdminStoreOrdersInternalOrderRedirect({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const q = await searchParams;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (typeof v === "string" && v) {
      p.set(k, v);
    }
  }
  const qs = p.toString();
  redirect(qs ? `/admin/instore-orders/internal-order?${qs}` : "/admin/instore-orders/internal-order");
}
