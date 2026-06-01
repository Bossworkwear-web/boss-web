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

/**
 * Pull the human-readable validation messages out of a Xero error body. Xero echoes the entire submitted
 * object (Contact, LineItems, …) before the `ValidationErrors`, so naive truncation of the raw body always
 * hides the real reason. This walks the known locations and returns just the messages.
 */
export function xeroValidationMessages(body: string | undefined | null): string[] {
  if (!body) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }
  const out: string[] = [];
  const pushErrors = (errs: unknown) => {
    if (!Array.isArray(errs)) return;
    for (const ve of errs) {
      const m = (ve as { Message?: unknown })?.Message;
      if (typeof m === "string" && m.trim()) out.push(m.trim());
    }
  };
  const root = parsed as { Elements?: unknown; ValidationErrors?: unknown };
  pushErrors(root?.ValidationErrors);
  if (Array.isArray(root?.Elements)) {
    for (const el of root.Elements as Array<Record<string, unknown>>) {
      pushErrors(el?.ValidationErrors);
      if (Array.isArray(el?.LineItems)) {
        for (const li of el.LineItems as Array<Record<string, unknown>>) {
          pushErrors(li?.ValidationErrors);
        }
      }
    }
  }
  return Array.from(new Set(out));
}

/** Concise, readable summary of a Xero API failure for storage/UI (validation messages when present). */
export function summarizeXeroApiError(e: XeroApiError): string {
  const vmsgs = xeroValidationMessages(e.body);
  if (vmsgs.length) {
    return `Xero validation: ${vmsgs.join(" | ")}`;
  }
  return `Xero API (${e.status}): ${e.message}`;
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
