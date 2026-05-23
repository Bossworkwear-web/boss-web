import { revalidatePath } from "next/cache";

/** Online + instore list pages (legacy /admin/store-orders redirects to online). */
export function revalidateStoreOrderListPaths(): void {
  revalidatePath("/admin/online-orders");
  revalidatePath("/admin/instore-orders");
  revalidatePath("/admin/store-orders");
}
