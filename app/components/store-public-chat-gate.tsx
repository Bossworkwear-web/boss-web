"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { StorePublicChatWidget } from "@/app/components/store-public-chat-widget";

/** Render chat only after mount — avoids SSR/client HTML drift on the floating FAB. */
export function StorePublicChatGate({ initialCustomerSignedIn }: { initialCustomerSignedIn: boolean }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || pathname?.startsWith("/admin")) {
    return null;
  }

  return <StorePublicChatWidget initialCustomerSignedIn={initialCustomerSignedIn} />;
}
