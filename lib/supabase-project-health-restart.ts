/** Decide when the storefront should auto-restart the Supabase project (Management API). */

export const SUPABASE_UNHEALTHY_PROBE_TIMEOUT_MS = 8_000;

const BUSY_PROJECT_STATUSES = new Set([
  "COMING_UP",
  "RESTORING",
  "UPGRADING",
  "PAUSING",
  "GOING_DOWN",
  "INACTIVE",
  "RESTARTING",
  "REMOVED",
]);

export type SupabaseInstanceProbeKind = "ok" | "auth" | "unreachable" | "error";

export type SupabaseInstanceProbe = {
  kind: SupabaseInstanceProbeKind;
  httpStatus: number | null;
  detail: string;
};

export function supabaseProjectRefFromUrl(rawUrl: string | null | undefined): string | null {
  const trimmed = rawUrl?.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    const m = /^([a-z0-9]+)\.supabase\.co$/i.exec(host);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

export function classifySupabaseInstanceProbe(input: {
  httpStatus: number | null;
  timedOut?: boolean;
  networkError?: boolean;
  bodySnippet?: string;
}): SupabaseInstanceProbe {
  if (input.timedOut) {
    return { kind: "unreachable", httpStatus: null, detail: "probe timed out" };
  }
  if (input.networkError) {
    return { kind: "unreachable", httpStatus: input.httpStatus, detail: "network error reaching project API" };
  }
  const status = input.httpStatus;
  if (status == null) {
    return { kind: "error", httpStatus: null, detail: "no HTTP status" };
  }
  if (status === 401 || status === 403) {
    return { kind: "auth", httpStatus: status, detail: "API key rejected — do not restart" };
  }
  if (status >= 200 && status < 300) {
    return { kind: "ok", httpStatus: status, detail: "project API responded" };
  }
  if (status === 520 || status === 521 || status === 522 || status === 523 || status === 524) {
    return { kind: "unreachable", httpStatus: status, detail: `Cloudflare ${status}` };
  }
  if (status === 502 || status === 503 || status === 504) {
    return { kind: "unreachable", httpStatus: status, detail: `upstream ${status}` };
  }
  const snippet = (input.bodySnippet ?? "").toLowerCase();
  if (snippet.includes("connection timed out") || snippet.includes("522:")) {
    return { kind: "unreachable", httpStatus: status, detail: "origin connection timed out" };
  }
  return { kind: "error", httpStatus: status, detail: `unexpected HTTP ${status}` };
}

export function isSupabaseProjectBusy(status: string | null | undefined): boolean {
  const s = status?.trim().toUpperCase();
  if (!s) {
    return false;
  }
  return BUSY_PROJECT_STATUSES.has(s);
}

export type AutoRestartDecision =
  | { action: "skip"; reason: string }
  | { action: "restart"; reason: string };

export function decideSupabaseAutoRestart(input: {
  hasManagementToken: boolean;
  projectRef: string | null;
  probe: SupabaseInstanceProbe;
  projectStatus: string | null;
}): AutoRestartDecision {
  if (!input.hasManagementToken) {
    return { action: "skip", reason: "SUPABASE_ACCESS_TOKEN is not set" };
  }
  if (!input.projectRef) {
    return { action: "skip", reason: "could not parse project ref from NEXT_PUBLIC_SUPABASE_URL" };
  }
  if (input.probe.kind === "ok") {
    return { action: "skip", reason: "project API is responding" };
  }
  if (input.probe.kind === "auth") {
    return { action: "skip", reason: "API key / auth problem — restart will not help" };
  }
  if (isSupabaseProjectBusy(input.projectStatus)) {
    return { action: "skip", reason: `project already ${input.projectStatus}` };
  }
  if (input.probe.kind === "unreachable") {
    return { action: "restart", reason: input.probe.detail };
  }
  return { action: "skip", reason: input.probe.detail };
}

export async function probeSupabaseInstanceApi(input: {
  supabaseUrl: string;
  anonKey: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<SupabaseInstanceProbe> {
  const timeoutMs = input.timeoutMs ?? SUPABASE_UNHEALTHY_PROBE_TIMEOUT_MS;
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = `${input.supabaseUrl.replace(/\/$/, "")}/rest/v1/products?select=id&limit=1`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      headers: {
        apikey: input.anonKey,
        Authorization: `Bearer ${input.anonKey}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
      signal: controller.signal,
      cache: "no-store",
    });
    const bodySnippet = await res.text().catch(() => "");
    return classifySupabaseInstanceProbe({
      httpStatus: res.status,
      bodySnippet: bodySnippet.slice(0, 400),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const timedOut = controller.signal.aborted || /timeout|aborted|abort/i.test(msg);
    return classifySupabaseInstanceProbe({
      httpStatus: null,
      timedOut,
      networkError: !timedOut,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchSupabaseProjectStatus(input: {
  projectRef: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<string | null> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const res = await fetchImpl(`https://api.supabase.com/v1/projects/${input.projectRef}`, {
    headers: { Authorization: `Bearer ${input.accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    return null;
  }
  const json = (await res.json()) as { status?: unknown };
  return typeof json.status === "string" ? json.status : null;
}

export async function restartSupabaseProject(input: {
  projectRef: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: boolean; httpStatus: number; detail: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const res = await fetchImpl(`https://api.supabase.com/v1/projects/${input.projectRef}/restart`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: "{}",
    cache: "no-store",
  });
  const detail = (await res.text().catch(() => "")).slice(0, 400);
  return { ok: res.ok, httpStatus: res.status, detail: detail || `HTTP ${res.status}` };
}
