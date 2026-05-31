import { getSiteUrl } from "@/lib/site-url";

export type OrderProofStatus = "sent" | "approved" | "declined";

export type OrderProofRecord = {
  id: string;
  storeOrderId: string;
  orderNumber: string;
  round: number;
  status: OrderProofStatus;
  token: string;
  imageUrls: string[];
  note: string | null;
  sentTo: string;
  sentAt: string;
  decidedAt: string | null;
  customerComment: string | null;
};

export function normalizeProofStatus(value: string | null | undefined): OrderProofStatus {
  const v = (value ?? "").trim().toLowerCase();
  if (v === "approved" || v === "declined") return v;
  return "sent";
}

export function proofStatusLabel(status: OrderProofStatus): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "declined":
      return "Changes requested";
    default:
      return "Awaiting approval";
  }
}

/** Build the no-login customer approval URL for a proof round. */
export function proofApproveUrl(storeOrderId: string, token: string): string {
  const base = getSiteUrl().replace(/\/$/, "");
  return `${base}/proof/approve/${encodeURIComponent(storeOrderId)}?token=${encodeURIComponent(token)}`;
}

/** Coerce a persisted jsonb image_urls value into a clean string[] of http(s) URLs. */
export function parseProofImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter((v) => v.length > 0 && /^https?:\/\//i.test(v));
}
