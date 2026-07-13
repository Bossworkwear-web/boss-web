import { completeOrdersDocFromSearchParam } from "@/lib/complete-orders-doc-query";
import { storeOrderScanPayloadFromId } from "@/lib/store-order-scan-code";
import {
  getCustomerDetailForStoreOrderNumber,
  type StoreOrderCustomerMemoLine,
} from "@/lib/store-order-customer-detail";
import { createSupabaseAdminClient } from "@/lib/supabase";

import {
  listClickUpSheetImages,
  listClickUpSheetMockupsIncludingReorderPrior,
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
  let initialCustomerName = "";
  let initialCustomerEmail = "";
  let initialCustomerPhone = "";
  let initialFulfillmentMethod: "Pickup" | "Delivery" = "Delivery";
  let initialDeliveryAddress = "";
  let initialDeliveryFeeCents = 0;
  let initialLogoLocations = "";
  let initialCheckoutMemos: StoreOrderCustomerMemoLine[] = [];
  let initialOrderScanPayload: string | null = null;

  if (initialCustomerOrderId) {
    try {
      const supabase = createSupabaseAdminClient();
      const detail = await getCustomerDetailForStoreOrderNumber(supabase, initialCustomerOrderId);
      initialOrganisationName = detail.organisationName;
      initialCustomerName = detail.customerName;
      initialCustomerEmail = detail.customerEmail;
      initialCustomerPhone = detail.customerPhone;
      initialFulfillmentMethod = detail.fulfillmentMethod;
      initialDeliveryAddress = detail.deliveryAddress;
      initialDeliveryFeeCents = detail.deliveryFeeCents;
      initialLogoLocations = detail.logoLocations;
      initialCheckoutMemos = detail.checkoutMemos;
      initialOrderScanPayload = detail.storeOrderId ? storeOrderScanPayloadFromId(detail.storeOrderId) : null;
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
    /** Mock-ups + 재오더 이전 주문 목업: Order ID만 있어도 불러야 워크시트 날짜 없이도 전승 목업이 보임. */
    try {
      const mockupRes = await listClickUpSheetMockupsIncludingReorderPrior(
        initialListDate,
        initialCustomerOrderId,
      );
      if (mockupRes.ok) {
        initialMockupImages = mockupRes.images;
      }
    } catch {
      // Table or bucket missing
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
      const referenceRes = await listClickUpSheetImages(
        initialListDate,
        initialCustomerOrderId,
        "reference",
      );
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
      initialCustomerName={initialCustomerName}
      initialCustomerEmail={initialCustomerEmail}
      initialCustomerPhone={initialCustomerPhone}
      initialFulfillmentMethod={initialFulfillmentMethod}
      initialDeliveryAddress={initialDeliveryAddress}
      initialDeliveryFeeCents={initialDeliveryFeeCents}
      initialLogoLocations={initialLogoLocations}
      initialCheckoutMemos={initialCheckoutMemos}
      initialSupplierLines={initialSupplierLines}
      initialMockupImages={initialMockupImages}
      initialReferenceImages={initialReferenceImages}
      initialCustomerReferenceItems={initialCustomerReferenceItems}
      initialOrderScanPayload={initialOrderScanPayload}
      completeOrdersDocumentsView={completeOrdersDocumentsView}
    />
  );
}
