import type { XeroConnectionRow } from "@/lib/xero/connection-db";

export const XERO_ACCOUNTING_API_BASE = "https://api.xero.com/api.xro/2.0";

export class XeroApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
  ) {
    super(message);
    this.name = "XeroApiError";
  }
}

export async function xeroAccountingFetch(
  connection: XeroConnectionRow,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${XERO_ACCOUNTING_API_BASE}${path}`;
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${connection.access_token}`);
  headers.set("xero-tenant-id", connection.tenant_id);
  headers.set("Accept", "application/json");
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, { ...init, headers });
}

export async function xeroAccountingJson<T>(
  connection: XeroConnectionRow,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await xeroAccountingFetch(connection, path, init);
  const text = await res.text();
  if (!res.ok) {
    throw new XeroApiError(
      text.slice(0, 500) || `Xero API error (${res.status})`,
      res.status,
      text,
    );
  }
  if (!text) {
    return {} as T;
  }
  return JSON.parse(text) as T;
}
