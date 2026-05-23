import { StoreOrdersListPage } from "@/app/admin/(panel)/store-orders/store-orders-list-page";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminOnlineOrdersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  return StoreOrdersListPage({ channel: "online", searchParams: sp });
}
