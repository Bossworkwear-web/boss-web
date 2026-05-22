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
