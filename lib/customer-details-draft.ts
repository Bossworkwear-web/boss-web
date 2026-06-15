export const CUSTOMER_DETAILS_DRAFT_COOKIE = "customer_details_draft";

export type CustomerDetailsAddressParts = {
  address1: string;
  address2: string;
  suburb: string;
  postcode: string;
  state: string;
  country: string;
};

export type CustomerDetailsDraft = {
  profileId: string;
  firstName: string;
  surname: string;
  organisation: string;
  contactNumber: string;
  emailAddress: string;
  deliveryAddressParts: CustomerDetailsAddressParts;
  billingAddressParts: CustomerDetailsAddressParts;
  billingSameAsDelivery: boolean;
  marketingOptIn: boolean;
  from: string;
};

type CookieStore = {
  get: (name: string) => { value: string } | undefined;
  set: (
    name: string,
    value: string,
    options: {
      path: string;
      maxAge: number;
      sameSite: "lax";
      secure: boolean;
      httpOnly?: boolean;
    },
  ) => void;
};

const DRAFT_MAX_AGE_SECONDS = 60 * 30;

function draftCookieOptions(maxAge = DRAFT_MAX_AGE_SECONDS) {
  return {
    path: "/",
    maxAge,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  };
}

export function parseCustomerDetailsDraft(raw: string | undefined): CustomerDetailsDraft | null {
  if (!raw?.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as CustomerDetailsDraft;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function readCustomerDetailsDraft(cookieStore: CookieStore): CustomerDetailsDraft | null {
  return parseCustomerDetailsDraft(cookieStore.get(CUSTOMER_DETAILS_DRAFT_COOKIE)?.value);
}

export function saveCustomerDetailsDraft(cookieStore: CookieStore, draft: CustomerDetailsDraft) {
  cookieStore.set(CUSTOMER_DETAILS_DRAFT_COOKIE, JSON.stringify(draft), draftCookieOptions());
}

export function clearCustomerDetailsDraft(cookieStore: CookieStore) {
  cookieStore.set(CUSTOMER_DETAILS_DRAFT_COOKIE, "", draftCookieOptions(0));
}

export function shouldRepopulateCustomerDetailsDraft(status: string | undefined): boolean {
  return (
    status === "invalid" ||
    status === "invalid_postcode" ||
    status === "error" ||
    status === "email_exists"
  );
}
