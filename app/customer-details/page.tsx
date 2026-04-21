import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AddressSections } from "@/app/customer-details/address-sections";
import { ArrowLeftIcon, BuildingIcon, NotesIcon, XCircleIcon } from "@/app/components/icons";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";

export const dynamic = "force-dynamic";

type CustomerDetailsPageProps = {
  searchParams: Promise<{
    status?: string;
    full_name?: string;
    email?: string;
  }>;
};

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.includes("NEXT_REDIRECT")
  );
}

type AddressParts = {
  address1: string;
  address2: string;
  suburb: string;
  postcode: string;
  state: string;
  country: string;
};

function toAddressParts(rawAddress: string | null | undefined): AddressParts {
  const parts = (rawAddress ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  if (parts.length === 5) {
    return {
      address1: parts[0] ?? "",
      address2: "",
      suburb: parts[1] ?? "",
      postcode: parts[2] ?? "",
      state: parts[3] ?? "",
      country: parts[4] ?? "",
    };
  }
  return {
    address1: parts[0] ?? "",
    address2: parts[1] ?? "",
    suburb: parts[2] ?? "",
    postcode: parts[3] ?? "",
    state: parts[4] ?? "",
    country: parts[5] ?? "",
  };
}

function composeAddress(parts: AddressParts) {
  return [parts.address1, parts.address2, parts.suburb, parts.postcode, parts.state, parts.country]
    .map((item) => String(item ?? "").trim())
    .join(", ");
}

async function submitCustomerDetails(formData: FormData) {
  "use server";

  const profileId = String(formData.get("profile_id") ?? "").trim();
  const customerName = String(formData.get("customer_name") ?? "").trim();
  const organisation = String(formData.get("organisation") ?? "").trim();
  const contactNumber = String(formData.get("contact_number") ?? "").trim();
  const emailAddress = String(formData.get("email_address") ?? "").trim();
  const loginPasswordInput = String(formData.get("login_password") ?? "").trim();
  const deliveryAddressParts: AddressParts = {
    address1: String(formData.get("delivery_address1") ?? "").trim(),
    address2: String(formData.get("delivery_address2") ?? "").trim(),
    suburb: String(formData.get("delivery_suburb") ?? "").trim(),
    postcode: String(formData.get("delivery_postcode") ?? "").trim(),
    state: String(formData.get("delivery_state") ?? "").trim(),
    country: String(formData.get("delivery_country") ?? "").trim(),
  };
  const billingAddressParts: AddressParts = {
    address1: String(formData.get("billing_address1") ?? "").trim(),
    address2: String(formData.get("billing_address2") ?? "").trim(),
    suburb: String(formData.get("billing_suburb") ?? "").trim(),
    postcode: String(formData.get("billing_postcode") ?? "").trim(),
    state: String(formData.get("billing_state") ?? "").trim(),
    country: String(formData.get("billing_country") ?? "").trim(),
  };
  const billingSameAsDelivery = formData.get("billing_same_as_delivery") === "on";
  const finalBillingAddressParts = billingSameAsDelivery ? deliveryAddressParts : billingAddressParts;
  const deliveryAddress = composeAddress(deliveryAddressParts);
  const billingAddress = composeAddress(finalBillingAddressParts);
  const cookieStore = await cookies();
  const pendingPassword = cookieStore.get("pending_signup_password")?.value ?? "";
  const oauthPending = cookieStore.get("customer_oauth_pending")?.value === "1";
  const oauthEmailCookie = (cookieStore.get("customer_oauth_email")?.value ?? "").trim().toLowerCase();
  const isEditMode = Boolean(profileId);
  const emailNorm = emailAddress.trim().toLowerCase();
  const passwordCandidate = isEditMode ? loginPasswordInput : loginPasswordInput || pendingPassword;
  const isOauthNewSignup = Boolean(
    oauthPending && oauthEmailCookie && emailNorm === oauthEmailCookie && !isEditMode,
  );

  if (!customerName || !contactNumber || !emailAddress || !deliveryAddress || !billingAddress) {
    redirect("/customer-details?status=invalid");
  }

  const hasRequiredDeliveryFields =
    deliveryAddressParts.address1 &&
    deliveryAddressParts.suburb &&
    deliveryAddressParts.postcode &&
    deliveryAddressParts.state &&
    deliveryAddressParts.country;
  const hasRequiredBillingFields =
    finalBillingAddressParts.address1 &&
    finalBillingAddressParts.suburb &&
    finalBillingAddressParts.postcode &&
    finalBillingAddressParts.state &&
    finalBillingAddressParts.country;
  if (!hasRequiredDeliveryFields || !hasRequiredBillingFields) {
    redirect("/customer-details?status=invalid");
  }

  const postcodeRegex = /^\d{4}$/;
  if (!postcodeRegex.test(deliveryAddressParts.postcode) || !postcodeRegex.test(finalBillingAddressParts.postcode)) {
    redirect("/customer-details?status=invalid_postcode");
  }

  try {
    const supabase = createSupabaseAdminClient();

    if (isEditMode) {
      const { data: duplicateProfile, error: duplicateProfileError } = await supabase
        .from("customer_profiles")
        .select("id")
        .eq("email_address", emailNorm)
        .neq("id", profileId)
        .maybeSingle();

      if (duplicateProfileError) {
        redirect("/customer-details?status=error");
      }

      if (duplicateProfile) {
        redirect(
          `/customer-details?status=email_exists&full_name=${encodeURIComponent(customerName)}&email=${encodeURIComponent(emailAddress)}`
        );
      }

      const { data: currentRow, error: currentRowError } = await supabase
        .from("customer_profiles")
        .select("login_password")
        .eq("id", profileId)
        .maybeSingle();

      if (currentRowError) {
        redirect("/customer-details?status=error");
      }

      const storedPw = currentRow?.login_password ?? null;
      const isOauthOnlyRow = storedPw === null || storedPw === "";

      let resolvedPassword: string | null;
      if (passwordCandidate) {
        resolvedPassword = passwordCandidate;
      } else if (isOauthOnlyRow) {
        resolvedPassword = null;
      } else {
        resolvedPassword = storedPw;
      }

      if (!isOauthOnlyRow && (resolvedPassword === null || resolvedPassword === "")) {
        redirect("/customer-details?status=invalid");
      }

      const { error: updateError } = await supabase
        .from("customer_profiles")
        .update({
          customer_name: customerName,
          organisation,
          contact_number: contactNumber,
          email_address: emailNorm,
          login_password: resolvedPassword,
          delivery_address: deliveryAddress,
          billing_address: billingAddress,
        })
        .eq("id", profileId);

      if (updateError) {
        redirect("/customer-details?status=error");
      }
    } else {
      const { data: existingByEmail, error: existingProfileError } = await supabase
        .from("customer_profiles")
        .select("id")
        .eq("email_address", emailNorm)
        .maybeSingle();

      if (existingProfileError) {
        redirect("/customer-details?status=error");
      }

      if (existingByEmail) {
        redirect(
          `/customer-details?status=email_exists&full_name=${encodeURIComponent(customerName)}&email=${encodeURIComponent(emailAddress)}`
        );
      }

      let insertPassword: string | null;
      if (isOauthNewSignup) {
        insertPassword = null;
      } else if (!passwordCandidate) {
        redirect("/customer-details?status=invalid");
      } else {
        insertPassword = passwordCandidate;
      }

      const { error } = await supabase.from("customer_profiles").insert({
        customer_name: customerName,
        organisation,
        contact_number: contactNumber,
        email_address: emailNorm,
        login_password: insertPassword,
        delivery_address: deliveryAddress,
        billing_address: billingAddress,
      });

      if (error?.code === "23505") {
        redirect(
          `/customer-details?status=email_exists&full_name=${encodeURIComponent(customerName)}&email=${encodeURIComponent(emailAddress)}`
        );
      }

      if (error) {
        redirect("/customer-details?status=error");
      }
    }

    cookieStore.set("customer_name", customerName, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    cookieStore.set("customer_email", emailNorm, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    cookieStore.set("customer_delivery_address", deliveryAddress, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    cookieStore.set("pending_signup_password", "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    cookieStore.set("customer_oauth_pending", "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    cookieStore.set("customer_oauth_email", "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    redirect("/customer-details?status=error");
  }

  redirect("/");
}

export default async function CustomerDetailsPage({ searchParams }: CustomerDetailsPageProps) {
  const params = await searchParams;
  const status = params.status;
  const cookieStore = await cookies();
  const pendingPassword = cookieStore.get("pending_signup_password")?.value ?? "";
  const loggedInEmail = cookieStore.get("customer_email")?.value ?? "";
  const oauthPending = cookieStore.get("customer_oauth_pending")?.value === "1";
  const oauthEmailCookie = (cookieStore.get("customer_oauth_email")?.value ?? "").trim().toLowerCase();

  let existingProfile: {
    id: string;
    customer_name: string;
    organisation: string;
    contact_number: string;
    email_address: string;
    delivery_address: string;
    billing_address: string;
    login_password: string | null;
  } | null = null;

  if (loggedInEmail) {
    try {
      const supabase = createSupabaseAdminClient();
      const { data } = await supabase
        .from("customer_profiles")
        .select(
          "id, customer_name, organisation, contact_number, email_address, delivery_address, billing_address, login_password",
        )
        .eq("email_address", loggedInEmail)
        .maybeSingle();
      existingProfile = data;
    } catch {
      existingProfile = null;
    }
  }

  const prefilledName = existingProfile?.customer_name ?? params.full_name ?? "";
  const prefilledEmail = existingProfile?.email_address ?? params.email ?? "";
  const prefilledEmailNorm = prefilledEmail.trim().toLowerCase();
  const oauthFlowCompleting =
    oauthPending && Boolean(oauthEmailCookie) && prefilledEmailNorm === oauthEmailCookie && !existingProfile;
  const isOauthOnlyAccount =
    existingProfile !== null &&
    (existingProfile.login_password === null || existingProfile.login_password === "");
  const prefilledOrganisation = existingProfile?.organisation ?? "";
  const prefilledContact = existingProfile?.contact_number ?? "";
  const prefilledDeliveryAddress = existingProfile?.delivery_address ?? "";
  const prefilledBillingAddress = existingProfile?.billing_address ?? "";
  const deliveryParts = toAddressParts(prefilledDeliveryAddress);
  const billingParts = toAddressParts(prefilledBillingAddress);
  const defaultSameAsDelivery =
    !!prefilledDeliveryAddress &&
    (!!prefilledBillingAddress ? prefilledDeliveryAddress === prefilledBillingAddress : true);

  return (
    <main className="min-h-screen bg-white py-10 text-brand-navy">
      <div className={SITE_PAGE_ROW_CLASS}>
        <div className="mx-auto w-full max-w-[70%] space-y-6">
        <header className="space-y-3">
          <Link href="/sign-up" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-orange">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to sign up
          </Link>
          <h1 className="text-3xl font-medium">Customer Details</h1>
          <p className="text-sm text-brand-navy/70">
            Enter your details so we can process quotes, delivery, and invoicing. Organisation is optional if
            you are ordering as an individual.
          </p>
        </header>

        {status === "invalid" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700">
            <NotesIcon className="h-4 w-4" />
            Please fill in all required fields.
          </p>
        )}
        {status === "invalid_postcode" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700">
            <NotesIcon className="h-4 w-4" />
            Please include a 4-digit postcode in both Delivery Address and Billing Address.
          </p>
        )}
        {status === "error" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            <XCircleIcon className="h-4 w-4" />
            Could not save details. Please try again.
          </p>
        )}
        {status === "email_exists" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700">
            <NotesIcon className="h-4 w-4" />
            This email is already registered. Please use a different email address.
          </p>
        )}

        <form action={submitCustomerDetails} className="grid gap-5 rounded-2xl border border-brand-navy/15 p-6">
          <input type="hidden" name="profile_id" value={existingProfile?.id ?? ""} />

          <p className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.1em] text-brand-navy/75">
            <BuildingIcon className="h-4 w-4" />
            Customer Profile
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor="customer_name" className="text-sm font-semibold">
                Customer Name *
              </label>
              <input
                id="customer_name"
                name="customer_name"
                defaultValue={prefilledName}
                className="rounded-md border border-brand-navy/20 px-3 py-2"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="organisation" className="text-sm font-semibold">
                Organisation
              </label>
              <input
                id="organisation"
                name="organisation"
                defaultValue={prefilledOrganisation}
                placeholder="Leave blank if ordering as an individual"
                className="rounded-md border border-brand-navy/20 px-3 py-2"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="contact_number" className="text-sm font-semibold">
                Contact Number *
              </label>
              <input
                id="contact_number"
                name="contact_number"
                defaultValue={prefilledContact}
                className="rounded-md border border-brand-navy/20 px-3 py-2"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="email_address" className="text-sm font-semibold">
                Email Address *
              </label>
              <input
                id="email_address"
                name="email_address"
                type="email"
                readOnly={oauthFlowCompleting}
                defaultValue={prefilledEmail}
                className="rounded-md border border-brand-navy/20 px-3 py-2 read-only:bg-brand-surface/80 read-only:text-brand-navy/70"
              />
            </div>
            {oauthFlowCompleting ? null : pendingPassword ? (
              <input type="hidden" id="login_password" name="login_password" value={pendingPassword} />
            ) : (
              <div className="grid gap-2 sm:col-span-2">
                <label htmlFor="login_password" className="text-sm font-semibold">
                  Login Password{" "}
                  {existingProfile
                    ? isOauthOnlyAccount
                      ? "(optional — add one to sign in with email and password)"
                      : "(leave blank to keep current)"
                    : "*"}
                </label>
                <input
                  id="login_password"
                  name="login_password"
                  type="password"
                  className="rounded-md border border-brand-navy/20 px-3 py-2"
                />
              </div>
            )}
          </div>

          <AddressSections
            deliveryParts={deliveryParts}
            billingParts={billingParts}
            defaultSameAsDelivery={defaultSameAsDelivery}
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              className="w-fit rounded-xl bg-brand-orange px-6 py-2.5 text-sm font-medium text-brand-navy transition hover:brightness-95"
            >
              Save Customer Details
            </button>
            <Link
              href="/"
              className="w-fit rounded-xl bg-brand-surface px-6 py-2.5 text-sm font-medium text-brand-navy transition hover:text-brand-orange"
            >
              Cancel
            </Link>
          </div>
        </form>
        </div>
      </div>
    </main>
  );
}
