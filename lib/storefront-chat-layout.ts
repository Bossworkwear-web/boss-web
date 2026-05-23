export const STOREFRONT_CHAT_LAYOUT_EVENT = "storefront-chat-layout";

export type StorefrontChatLayoutDetail = {
  open: boolean;
  /** Open chat panel height in px (0 when closed). */
  height: number;
};

export function dispatchStorefrontChatLayout(detail: StorefrontChatLayoutDetail): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(STOREFRONT_CHAT_LAYOUT_EVENT, { detail }));
}

/** Fixed `bottom` offset (px) so the cyber-assist bell sits above the chat panel. */
export function cyberAssistBottomPxForChatLayout(detail: StorefrontChatLayoutDetail): number | null {
  if (!detail.open || detail.height <= 0) {
    return null;
  }
  const chatPanelBottomPx = 20; // matches `bottom-5`
  const gapPx = 12;
  const extraLiftPx = Math.round(96 / 2.54); // 1cm above the open chat panel
  return chatPanelBottomPx + detail.height + gapPx + extraLiftPx;
}
