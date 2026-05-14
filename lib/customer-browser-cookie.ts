/** Read a non-httpOnly cookie set by the storefront (e.g. after customer log-in). */
export function getBrowserCookie(name: string): string {
  if (typeof document === "undefined") {
    return "";
  }
  const key = `${name}=`;
  const found = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(key));
  return found ? decodeURIComponent(found.slice(key.length)) : "";
}
