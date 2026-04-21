import { completeOrdersDocFromSearchParam } from "@/lib/complete-orders-doc-query";
import {
  getCustomerDetailForStoreOrderNumber,
  type StoreOrderCustomerMemoLine,
} from "@/lib/store-order-customer-detail";
import { createSupabaseAdminClient } from "@/lib/supabase";

import {
  listClickUpSheetImages,
  listCustomerReferenceVisualsForStoreOrderNumber,
  loadSupplierOrderLinesForClickUpSheet,
  type ClickUpSheetImageDto,
  type ClickUpSupplierLineRow,
  type CustomerReferenceVisualDto,
} from "./actions";
import { ClickUpSheetWorkspace } from "./click-up-sheet-workspace";

export const dynamic = "force-dynamic";

type Search = { list_date?: string; customer_order_id?: string; complete_orders_doc?: string };

export default async function AdminClickUpSheetPage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const q = await searchParams;
  const initialListDate = (q.list_date ?? "").trim();
  const initialCustomerOrderId = (q.customer_order_id ?? "").trim();
  const completeOrdersDocumentsView = completeOrdersDocFromSearchParam(q.complete_orders_doc);

  let initialOrganisationName = "";
  let initialLogoLocations = "";
  let initialCheckoutMemos: StoreOrderCustomerMemoLine[] = [];

  if (initialCustomerOrderId) {
    try {
      const supabase = createSupabaseAdminClient();
      const detail = await getCustomerDetailForStoreOrderNumber(supabase, initialCustomerOrderId);
      initialOrganisationName = detail.organisationName;
      initialLogoLocations = detail.logoLocations;
      initialCheckoutMemos = detail.checkoutMemos;
    } catch {
      // Supabase not configured or network
    }
  }

  let initialSupplierLines: ClickUpSupplierLineRow[] = [];
  let initialMockupImages: ClickUpSheetImageDto[] = [];
  let initialReferenceImages: ClickUpSheetImageDto[] = [];
  let initialCustomerReferenceItems: CustomerReferenceVisualDto[] = [];

  if (initialCustomerOrderId) {
    try {
      const refRes = await listCustomerReferenceVisualsForStoreOrderNumber(initialCustomerOrderId);
      if (refRes.ok) {
        initialCustomerReferenceItems = refRes.items;
      }
    } catch {
      // Supabase not configured
    }
  }

  if (initialListDate) {
    try {
      const linesRes = await loadSupplierOrderLinesForClickUpSheet(
        initialListDate,
        initialCustomerOrderId || null,
      );
      if (linesRes.ok) {
        initialSupplierLines = linesRes.lines;
      }
    } catch {
      // Supabase not configured
    }
    try {
      const [mockupRes, referenceRes] = await Promise.all([
        listClickUpSheetImages(initialListDate, initialCustomerOrderId, "mockup"),
        listClickUpSheetImages(initialListDate, initialCustomerOrderId, "reference"),
      ]);
      if (mockupRes.ok) {
        initialMockupImages = mockupRes.images;
      }
      if (referenceRes.ok) {
        initialReferenceImages = referenceRes.images;
      }
    } catch {
      // Table or bucket missing
    }
  }

  return (
    <ClickUpSheetWorkspace
      key={`${initialListDate}|${initialCustomerOrderId}`}
      initialListDate={initialListDate}
      initialCustomerOrderId={initialCustomerOrderId}
      initialOrganisationName={initialOrganisationName}
      initialLogoLocations={initialLogoLocations}
      initialCheckoutMemos={initialCheckoutMemos}
      initialSupplierLines={initialSupplierLines}
      initialMockupImages={initialMockupImages}
      initialReferenceImages={initialReferenceImages}
      initialCustomerReferenceItems={initialCustomerReferenceItems}
      completeOrdersDocumentsView={completeOrdersDocumentsView}
    />
  );
}
