import { xeroAccountingJson } from "@/lib/xero/api-client";
import type { XeroConnectionRow } from "@/lib/xero/connection-db";

type XeroContact = {
  ContactID: string;
  Name?: string;
  EmailAddress?: string;
};

function escapeXeroWhereString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Prefer company / organisation name for Xero invoice contacts; fall back to person name then email. */
export function xeroInvoiceContactDisplayName(input: {
  organisation?: string | null;
  customerName?: string | null;
  email?: string | null;
}): string {
  const org = (input.organisation ?? "").trim();
  if (org) return org;
  const name = (input.customerName ?? "").trim();
  if (name) return name;
  return (input.email ?? "").trim() || "Customer";
}

export async function updateXeroContactName(
  connection: XeroConnectionRow,
  contactId: string,
  name: string,
): Promise<void> {
  const id = contactId.trim();
  const nextName = name.trim();
  if (!id || !nextName) return;

  await xeroAccountingJson(connection, "/Contacts", {
    method: "POST",
    body: JSON.stringify({
      Contacts: [
        {
          ContactID: id,
          Name: nextName,
        },
      ],
    }),
  });
}

/**
 * Find a contact by email, or create one. When found (or after create), ensure the
 * contact Name matches the preferred display name (company name when available).
 */
export async function findOrCreateXeroContact(
  connection: XeroConnectionRow,
  input: { name: string; email: string },
): Promise<string> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim() || email;

  if (email) {
    const where = `EmailAddress=="${escapeXeroWhereString(email)}"`;
    const found = await xeroAccountingJson<{ Contacts?: XeroContact[] }>(
      connection,
      `/Contacts?where=${encodeURIComponent(where)}`,
    );
    const existing = found.Contacts?.[0];
    if (existing?.ContactID) {
      const existingName = (existing.Name ?? "").trim();
      if (name && existingName !== name) {
        try {
          await updateXeroContactName(connection, existing.ContactID, name);
        } catch {
          // Name may already be used by another contact; keep the email-matched contact.
        }
      }
      return existing.ContactID;
    }
  }

  const created = await xeroAccountingJson<{ Contacts?: XeroContact[] }>(connection, "/Contacts", {
    method: "POST",
    body: JSON.stringify({
      Contacts: [
        {
          Name: name,
          EmailAddress: email || undefined,
          ContactStatus: "ACTIVE",
        },
      ],
    }),
  });

  const contactId = created.Contacts?.[0]?.ContactID;
  if (!contactId) {
    throw new Error("Xero did not return a contact id.");
  }
  return contactId;
}
