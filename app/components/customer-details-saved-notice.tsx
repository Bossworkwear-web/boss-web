"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

export function CustomerDetailsSavedNotice() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (pathname === "/" && searchParams.get("details_saved") === "1") {
      setVisible(true);
      window.dispatchEvent(new Event("boss-customer-profile-saved"));
    }
  }, [pathname, searchParams]);

  const dismiss = useCallback(() => {
    setVisible(false);
    if (searchParams.get("details_saved") === "1") {
      router.replace("/", { scroll: false });
    }
  }, [router, searchParams]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    const id = window.setTimeout(dismiss, 5000);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismiss();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [visible, dismiss]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-5 sm:p-8"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="details-saved-title"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-lg rounded-3xl border border-brand-navy/10 bg-white px-8 py-8 text-center shadow-2xl sm:max-w-xl sm:px-12 sm:py-10"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="details-saved-title" className="text-xl font-semibold text-brand-navy sm:text-2xl">
          Your Detail is Saved
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="mt-8 rounded-xl bg-brand-orange px-8 py-2.5 text-sm font-semibold text-brand-navy transition hover:brightness-95"
        >
          OK
        </button>
      </div>
    </div>
  );
}
