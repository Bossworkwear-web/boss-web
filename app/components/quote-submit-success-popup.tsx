"use client";

import { useEffect, useState } from "react";

import { CheckCircleIcon } from "@/app/components/icons";

const SUCCESS_MESSAGE = "Quote request submitted successfully.";
const POPUP_DURATION_MS = 5000;

type Props = {
  show: boolean;
};

export function QuoteSubmitSuccessPopup({ show }: Props) {
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (!show) {
      return;
    }

    setVisible(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
      window.location.replace("/quote");
    }, POPUP_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [show]);

  if (!visible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4"
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-live="polite"
        aria-label={SUCCESS_MESSAGE}
        className="w-full max-w-md rounded-2xl border border-brand-orange bg-white px-6 py-8 text-center shadow-xl"
      >
        <CheckCircleIcon className="mx-auto h-10 w-10 text-green-600" />
        <p className="mt-4 text-lg font-semibold text-brand-navy">{SUCCESS_MESSAGE}</p>
      </div>
    </div>
  );
}
