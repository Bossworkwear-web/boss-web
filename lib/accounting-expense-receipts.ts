import type { SupabaseClient } from "@supabase/supabase-js";

export const ACCOUNTING_EXPENSE_RECEIPTS_BUCKET = "accounting-expense-receipts";

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export function isAllowedAccountingReceiptImage(file: File): boolean {
  const mime = (file.type || "").toLowerCase();
  if (ALLOWED_MIME.has(mime)) return true;
  if (mime) return false;
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  return ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "gif" || ext === "webp";
}

export function contentTypeForAccountingReceipt(file: File): string {
  const mime = (file.type || "").toLowerCase();
  if (ALLOWED_MIME.has(mime)) return mime;
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  return "application/octet-stream";
}

export function extForAccountingReceiptUpload(file: File): string {
  const mime = (file.type || "").toLowerCase();
  if (mime === "image/png") return ".png";
  if (mime === "image/gif") return ".gif";
  if (mime === "image/webp") return ".webp";
  const ext = (file.name.match(/(\.[a-z0-9]{1,8})$/i)?.[1] ?? "").toLowerCase();
  if (ext === ".png" || ext === ".gif" || ext === ".webp" || ext === ".jpg" || ext === ".jpeg") return ext === ".jpeg" ? ".jpg" : ext;
  return ".jpg";
}

export function validateAccountingReceiptFile(file: File): { ok: true } | { ok: false; error: string } {
  if (!file || typeof file.size !== "number" || file.size <= 0) {
    return { ok: false, error: "invalid_receipt" };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "receipt_too_large" };
  }
  if (!isAllowedAccountingReceiptImage(file)) {
    return { ok: false, error: "invalid_receipt_type" };
  }
  return { ok: true };
}

export async function removeAccountingReceiptObject(
  supabase: SupabaseClient,
  storagePath: string | null | undefined,
): Promise<void> {
  const p = (storagePath ?? "").trim();
  if (!p) return;
  await supabase.storage.from(ACCOUNTING_EXPENSE_RECEIPTS_BUCKET).remove([p]);
}
