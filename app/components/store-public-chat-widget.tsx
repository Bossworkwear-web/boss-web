"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { getBrowserCookie } from "@/lib/customer-browser-cookie";
import {
  dispatchStorefrontChatLayout,
} from "@/lib/storefront-chat-layout";
import {
  isStorefrontChatAssistantMessage,
  isStorefrontChatSystemMessage,
  isStorefrontChatThreadClosed,
} from "@/lib/storefront-chat-status";

/** Chat panel copy — 30% larger than default xs/sm (0.75rem / 0.875rem). */
const CHAT_TEXT_XS = "text-[0.975rem]";
const CHAT_TEXT_SM = "text-[1.1375rem]";
const CHAT_TEXT_SYSTEM = "text-[0.91rem]";
const CHAT_TEXT_META = "text-[0.845rem]";
const POLL_MS = 3500;
const CHAT_Z = "z-[115]";
/** Bump when replacing `public/storefront-chat/fab.png`. */
const CHAT_FAB_SRC = "/storefront-chat/fab.png?v=20260525";

type ChatRow = {
  id: string;
  sender: string;
  body: string;
  created_at: string;
  staff_identifier: string | null;
};

function newVisitorId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY)?.trim();
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) {
      return existing;
    }
    const id = newVisitorId();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return newVisitorId();
  }
}

export function StorePublicChatWidget({ initialCustomerSignedIn }: { initialCustomerSignedIn: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [signedIn, setSignedIn] = useState(initialCustomerSignedIn);
  const [customerDisplayName, setCustomerDisplayName] = useState("");
  const [visitorKey, setVisitorKey] = useState("");
  const [messages, setMessages] = useState<ChatRow[]>([]);
  const [threadStatus, setThreadStatus] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisitorKey(getOrCreateVisitorId());
  }, []);

  useEffect(() => {
    const sync = () => {
      setSignedIn(Boolean(getBrowserCookie("customer_email").trim()));
      setCustomerDisplayName(getBrowserCookie("customer_name").trim());
    };
    sync();
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [pathname, initialCustomerSignedIn]);

  useEffect(() => {
    if (signedIn) {
      return;
    }
    const id = window.setInterval(() => {
      setSignedIn(Boolean(getBrowserCookie("customer_email").trim()));
      setCustomerDisplayName(getBrowserCookie("customer_name").trim());
    }, 1500);
    return () => window.clearInterval(id);
  }, [signedIn]);

  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const bootstrap = useCallback(async () => {
    if (!visitorKey || !signedIn) {
      return;
    }
    setError(null);
    const res = await fetch("/api/storefront/chat/open", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitorKey,
        visitorName: getBrowserCookie("customer_name").trim() || undefined,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; threadId?: string; error?: string };
    if (!res.ok || !json.ok || !json.threadId) {
      setError(json.error ?? "Could not connect to chat.");
      return;
    }
  }, [visitorKey, signedIn]);

  const refreshMessages = useCallback(async () => {
    if (!visitorKey || !signedIn) {
      return;
    }
    const res = await fetch(`/api/storefront/chat/messages?visitorKey=${encodeURIComponent(visitorKey)}`, {
      credentials: "include",
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      messages?: ChatRow[];
      threadId?: string | null;
      threadStatus?: string | null;
      error?: string;
    };
    if (!res.ok || !json.ok) {
      if (open) {
        setError(json.error ?? "Could not load messages.");
      }
      return;
    }
    setMessages(Array.isArray(json.messages) ? json.messages : []);
    setThreadStatus(json.threadStatus ?? null);
    setError(null);
  }, [visitorKey, open, signedIn]);

  const threadClosed = isStorefrontChatThreadClosed(threadStatus);

  const reopenConversation = useCallback(async () => {
    if (!visitorKey || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/storefront/chat/reopen", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorKey }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Could not start a new conversation.");
        return;
      }
      await refreshMessages();
    } finally {
      setBusy(false);
    }
  }, [visitorKey, busy, refreshMessages]);

  useEffect(() => {
    if (!open || !visitorKey || !signedIn) {
      return;
    }
    void bootstrap();
  }, [open, visitorKey, signedIn, bootstrap]);

  useEffect(() => {
    if (!open || !visitorKey || !signedIn) {
      return;
    }
    void refreshMessages();
    const t = window.setInterval(() => void refreshMessages(), POLL_MS);
    return () => window.clearInterval(t);
  }, [open, visitorKey, signedIn, refreshMessages]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(scrollToBottom);
    }
  }, [open, messages, scrollToBottom]);

  async function sendGuest() {
    if (!signedIn || threadClosed) {
      return;
    }
    const text = draft.trim();
    if (!text || !visitorKey || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/storefront/chat/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visitorKey, body: text }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Send failed.");
        setBusy(false);
        return;
      }
      setDraft("");
      await refreshMessages();
    } finally {
      setBusy(false);
    }
  }

  const showPanel = open || closing;

  useEffect(() => {
    if (!showPanel) {
      dispatchStorefrontChatLayout({ open: false, height: 0 });
      return;
    }

    const measure = () => {
      const height = panelRef.current?.getBoundingClientRect().height ?? 0;
      dispatchStorefrontChatLayout({ open: true, height });
    };

    measure();
    const panel = panelRef.current;
    const ro = panel ? new ResizeObserver(measure) : null;
    if (panel && ro) {
      ro.observe(panel);
    }
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [showPanel]);

  const openPanel = useCallback(() => {
    setClosing(false);
    setOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    if (!open) {
      return;
    }
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOpen(false);
      setClosing(false);
      return;
    }
    setClosing(true);
  }, [open]);

  const handlePanelAnimationEnd = useCallback(
    (e: React.AnimationEvent<HTMLDivElement>) => {
      if (e.target !== e.currentTarget || !closing) {
        return;
      }
      setOpen(false);
      setClosing(false);
    },
    [closing],
  );

  const title = "Chat with US";
  const fabClass = `storefront-chat-fab-enter fixed bottom-5 right-5 ${CHAT_Z} flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full shadow-lg transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2`;
  const panelClass = `storefront-chat-panel fixed bottom-5 right-5 ${CHAT_Z} flex max-h-[min(52rem,90vh)] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-brand-navy/15 bg-white shadow-2xl`;

  return (
    <div className="print:hidden">
      {!showPanel ? (
        <button
          type="button"
          onClick={openPanel}
          className={fabClass}
          aria-haspopup="dialog"
          aria-expanded={false}
          aria-label={title}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- fixed FAB asset; plain img avoids Image SSR hydration drift */}
          <img
            src={CHAT_FAB_SRC}
            alt=""
            width={56}
            height={56}
            className="h-14 w-14 object-cover"
            decoding="async"
          />
        </button>
      ) : (
        <div
          ref={panelRef}
          className={`${panelClass} ${closing ? "storefront-chat-panel-exit" : "storefront-chat-panel-enter"}`}
          role="dialog"
          aria-label="Store chat"
          aria-modal="true"
          onAnimationEnd={handlePanelAnimationEnd}
        >
          <div className="border-b border-brand-navy/10 bg-brand-navy px-3 py-2.5 text-white">
            <div className="flex items-center justify-between gap-2">
              <p className={`${CHAT_TEXT_SM} font-semibold`}>{title}</p>
              <button
                type="button"
                onClick={closePanel}
                className={`rounded-lg px-2 py-1 ${CHAT_TEXT_XS} font-medium text-white/90 hover:bg-white/10`}
                aria-label="Close chat"
              >
                Close
              </button>
            </div>
            {signedIn ? (
              <p className={`mt-1.5 ${CHAT_TEXT_SM} font-medium text-white/90`}>
                Hi, {customerDisplayName ? customerDisplayName : "there"}
              </p>
            ) : null}
          </div>

          {!signedIn ? (
            <div className="min-h-[min(14rem,24vh)] space-y-3 px-4 py-5">
              <p className={`${CHAT_TEXT_SM} leading-relaxed text-brand-navy/85`}>
                Sign in to your account to send messages and see replies from our team.
              </p>
              <Link
                href="/log-in"
                className={`inline-flex w-full items-center justify-center rounded-xl bg-brand-orange px-4 py-2.5 ${CHAT_TEXT_SM} font-semibold text-brand-navy transition hover:bg-brand-orange/90`}
              >
                Sign in
              </Link>
              <p className={`${CHAT_TEXT_XS} text-brand-navy/60`}>
                After signing in, open this window again — or it will connect automatically within a few seconds.
              </p>
            </div>
          ) : (
            <>
              <div
                ref={listRef}
                className="min-h-[min(22rem,40vh)] flex-1 max-h-[min(44rem,80vh)] space-y-2 overflow-y-auto px-3 py-3"
              >
                {messages.length === 0 ? (
                  <p className={`${CHAT_TEXT_XS} leading-relaxed text-brand-navy/70`}>
                    Ask about orders, delivery, or quotes — our virtual assistant replies in English right away,
                    and our team can follow up here when needed.
                  </p>
                ) : (
                  messages.map((m) => {
                    const mine = m.sender === "guest";
                    const system = isStorefrontChatSystemMessage(m.staff_identifier);
                    const assistant = isStorefrontChatAssistantMessage(m.staff_identifier);
                    if (system) {
                      return (
                        <div key={m.id} className="flex justify-center px-1 py-1">
                          <p className={`max-w-[95%] rounded-xl bg-brand-surface px-3 py-2 text-center ${CHAT_TEXT_SYSTEM} leading-relaxed text-brand-navy/75`}>
                            {m.body}
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 ${CHAT_TEXT_XS} leading-relaxed ${
                            mine ? "bg-brand-orange text-brand-navy" : "bg-brand-surface text-brand-navy"
                          }`}
                        >
                          {!mine && (
                            <p className={`${CHAT_TEXT_META} mb-1 font-semibold uppercase tracking-wide text-brand-navy/55`}>
                              {assistant ? "Virtual assistant" : "Boss Workwear"}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {error ? <p className={`px-3 pb-1 ${CHAT_TEXT_XS} text-red-600`}>{error}</p> : null}
              {threadClosed ? (
                <div className="space-y-2 border-t border-brand-navy/10 p-3">
                  <p className={`text-center ${CHAT_TEXT_XS} leading-relaxed text-brand-navy/75`}>
                    This conversation has ended. You cannot send more messages here.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void reopenConversation()}
                    className={`inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#ffb366] to-[#ff6600] px-4 py-2.5 ${CHAT_TEXT_SM} font-semibold text-brand-navy disabled:opacity-50`}
                  >
                    Start a new conversation
                  </button>
                </div>
              ) : (
                <div className="flex gap-2 border-t border-brand-navy/10 p-2">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendGuest();
                      }
                    }}
                    rows={2}
                    placeholder="Type a message…"
                    className={`min-h-[3.575rem] flex-1 resize-none rounded-xl border border-brand-navy/15 px-2 py-1.5 ${CHAT_TEXT_XS} text-brand-navy`}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void sendGuest()}
                    className={`shrink-0 self-end rounded-xl bg-brand-orange px-3 py-2 ${CHAT_TEXT_XS} font-semibold text-brand-navy disabled:opacity-50`}
                  >
                    Send
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
