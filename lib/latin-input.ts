/**
 * Input filters: block non-Latin scripts (e.g. Korean, Chinese, Cyrillic).
 * ASCII letters, digits, and field-appropriate symbols remain allowed.
 */

export type LatinInputMode =
  | "letters"
  | "email"
  | "password"
  | "tel"
  | "number"
  | "address"
  | "ascii";

const LETTER_RE = /[^a-zA-Z\s'.-]/g;
const EMAIL_RE = /[^a-zA-Z0-9@._%+\-]/g;
const PASSWORD_RE = /[^\x20-\x7E]/g;
const TEL_RE = /[^0-9+()\-.\s]/g;
const NUMBER_RE = /[^0-9]/g;
const ADDRESS_RE = /[^a-zA-Z0-9\s,.'\-/#]/g;
/** General text: printable ASCII only (blocks Hangul, CJK, etc.). */
const ASCII_RE = /[^\x20-\x7E]/g;

export function sanitizeLatinInput(value: string, mode: LatinInputMode): string {
  switch (mode) {
    case "letters":
      return value.replace(LETTER_RE, "");
    case "email":
      return value.replace(EMAIL_RE, "");
    case "password":
      return value.replace(PASSWORD_RE, "");
    case "tel":
      return value.replace(TEL_RE, "");
    case "number":
      return value.replace(NUMBER_RE, "");
    case "address":
      return value.replace(ADDRESS_RE, "");
    case "ascii":
      return value.replace(ASCII_RE, "");
    default:
      return value.replace(LETTER_RE, "");
  }
}

export function detectLatinInputMode(el: HTMLInputElement | HTMLTextAreaElement): LatinInputMode {
  if (el instanceof HTMLTextAreaElement) {
    return "ascii";
  }

  const type = el.type.toLowerCase();
  if (type === "email") return "email";
  if (type === "password") return "password";
  if (type === "tel") return "tel";
  if (type === "number") return "number";

  const key = `${el.name} ${el.id} ${el.getAttribute("autocomplete") ?? ""}`.toLowerCase();

  if (key.includes("email")) return "email";
  if (key.includes("password")) return "password";
  if (
    key.includes("phone") ||
    key.includes("contact") ||
    key.includes("mobile") ||
    key.includes("tel")
  ) {
    return "tel";
  }
  if (key.includes("postcode") || key.includes("zip")) return "number";
  if (
    key.includes("address") ||
    key.includes("suburb") ||
    key.includes("organisation") ||
    key.includes("organization") ||
    key.includes("street") ||
    key.includes("city")
  ) {
    return "address";
  }
  if (
    key.includes("name") ||
    key.includes("surname") ||
    key.includes("state") ||
    key.includes("country") ||
    key.includes("given") ||
    key.includes("family")
  ) {
    return "letters";
  }

  if (type === "search" || type === "url") return "ascii";

  return "letters";
}

export function isLatinInputGuardDisabled(el: Element): boolean {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    return true;
  }
  if (el instanceof HTMLInputElement) {
    const type = el.type.toLowerCase();
    if (type === "hidden" || type === "file" || type === "checkbox" || type === "radio" || type === "submit" || type === "button") {
      return true;
    }
  }
  if (el.closest("[data-latin-input=off]")) {
    return true;
  }
  if (el.getAttribute("data-latin-input") === "off") {
    return true;
  }
  return false;
}
