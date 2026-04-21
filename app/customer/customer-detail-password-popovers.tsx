"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { NotesIcon, XCircleIcon } from "@/app/components/icons";

import { submitChangePassword } from "./actions";

export type CustomerProfileForPopovers = {
  customer_name: string;
  organisation: string;
  contact_number: string;
  email_address: string;
  delivery_address: string;
  billing_address: string;
  login_password: string | null;
};

type Panel = "detail" | "password" | null;

type CustomerDetailPasswordPopoversProps = {
  profile: CustomerProfileForPopovers | null;
  passwordStatus: string | undefined;
  canChangePassword: boolean;
};

export function CustomerDetailPasswordPopovers({
  profile,
  passwordStatus,
  canChangePassword,
}: CustomerDetailPasswordPopoversProps) {
  const [open, setOpen] = useState<Panel>(null);

  useEffect(() => {
    if (passwordStatus) {
      setOpen("password");
    }
  }, [passwordStatus]);

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(null);
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setOpen("detail")}
          className="flex min-h-[62px] w-full items-center justify-between rounded-2xl border border-brand-navy/15 bg-brand-surface/50 px-5 py-4 text-left text-[1.35rem] font-semibold text-brand-navy transition hover:border-brand-orange/40 hover:bg-white"
        >
          Customer detail
          <span className="text-[1.05rem] font-normal text-brand-navy/50" aria-hidden>
            →
          </span>
        </button>
        <button
          type="button"
          onClick={() => setOpen("password")}
          className="flex min-h-[62px] w-full items-center justify-between rounded-2xl border border-brand-navy/15 bg-brand-surface/50 px-5 py-4 text-left text-[1.35rem] font-semibold text-brand-navy transition hover:border-brand-orange/40 hover:bg-white"
        >
          Change password
          <span className="text-[1.05rem] font-normal text-brand-navy/50" aria-hidden>
            →
          </span>
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-[200] flex items-end justify-center p-4 sm:items-center"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Close dialog"
            onClick={() => setOpen(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-popup-title"
            className="relative z-10 flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col rounded-2xl border border-brand-navy/10 bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-brand-navy/10 px-5 py-4">
              <h2 id="customer-popup-title" className="text-[1.35rem] font-semibold text-brand-navy">
                {open === "detail" ? "Customer detail" : "Change password"}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="rounded-lg px-3 py-1.5 text-[1.05rem] font-semibold text-brand-navy hover:bg-brand-surface"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {open === "detail" ? (
                <div className="space-y-6">
                  {profile ? (
                    <dl className="grid gap-4 text-[1.05rem] sm:grid-cols-2">
                      <div>
                        <dt className="font-semibold text-brand-navy/70">Name</dt>
                        <dd className="mt-1 text-brand-navy">{profile.customer_name}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-brand-navy/70">Email</dt>
                        <dd className="mt-1 text-brand-navy">{profile.email_address}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-brand-navy/70">Organisation</dt>
                        <dd className="mt-1 text-brand-navy">
                          {profile.organisation?.trim() ? profile.organisation : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold text-brand-navy/70">Contact number</dt>
                        <dd className="mt-1 text-brand-navy">{profile.contact_number}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="font-semibold text-brand-navy/70">Delivery address</dt>
                        <dd className="mt-1 whitespace-pre-wrap text-brand-navy">{profile.delivery_address}</dd>
                      </div>
                      <div className="sm:col-span-2">
                        <dt className="font-semibold text-brand-navy/70">Billing address</dt>
                        <dd className="mt-1 whitespace-pre-wrap text-brand-navy">{profile.billing_address}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="text-[1.05rem] text-brand-navy/75">
                      We couldn&apos;t load your saved profile. You can still add or update details on the customer
                      details page.
                    </p>
                  )}
                  <Link
                    href="/customer-details"
                    className="inline-flex rounded-xl bg-brand-orange px-5 py-2.5 text-[1.05rem] font-medium text-brand-navy transition hover:brightness-95"
                  >
                    Edit customer details
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {passwordStatus === "success" && (
                    <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[1.05rem] font-medium text-emerald-800">
                      Your password has been updated.
                    </p>
                  )}
                  {passwordStatus === "wrong" && (
                    <p className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-[1.05rem] font-medium text-red-700">
                      <XCircleIcon className="h-[1.2rem] w-[1.2rem] shrink-0" />
                      Current password is not correct.
                    </p>
                  )}
                  {passwordStatus === "mismatch" && (
                                       <p className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-[1.05rem] font-medium text-orange-700">
                      <NotesIcon className="h-[1.2rem] w-[1.2rem] shrink-0" />
                      New password and confirmation do not match.
                    </p>
                  )}
                  {passwordStatus === "invalid" && (
                    <p className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-[1.05rem] font-medium text-orange-700">
                      <NotesIcon className="h-[1.2rem] w-[1.2rem] shrink-0" />
                      Please fill in all password fields.
                    </p>
                  )}
                  {passwordStatus === "weak" && (
                    <p className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-[1.05rem] font-medium text-orange-700">
                      <NotesIcon className="h-[1.2rem] w-[1.2rem] shrink-0" />
                      Choose a new password of at least 8 characters.
                    </p>
                  )}
                  {passwordStatus === "same" && (
                    <p className="inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-[1.05rem] font-medium text-orange-700">
                      <NotesIcon className="h-[1.2rem] w-[1.2rem] shrink-0" />
                      New password must be different from your current password.
                    </p>
                  )}
                  {passwordStatus === "oauth" && (
                    <p className="rounded-lg border border-brand-navy/15 bg-brand-surface/60 px-4 py-3 text-[1.05rem] text-brand-navy/80">
                      This account signs in with a social provider or has no email password set. Use the provider
                      buttons on the log-in page, or add a password under{" "}
                      <Link href="/customer-details" className="font-semibold text-brand-orange hover:underline">
                        customer details
                      </Link>
                      .
                    </p>
                  )}
                  {passwordStatus === "error" && (
                    <p className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-[1.05rem] font-medium text-red-700">
                      <XCircleIcon className="h-[1.2rem] w-[1.2rem] shrink-0" />
                      Something went wrong. Please try again.
                    </p>
                  )}

                  {canChangePassword ? (
                    <form action={submitChangePassword} className="grid gap-4">
                      <div className="grid gap-2">
                        <label htmlFor="popup_current_password" className="text-[1.05rem] font-semibold">
                          Current password
                        </label>
                        <input
                          id="popup_current_password"
                          name="current_password"
                          type="password"
                          autoComplete="current-password"
                          required
                          className="rounded-md border border-brand-navy/20 bg-white px-3 py-2 text-[1.05rem]"
                        />
                      </div>
                      <div className="grid gap-2">
                        <label htmlFor="popup_new_password" className="text-[1.05rem] font-semibold">
                          New password
                        </label>
                        <input
                          id="popup_new_password"
                          name="new_password"
                          type="password"
                          autoComplete="new-password"
                          required
                          minLength={8}
                          className="rounded-md border border-brand-navy/20 bg-white px-3 py-2 text-[1.05rem]"
                        />
                      </div>
                      <div className="grid gap-2">
                        <label htmlFor="popup_confirm_password" className="text-[1.05rem] font-semibold">
                          Confirm new password
                        </label>
                        <input
                          id="popup_confirm_password"
                          name="confirm_password"
                          type="password"
                          autoComplete="new-password"
                          required
                          minLength={8}
                          className="rounded-md border border-brand-navy/20 bg-white px-3 py-2 text-[1.05rem]"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-fit rounded-xl bg-brand-orange px-5 py-2.5 text-[1.05rem] font-medium text-brand-navy transition hover:brightness-95"
                      >
                        Update password
                      </button>
                    </form>
                  ) : (
                    <p className="text-[1.05rem] text-brand-navy/75">
                      Password change is only available when your account has an email password. Social sign-in
                      accounts can set an optional password on the{" "}
                      <Link href="/customer-details" className="font-semibold text-brand-orange hover:underline">
                        customer details
                      </Link>{" "}
                      page.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
