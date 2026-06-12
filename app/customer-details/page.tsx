import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AddressSections } from "@/app/customer-details/address-sections";
import { CustomerDetailsForm } from "@/app/customer-details/customer-details-form";
import { ArrowLeftIcon, BuildingIcon, NotesIcon, XCircleIcon } from "@/app/components/icons";
import { getAuthenticatedCustomerUser, linkProfileToAuthUser } from "@/lib/customer-auth";
import { combineCustomerName, splitCustomerName } from "@/lib/customer-name";
import { applyCustomerPasswordChange } from "@/lib/customer-password-update";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";

export const dynamic = "force-dynamic";

type CustomerDetailsPageProps = {
  searchParams: Promise<{
    status?: string;
    full_name?: string;
    email?: string;
    /** Set from My account (e.g. Edit customer details) so the back link targets /customer. */
    from?: string;
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
  const firstName = String(formData.get("first_name") ?? "").trim();
  const surname = String(formData.get("surname") ?? "").trim();
  const customerName = combineCustomerName(firstName, surname);
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
  const authUser = await getAuthenticatedCustomerUser();
  const authUserId = authUser?.id ?? null;
  const isOauthNewSignup = Boolean(
    !isEditMode &&
      emailNorm &&
      (authUser?.email?.trim().toLowerCase() === emailNorm ||
        (oauthPending && oauthEmailCookie === emailNorm)),
  );

  if (
    !firstName ||
    !surname ||
    !customerName ||
    !organisation ||
    !contactNumber ||
    !emailAddress ||
    !deliveryAddress ||
    !billingAddress
  ) {
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
        .select("login_password, auth_user_id, email_address")
        .eq("id", profileId)
        .maybeSingle();

      if (currentRowError) {
        redirect("/customer-details?status=error");
      }

      const rowAuthUserId = currentRow?.auth_user_id ?? authUserId;
      const isOauthOnlyRow =
        Boolean(rowAuthUserId) ||
        currentRow?.login_password === null ||
        currentRow?.login_password === "";

      if (!isOauthOnlyRow && !passwordCandidate) {
        redirect("/customer-details?status=invalid");
      }

      const { error: updateError } = await supabase
        .from("customer_profiles")
        .update({
          customer_name: customerName,
          organisation,
          contact_number: contactNumber,
          email_address: emailNorm,
          login_password: rowAuthUserId ? null : currentRow?.login_password ?? null,
          delivery_address: deliveryAddress,
          billing_address: billingAddress,
          ...(rowAuthUserId ? { auth_user_id: rowAuthUserId } : {}),
        })
        .eq("id", profileId);

      if (updateError) {
        redirect("/customer-details?status=error");
      }

      if (passwordCandidate) {
        const pwRes = await applyCustomerPasswordChange(
          {
            id: profileId,
            email_address: emailNorm,
            auth_user_id: rowAuthUserId,
          },
          passwordCandidate,
        );
        if (!pwRes.ok) {
          redirect("/customer-details?status=error");
        }
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

      if (!isOauthNewSignup && !authUserId && !passwordCandidate) {
        redirect("/customer-details?status=invalid");
      }

      const insertPassword: string | null = null;

      const { data: inserted, error } = await supabase
        .from("customer_profiles")
        .insert({
          customer_name: customerName,
          organisation,
          contact_number: contactNumber,
          email_address: emailNorm,
          login_password: insertPassword,
          delivery_address: deliveryAddress,
          billing_address: billingAddress,
          ...(authUserId ? { auth_user_id: authUserId } : {}),
        })
        .select("id")
        .single();

      if (!error && inserted?.id && authUserId) {
        await linkProfileToAuthUser(inserted.id, authUserId);
      }

      if (!error && inserted?.id && passwordCandidate && !authUserId && !isOauthNewSignup) {
        const pwRes = await applyCustomerPasswordChange(
          {
            id: inserted.id,
            email_address: emailNorm,
            auth_user_id: null,
          },
          passwordCandidate,
        );
        if (!pwRes.ok) {
          redirect("/customer-details?status=error");
        }
      }

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

  redirect("/?details_saved=1");
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
    auth_user_id: string | null;
  } | null = null;

  if (loggedInEmail) {
    try {
      const supabase = createSupabaseAdminClient();
      const { data } = await supabase
        .from("customer_profiles")
        .select(
          "id, customer_name, organisation, contact_number, email_address, delivery_address, billing_address, login_password, auth_user_id",
        )
        .eq("email_address", loggedInEmail)
        .maybeSingle();
      existingProfile = data;
    } catch {
      existingProfile = null;
    }
  }

  const authUser = await getAuthenticatedCustomerUser();
  const authEmailNorm = authUser?.email?.trim().toLowerCase() ?? "";

  const prefilledName = existingProfile?.customer_name ?? params.full_name ?? "";
  const { firstName: prefilledFirstName, surname: prefilledSurname } = splitCustomerName(prefilledName);
  const prefilledEmail = existingProfile?.email_address ?? params.email ?? "";
  const prefilledEmailNorm = prefilledEmail.trim().toLowerCase();
  const oauthFlowCompleting =
    oauthPending && Boolean(oauthEmailCookie) && prefilledEmailNorm === oauthEmailCookie && !existingProfile;
  /** Email sign-up already set password in Supabase Auth — no second entry on this form. */
  const emailSignupCompleting =
    !existingProfile && Boolean(authEmailNorm) && prefilledEmailNorm === authEmailNorm && !oauthPending;
  const skipLoginPasswordField = oauthFlowCompleting || emailSignupCompleting || Boolean(pendingPassword);
  const usingSignupPassword = Boolean(pendingPassword) || emailSignupCompleting;
  const isOauthOnlyAccount =
    existingProfile !== null &&
    (Boolean(existingProfile.auth_user_id) ||
      existingProfile.login_password === null ||
      existingProfile.login_password === "");
  const prefilledOrganisation = existingProfile?.organisation ?? "";
  const prefilledContact = existingProfile?.contact_number ?? "";
  const prefilledDeliveryAddress = existingProfile?.delivery_address ?? "";
  const prefilledBillingAddress = existingProfile?.billing_address ?? "";
  const deliveryParts = toAddressParts(prefilledDeliveryAddress);
  const billingParts = toAddressParts(prefilledBillingAddress);
  const defaultSameAsDelivery =
    !!prefilledDeliveryAddress &&
    (!!prefilledBillingAddress ? prefilledDeliveryAddress === prefilledBillingAddress : true);

  const signedInCustomer = Boolean(loggedInEmail.trim());
  const backToMyAccount = params.from === "my-account" || signedInCustomer;

  return (
    <main className="min-h-screen bg-white py-10 text-brand-navy">
      <div className={SITE_PAGE_ROW_CLASS}>
        <div className="mx-auto w-full max-w-3xl space-y-6 lg:max-w-4xl">
        <header className="space-y-3">
          <Link
            href={backToMyAccount ? "/customer" : "/sign-up"}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-orange"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            {backToMyAccount ? "Back to My account" : "Back to sign up"}
          </Link>
          <h1 className="text-3xl font-medium">Customer Details</h1>
          <p className="text-sm text-brand-navy/70">
            Enter your details so we can process quotes, delivery, and invoicing.{" "}
            <strong>Organisation</strong> is required — use your company or trading name, or enter your own full name if
            you do not have one.
          </p>
        </header>

        {status === "invalid" && (
          <p className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700">
            <NotesIcon className="h-4 w-4" />
            Please fill in all required fields, including First Name and Surname. Organisation is required — if you
            have no company name, enter your own full name.
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

        <CustomerDetailsForm action={submitCustomerDetails} cancelHref="/">
          <input type="hidden" name="profile_id" value={existingProfile?.id ?? ""} />

          <p className="inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.1em] text-brand-navy/75">
            <BuildingIcon className="h-4 w-4" />
            Customer Profile
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor="first_name" className="text-sm font-semibold">
                First Name *
              </label>
              <input
                id="first_name"
                name="first_name"
                type="text"
                autoComplete="given-name"
                required
                defaultValue={prefilledFirstName}
                className="rounded-md border border-brand-navy/20 px-3 py-2"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="surname" className="text-sm font-semibold">
                Surname *
              </label>
              <input
                id="surname"
                name="surname"
                type="text"
                autoComplete="family-name"
                required
                defaultValue={prefilledSurname}
                className="rounded-md border border-brand-navy/20 px-3 py-2"
              />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <label htmlFor="organisation" className="text-sm font-semibold">
                Organisation *
              </label>
              <input
                id="organisation"
                name="organisation"
                required
                defaultValue={prefilledOrganisation}
                placeholder="Company or trading name — or your full name if you have no organisation"
                className="rounded-md border border-brand-navy/20 px-3 py-2"
              />
              <p className="text-xs text-brand-navy/60">
                No company? Put your own name here so we can invoice and deliver correctly.
              </p>
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
            {skipLoginPasswordField ? (
              usingSignupPassword ? (
                <p className="text-xs text-brand-navy/60 sm:col-span-2">
                  Your sign-up password will be used automatically — no need to enter it again.
                </p>
              ) : null
            ) : existingProfile ? (
              <div className="grid gap-2 sm:col-span-2">
                <label htmlFor="login_password" className="text-sm font-semibold">
                  Login Password{" "}
                  {isOauthOnlyAccount
                    ? "(optional — add one to sign in with email and password)"
                    : "(leave blank to keep current)"}
                </label>
                <input
                  id="login_password"
                  name="login_password"
                  type="password"
                  autoComplete="new-password"
                  className="rounded-md border border-brand-navy/20 px-3 py-2"
                />
              </div>
            ) : (
              <div className="grid gap-2 sm:col-span-2">
                <label htmlFor="login_password" className="text-sm font-semibold">
                  Login Password *
                </label>
                <input
                  id="login_password"
                  name="login_password"
                  type="password"
                  autoComplete="new-password"
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

        </CustomerDetailsForm>
        </div>
      </div>
    </main>
  );
}
