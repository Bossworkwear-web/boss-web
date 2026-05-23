export type CyberAssistPageKind = "product" | "category" | "subcategory";

export function cyberAssistPageFromPathname(pathname: string | null): CyberAssistPageKind | null {
  if (!pathname || pathname.startsWith("/admin")) {
    return null;
  }
  if (pathname.startsWith("/products/") && pathname.length > "/products/".length) {
    return "product";
  }
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "categories" && parts.length === 2) {
    return "category";
  }
  if (parts[0] === "categories" && parts.length === 3) {
    return "subcategory";
  }
  return null;
}

export function isCyberAssistPath(pathname: string | null): boolean {
  return cyberAssistPageFromPathname(pathname) != null;
}
