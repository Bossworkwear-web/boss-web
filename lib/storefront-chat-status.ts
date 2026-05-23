export const STOREFRONT_CHAT_STATUS_OPEN = "open";
export const STOREFRONT_CHAT_STATUS_CLOSED = "closed";

export const STOREFRONT_CHAT_SYSTEM_STAFF_ID = "system";
export const STOREFRONT_CHAT_ASSISTANT_STAFF_ID = "assistant";

export const STOREFRONT_CHAT_CLOSED_MESSAGE =
  "This conversation has been closed. Thank you for contacting Boss Workwear. Tap “Start a new conversation” below if you need more help.";

export const STOREFRONT_CHAT_REOPENED_MESSAGE = "This conversation has been reopened. You can send messages again.";

export function isStorefrontChatThreadClosed(status: string | null | undefined): boolean {
  return (status ?? "").trim().toLowerCase() === STOREFRONT_CHAT_STATUS_CLOSED;
}

export function isStorefrontChatSystemMessage(staffIdentifier: string | null | undefined): boolean {
  return (staffIdentifier ?? "").trim().toLowerCase() === STOREFRONT_CHAT_SYSTEM_STAFF_ID;
}

export function isStorefrontChatAssistantMessage(staffIdentifier: string | null | undefined): boolean {
  return (staffIdentifier ?? "").trim().toLowerCase() === STOREFRONT_CHAT_ASSISTANT_STAFF_ID;
}

/** True for a real admin reply (not system or virtual assistant). */
export function isStorefrontChatHumanStaffMessage(staffIdentifier: string | null | undefined): boolean {
  const id = (staffIdentifier ?? "").trim().toLowerCase();
  if (!id || id === STOREFRONT_CHAT_SYSTEM_STAFF_ID || id === STOREFRONT_CHAT_ASSISTANT_STAFF_ID) {
    return false;
  }
  return true;
}

/** Virtual assistant: FAQ + optional OpenAI. Set `STOREFRONT_CHAT_ASSISTANT_ENABLED=0` to disable. */
export function isStorefrontChatAssistantEnabled(): boolean {
  if (process.env.STOREFRONT_CHAT_ASSISTANT_ENABLED === "0") {
    return false;
  }
  if (process.env.STOREFRONT_CHAT_ASSISTANT_ENABLED === "1") {
    return true;
  }
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}
