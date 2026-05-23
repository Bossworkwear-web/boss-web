import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Legacy URL — online orders list moved to /admin/online-orders */
export default async function AdminStoreOrdersRedirectPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string" && v) {
      p.set(k, v);
    }
  }
  const q = p.toString();
  redirect(q ? `/admin/online-orders?${q}` : "/admin/online-orders");
}
