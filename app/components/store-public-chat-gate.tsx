"use client";

import { usePathname } from "next/navigation";

import { StorePublicChatWidget } from "@/app/components/store-public-chat-widget";

export function StorePublicChatGate({ initialCustomerSignedIn }: { initialCustomerSignedIn: boolean }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) {
    return null;
  }
  return <StorePublicChatWidget initialCustomerSignedIn={initialCustomerSignedIn} />;
}
