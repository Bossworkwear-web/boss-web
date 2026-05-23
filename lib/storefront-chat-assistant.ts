import { bumpStorefrontChatThreadUpdatedAt } from "@/lib/storefront-chat-db";
import { matchStorefrontChatFaq } from "@/lib/storefront-chat-faq";
import {
  formatStorefrontChatOrderContextForPrompt,
  loadStorefrontChatCustomerContext,
} from "@/lib/storefront-chat-order-context";
import {
  isStorefrontChatAssistantEnabled,
  isStorefrontChatHumanStaffMessage,
  STOREFRONT_CHAT_ASSISTANT_STAFF_ID,
} from "@/lib/storefront-chat-status";
import { getSiteUrl } from "@/lib/site-url";
import type { SupabaseClient } from "@supabase/supabase-js";

function buildKnowledgeBase(): string {
  const site = getSiteUrl();
  return `
Boss Workwear (Australia) — storefront assistant facts:
- Customers must sign in to use live chat.
- My account (${site}/customer): order list, status, Track links, invoice download when available.
- Order tracking: each order has a Track page with processing → dispatch → expected arrival steps; estimates update after dispatch.
- Quotes: "Email for a free quote" on category pages; Contact us (${site}/contact-us) for bulk, decoration, or pre-purchase questions.
- Prices on the site include GST unless stated otherwise.
- Checkout is online; delivery address is saved in customer details.
- Do not invent order numbers, tracking numbers, dates, or prices not provided in CUSTOMER ORDER CONTEXT.
- If unsure or the question needs a human decision, say our team will follow up in this chat — do not guess.
- Reply in English only, concise (under 120 words unless listing order facts), friendly, plain text (no markdown).
`.trim();
}

const FALLBACK_REPLY =
  "Thanks for your message. I’m not fully sure of the answer — our team will reply here as soon as they can. You can also use Contact us on the website for urgent help.";

type ChatHistoryRow = {
  sender: string;
  body: string;
  staff_identifier: string | null;
};

async function threadHasHumanStaffReply(
  supabase: SupabaseClient,
  threadId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("storefront_chat_messages")
    .select("sender, staff_identifier")
    .eq("thread_id", threadId)
    .eq("sender", "staff")
    .order("created_at", { ascending: false })
    .limit(30);

  return (data ?? []).some((m) => isStorefrontChatHumanStaffMessage(m.staff_identifier));
}

async function loadRecentChatHistory(
  supabase: SupabaseClient,
  threadId: string,
): Promise<ChatHistoryRow[]> {
  const { data } = await supabase
    .from("storefront_chat_messages")
    .select("sender, body, staff_identifier")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(24);

  return (data ?? []).map((m) => ({
    sender: String(m.sender ?? ""),
    body: String(m.body ?? "").trim(),
    staff_identifier: m.staff_identifier != null ? String(m.staff_identifier) : null,
  }));
}

function historyToOpenAiMessages(
  rows: ChatHistoryRow[],
): { role: "user" | "assistant"; content: string }[] {
  const out: { role: "user" | "assistant"; content: string }[] = [];
  for (const row of rows) {
    if (!row.body) {
      continue;
    }
    if (row.sender === "guest") {
      out.push({ role: "user", content: row.body });
    } else if (row.sender === "staff") {
      out.push({ role: "assistant", content: row.body });
    }
  }
  return out.slice(-12);
}

async function callOpenAiAssistant(params: {
  userMessage: string;
  history: ChatHistoryRow[];
  orderContextText: string;
}): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const model = process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini";

  const system = `${buildKnowledgeBase()}

CUSTOMER ORDER CONTEXT (signed-in email only):
${params.orderContextText}`;

  const messages = [
    { role: "system" as const, content: system },
    ...historyToOpenAiMessages(params.history),
  ];

  if (messages.length === 1 || messages[messages.length - 1]?.role !== "user") {
    messages.push({ role: "user", content: params.userMessage });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 28_000);

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.25,
        max_tokens: 400,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error("[storefront-chat-assistant] OpenAI HTTP", res.status);
      return null;
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = String(json.choices?.[0]?.message?.content ?? "").trim();
    if (!text.length || text.length > 4000) {
      return null;
    }
    return text;
  } catch (err) {
    console.error("[storefront-chat-assistant] OpenAI error", err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function insertAssistantMessage(
  supabase: SupabaseClient,
  threadId: string,
  body: string,
): Promise<void> {
  const { error } = await supabase.from("storefront_chat_messages").insert({
    thread_id: threadId,
    sender: "staff",
    body,
    staff_identifier: STOREFRONT_CHAT_ASSISTANT_STAFF_ID,
  });
  if (error) {
    console.error("[storefront-chat-assistant] insert failed", error.message);
    return;
  }
  await bumpStorefrontChatThreadUpdatedAt(supabase, threadId);
}

/**
 * FAQ first, then OpenAI with order context. Skips if a human staff member has already replied.
 */
export async function maybeReplyWithStorefrontChatAssistant(
  supabase: SupabaseClient,
  params: { threadId: string; customerEmail: string; guestMessage: string },
): Promise<void> {
  if (!isStorefrontChatAssistantEnabled()) {
    return;
  }

  const guestMessage = params.guestMessage.trim();
  if (!guestMessage.length) {
    return;
  }

  if (await threadHasHumanStaffReply(supabase, params.threadId)) {
    return;
  }

  const customerCtx = await loadStorefrontChatCustomerContext(supabase, params.customerEmail);
  const faqReply = matchStorefrontChatFaq(guestMessage, customerCtx);
  if (faqReply) {
    await insertAssistantMessage(supabase, params.threadId, faqReply);
    return;
  }

  const history = await loadRecentChatHistory(supabase, params.threadId);
  const orderContextText = formatStorefrontChatOrderContextForPrompt(customerCtx);
  const llmReply = await callOpenAiAssistant({
    userMessage: guestMessage,
    history,
    orderContextText,
  });

  await insertAssistantMessage(supabase, params.threadId, llmReply ?? FALLBACK_REPLY);
}
