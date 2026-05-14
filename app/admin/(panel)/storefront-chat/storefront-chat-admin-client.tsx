"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type ThreadRow = {
  id: string;
  visitor_key: string;
  customer_email: string | null;
  visitor_name: string | null;
  visitor_email: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  sender: string;
  body: string;
  created_at: string;
  staff_identifier: string | null;
};

const POLL_MS = 3000;

export function StorefrontChatAdminClient() {
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [msgError, setMsgError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    const res = await fetch("/api/admin/chat/threads", { credentials: "include", cache: "no-store" });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      threads?: ThreadRow[];
      error?: string;
    };
    if (!res.ok || !json.ok) {
      setThreadsError(json.error ?? "Could not load threads.");
      return;
    }
    setThreadsError(null);
    setThreads(json.threads ?? []);
  }, []);

  const loadMessages = useCallback(async (threadId: string) => {
    const res = await fetch(`/api/admin/chat/messages?threadId=${encodeURIComponent(threadId)}`, {
      credentials: "include",
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; messages?: MessageRow[]; error?: string };
    if (!res.ok || !json.ok) {
      setMsgError(json.error ?? "Could not load messages.");
      return;
    }
    setMsgError(null);
    setMessages(json.messages ?? []);
  }, []);

  useEffect(() => {
    void loadThreads();
    const t = window.setInterval(() => void loadThreads(), POLL_MS * 2);
    return () => window.clearInterval(t);
  }, [loadThreads]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedId);
    const t = window.setInterval(() => void loadMessages(selectedId), POLL_MS);
    return () => window.clearInterval(t);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const selected = useMemo(() => threads.find((t) => t.id === selectedId) ?? null, [threads, selectedId]);

  async function sendStaff() {
    const text = draft.trim();
    if (!selectedId || !text || busy) {
      return;
    }
    setBusy(true);
    setMsgError(null);
    try {
      const res = await fetch("/api/admin/chat/messages", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: selectedId, body: text }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setMsgError(json.error ?? "Send failed.");
        return;
      }
      setDraft("");
      await loadMessages(selectedId);
      await loadThreads();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Storefront chat</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Conversations started from the public site widget (&ldquo;Chat with US&rdquo;). Select a thread to read and
          reply.
        </p>
      </header>

      {threadsError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {threadsError}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,17rem)_1fr]">
        <aside className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Threads
          </div>
          <ul className="max-h-[min(28rem,55vh)] divide-y divide-slate-100 overflow-y-auto">
            {threads.length === 0 ? (
              <li className="px-3 py-4 text-sm text-slate-500">No conversations yet.</li>
            ) : (
              threads.map((t) => {
                const active = t.id === selectedId;
                const label =
                  t.customer_email?.trim() ||
                  t.visitor_email?.trim() ||
                  t.visitor_name?.trim() ||
                  `Visitor ${t.visitor_key.slice(0, 8)}…`;
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.id)}
                      className={`flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm transition ${
                        active ? "bg-brand-orange/15 text-brand-navy" : "text-slate-800 hover:bg-slate-50"
                      }`}
                    >
                      <span className="font-medium leading-snug">{label}</span>
                      <span className="text-[0.7rem] text-slate-500">
                        {new Date(t.updated_at).toLocaleString(undefined, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </aside>

        <section className="flex min-h-[min(28rem,55vh)] flex-col rounded-xl border border-slate-200 bg-white">
          {!selectedId ? (
            <p className="p-6 text-sm text-slate-500">Select a thread to view messages.</p>
          ) : (
            <>
              <div className="border-b border-slate-200 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">
                  {selected?.customer_email?.trim() ||
                    selected?.visitor_email?.trim() ||
                    selected?.visitor_name?.trim() ||
                    "Anonymous visitor"}
                </p>
                <p className="mt-1 font-mono text-xs text-slate-500">Thread {selectedId}</p>
              </div>
              <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-3">
                {messages.map((m) => {
                  const staff = m.sender === "staff";
                  return (
                    <div key={m.id} className={`flex ${staff ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                          staff ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-900"
                        }`}
                      >
                        {staff ? (
                          <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-white/70">
                            Staff{m.staff_identifier ? ` (${m.staff_identifier})` : ""}
                          </p>
                        ) : (
                          <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
                            Customer
                          </p>
                        )}
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              {msgError ? <p className="px-4 pb-1 text-xs text-red-600">{msgError}</p> : null}
              <div className="mt-auto flex gap-2 border-t border-slate-200 p-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void sendStaff();
                    }
                  }}
                  rows={2}
                  placeholder="Reply to customer…"
                  className="min-h-[2.75rem] flex-1 resize-none rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void sendStaff()}
                  className="shrink-0 self-end rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-brand-navy disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
