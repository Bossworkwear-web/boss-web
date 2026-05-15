export const STOREFRONT_CHAT_STATUS_OPEN = "open";
export const STOREFRONT_CHAT_STATUS_CLOSED = "closed";

export const STOREFRONT_CHAT_SYSTEM_STAFF_ID = "system";

export const STOREFRONT_CHAT_CLOSED_MESSAGE =
  "This conversation has been closed. Thank you for contacting Boss Workwear. Tap “Start a new conversation” below if you need more help.";

export const STOREFRONT_CHAT_REOPENED_MESSAGE = "This conversation has been reopened. You can send messages again.";

export function isStorefrontChatThreadClosed(status: string | null | undefined): boolean {
  return (status ?? "").trim().toLowerCase() === STOREFRONT_CHAT_STATUS_CLOSED;
}

export function isStorefrontChatSystemMessage(staffIdentifier: string | null | undefined): boolean {
  return (staffIdentifier ?? "").trim().toLowerCase() === STOREFRONT_CHAT_SYSTEM_STAFF_ID;
}
