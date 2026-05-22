import {
  getXeroClientId,
  getXeroClientSecret,
  getXeroRedirectUri,
  getXeroOAuthScopes,
  XERO_AUTHORIZE_URL,
  XERO_CONNECTIONS_URL,
  XERO_TOKEN_URL,
} from "@/lib/xero/config";

export type XeroTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

export type XeroOrgConnection = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantType?: string;
  createdDateUtc?: string;
  updatedDateUtc?: string;
};

function basicAuthHeader(): string {
  const id = getXeroClientId();
  const secret = getXeroClientSecret();
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

export function buildXeroAuthorizeUrl(state: string, includeInvoices = false): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getXeroClientId(),
    redirect_uri: getXeroRedirectUri(),
    scope: getXeroOAuthScopes(includeInvoices),
    state,
  });
  return `${XERO_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeAuthorizationCode(code: string): Promise<XeroTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getXeroRedirectUri(),
  });

  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const json = (await res.json()) as XeroTokenResponse & { error?: string; error_description?: string };
  if (!res.ok) {
    throw new Error(json.error_description ?? json.error ?? `Xero token exchange failed (${res.status})`);
  }
  return json;
}

export async function refreshXeroAccessToken(refreshToken: string): Promise<XeroTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const json = (await res.json()) as XeroTokenResponse & { error?: string; error_description?: string };
  if (!res.ok) {
    throw new Error(json.error_description ?? json.error ?? `Xero token refresh failed (${res.status})`);
  }
  return json;
}

export async function fetchXeroOrgConnections(accessToken: string): Promise<XeroOrgConnection[]> {
  const res = await fetch(XERO_CONNECTIONS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const json = (await res.json()) as Array<{
    id: string;
    tenantId: string;
    tenantName: string;
    tenantType?: string;
    createdDateUtc?: string;
    updatedDateUtc?: string;
  }>;

  if (!res.ok) {
    const msg =
      typeof json === "object" && json !== null && "Detail" in json
        ? String((json as { Detail?: string }).Detail)
        : `Xero connections failed (${res.status})`;
    throw new Error(msg);
  }

  return (Array.isArray(json) ? json : []).map((c) => ({
    id: c.id,
    tenantId: c.tenantId,
    tenantName: c.tenantName,
    tenantType: c.tenantType,
    createdDateUtc: c.createdDateUtc,
    updatedDateUtc: c.updatedDateUtc,
  }));
}
