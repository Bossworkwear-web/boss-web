import type { StorefrontChatCustomerContext } from "@/lib/storefront-chat-order-context";
import { getSiteUrl } from "@/lib/site-url";

type FaqMatcher = {
  id: string;
  test: (text: string) => boolean;
  reply: (ctx: StorefrontChatCustomerContext) => string;
};

function hasAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

function buildMatchers(site: string): FaqMatcher[] {
  const customer = `${site}/customer`;
  const login = `${site}/log-in`;
  const contact = `${site}/contact-us`;

  return [
    {
      id: "delivery",
      test: (t) =>
        hasAny(t, [
          /\bdeliver(y|ies|ed)?\b/i,
          /\bwhen\b.*\b(arrive|coming|here)\b/i,
          /\btrack(ing)?\b/i,
          /\bshipp?(ed|ing)?\b/i,
          /\bdispatch(ed)?\b/i,
          /\bestimated\b.*\btime\b/i,
          /\bhow long\b.*\b(take|arrive)\b/i,
        ]),
      reply: (ctx) => {
        if (ctx.orders.length > 0) {
          const o = ctx.orders[0]!;
          return [
            "After you place an order, delivery updates are shown in My account and on each order’s Track page.",
            "",
            `Open My account: ${ctx.my_account_url}`,
            `Your latest order (${o.order_number}) — status: ${o.status}. ${o.delivery_summary}`,
            o.track_url ? `Track this order: ${o.track_url}` : "",
            "",
            "Timelines update as we process, dispatch, and hand off to the carrier.",
          ]
            .filter(Boolean)
            .join("\n");
        }
        return [
          "Once you have placed an order, sign in and open My account — each order has a Track link where your expected delivery timeline is updated.",
          "",
          `My account: ${customer}`,
        ].join("\n");
      },
    },
    {
      id: "quote",
      test: (t) =>
        hasAny(t, [
          /\bquote\b/i,
          /\bbulk\b/i,
          /\bdecoration\b/i,
          /\blogo\b/i,
          /\bembroid/i,
          /\bpric(e|ing)\b.*\bquote\b/i,
        ]),
      reply: () =>
        [
          "For bulk orders, decoration, or pricing before you choose a product, use Email for a free quote on any category page, or contact us:",
          "",
          contact,
        ].join("\n"),
    },
    {
      id: "refund",
      test: (t) => hasAny(t, [/\brefund\b/i, /\breturn\b/i, /\bcancel(l)?ed?\b/i]),
      reply: () =>
        "For refunds or order changes, tell us your order number in this chat and our team will help. You can also reach us via Contact us on the website — a staff member will confirm policy and next steps.",
    },
    {
      id: "account",
      test: (t) =>
        hasAny(t, [
          /\bmy account\b/i,
          /\bsign[\s-]?in\b/i,
          /\blog[\s-]?in\b/i,
          /\bpassword\b/i,
          /\border history\b/i,
        ]),
      reply: (ctx) =>
        [
          "Sign in to view orders, invoices, and tracking:",
          "",
          `My account: ${customer}`,
          `Sign in: ${login}`,
          ctx.orders.length > 0
            ? `You have ${ctx.orders.length} recent order(s) on file under this email.`
            : "If you have not ordered yet, complete checkout while signed in so orders appear here.",
        ].join("\n"),
    },
    {
      id: "payment",
      test: (t) => hasAny(t, [/\bpay\b/i, /\bpayment\b/i, /\bcheckout\b/i, /\bstripe\b/i, /\bcard\b/i]),
      reply: () =>
        "Checkout is completed securely online. If payment fails, try another card or contact us with the error message — our team can help complete your order.",
    },
    {
      id: "invoice",
      test: (t) => hasAny(t, [/\binvoice\b/i, /\breceipt\b/i, /\btax\b/i]),
      reply: (ctx) =>
        [
          "Invoices for completed orders are available from My account when your order is ready (Download on the order row).",
          "",
          `My account: ${ctx.my_account_url}`,
        ].join("\n"),
    },
    {
      id: "contact",
      test: (t) =>
        hasAny(t, [/\bcontact\b/i, /\bphone\b/i, /\bcall\b/i, /\bemail\b/i, /\bhours\b/i, /\bhuman\b/i, /\bstaff\b/i]),
      reply: () =>
        [
          "You can reach Boss Workwear via Contact us on the site. Messages in this chat are also seen by our team — a person will follow up when needed.",
          "",
          contact,
        ].join("\n"),
    },
  ];
}

export function matchStorefrontChatFaq(
  userMessage: string,
  ctx: StorefrontChatCustomerContext,
): string | null {
  const text = userMessage.trim();
  if (!text.length) {
    return null;
  }
  const site = getSiteUrl();
  const matchers = buildMatchers(site);
  for (const m of matchers) {
    if (m.test(text)) {
      return m.reply(ctx);
    }
  }
  return null;
}
