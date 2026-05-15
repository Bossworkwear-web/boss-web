"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { getBrowserCookie } from "@/lib/customer-browser-cookie";
import {
  isStorefrontChatSystemMessage,
  isStorefrontChatThreadClosed,
} from "@/lib/storefront-chat-status";

const STORAGE_KEY = "bossworkwear_storefront_chat_visitor_id";
const POLL_MS = 3500;
const CHAT_Z = "z-[115]";

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
  const fabClass = `storefront-chat-fab-enter fixed bottom-5 right-5 ${CHAT_Z} flex h-14 w-14 items-center justify-center rounded-full border border-brand-navy/15 bg-brand-navy text-white shadow-lg transition hover:bg-brand-navy/95 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2`;
  const panelClass = `fixed bottom-5 right-5 ${CHAT_Z} flex max-h-[min(52rem,90vh)] w-[min(22rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-2xl border border-brand-navy/15 bg-white shadow-2xl`;

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
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </button>
      ) : (
        <div
          className={`${panelClass} ${closing ? "storefront-chat-panel-exit" : "storefront-chat-panel-enter"}`}
          role="dialog"
          aria-label="Store chat"
          aria-modal="true"
          onAnimationEnd={handlePanelAnimationEnd}
        >
          <div className="border-b border-brand-navy/10 bg-brand-navy px-3 py-2.5 text-white">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{title}</p>
              <button
                type="button"
                onClick={closePanel}
                className="rounded-lg px-2 py-1 text-xs font-medium text-white/90 hover:bg-white/10"
                aria-label="Close chat"
              >
                Close
              </button>
            </div>
            {signedIn ? (
              <p className="mt-1.5 text-sm font-medium text-white/90">
                Hi, {customerDisplayName ? customerDisplayName : "there"}
              </p>
            ) : null}
          </div>

          {!signedIn ? (
            <div className="min-h-[min(14rem,24vh)] space-y-3 px-4 py-5">
              <p className="text-sm leading-relaxed text-brand-navy/85">
                Sign in to your account to send messages and see replies from our team.
              </p>
              <Link
                href="/log-in"
                className="inline-flex w-full items-center justify-center rounded-xl bg-brand-orange px-4 py-2.5 text-sm font-semibold text-brand-navy transition hover:bg-brand-orange/90"
              >
                Sign in
              </Link>
              <p className="text-xs text-brand-navy/60">
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
                  <p className="text-xs leading-relaxed text-brand-navy/70">
                    Send us a message — our team will reply here when they are available.
                  </p>
                ) : (
                  messages.map((m) => {
                    const mine = m.sender === "guest";
                    const system = isStorefrontChatSystemMessage(m.staff_identifier);
                    if (system) {
                      return (
                        <div key={m.id} className="flex justify-center px-1 py-1">
                          <p className="max-w-[95%] rounded-xl bg-brand-surface px-3 py-2 text-center text-[0.7rem] leading-relaxed text-brand-navy/75">
                            {m.body}
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                            mine ? "bg-brand-orange text-brand-navy" : "bg-brand-surface text-brand-navy"
                          }`}
                        >
                          {!mine && (
                            <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-brand-navy/55">
                              Boss Workwear
                            </p>
                          )}
                          <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {error ? <p className="px-3 pb-1 text-xs text-red-600">{error}</p> : null}
              {threadClosed ? (
                <div className="space-y-2 border-t border-brand-navy/10 p-3">
                  <p className="text-center text-xs leading-relaxed text-brand-navy/75">
                    This conversation has ended. You cannot send more messages here.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void reopenConversation()}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#ffb366] to-[#ff6600] px-4 py-2.5 text-sm font-semibold text-brand-navy disabled:opacity-50"
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
                    className="min-h-[2.75rem] flex-1 resize-none rounded-xl border border-brand-navy/15 px-2 py-1.5 text-xs text-brand-navy"
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void sendGuest()}
                    className="shrink-0 self-end rounded-xl bg-brand-orange px-3 py-2 text-xs font-semibold text-brand-navy disabled:opacity-50"
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
