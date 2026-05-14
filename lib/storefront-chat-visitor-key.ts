const VISITOR_KEY_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidStorefrontChatVisitorKey(raw: string): boolean {
  return VISITOR_KEY_RE.test(String(raw ?? "").trim());
}
