/**
 * Fixed C91 PDP gallery order (Yellow front → Yellow vent → Yellow model →
 * Orange front → Orange vent → Back vent). Drops duplicate supplier orange fronts.
 */
export function orderBwC91GalleryImageUrls(urls: readonly string[]): string[] {
  const list = urls.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean);

  const fileOf = (u: string) => {
    const tail = u.split("/").pop() ?? u;
    try {
      return decodeURIComponent(tail.split("?")[0] ?? tail);
    } catch {
      return tail;
    }
  };

  const isPublic = (u: string, name: string) =>
    new RegExp(`(?:^|/)${name}\\.(png|jpe?g|webp)(?:\\?|#|$)`, "i").test(u);

  const yellowFront =
    list.find((u) => isPublic(u, "C91_Yellow")) ?? "/C91_Yellow.png";
  const orangeFront =
    list.find((u) => isPublic(u, "C91_Orange") && !isPublic(u, "C91_Orange_2")) ??
    "/C91_Orange.png";
  const orangeVent =
    list.find((u) => isPublic(u, "C91_Orange_2")) ?? "/C91_Orange_2.png";

  const yellowVent = list.find((u) => {
    const f = fileOf(u);
    return /yellow/i.test(f) && /\bvent\b/i.test(f) && !isPublic(u, "C91_Yellow");
  });

  const yellowModel = list.find((u) => {
    const f = fileOf(u);
    if (isPublic(u, "C91_Yellow")) return false;
    if (yellowVent && u === yellowVent) return false;
    return /\bfyn\b/i.test(f) || /\bmodel\b/i.test(f) || /\btalent\b/i.test(f);
  });

  const backVent = list.find((u) => {
    const f = fileOf(u);
    if (isPublic(u, "C91_Orange_2")) return false;
    return /\bback\b/i.test(f) && /\bvent\b/i.test(f);
  });

  const ordered = [
    yellowFront,
    ...(yellowVent ? [yellowVent] : []),
    ...(yellowModel ? [yellowModel] : []),
    orangeFront,
    orangeVent,
    ...(backVent ? [backVent] : []),
  ];

  const seen = new Set<string>();
  return ordered.filter((u) => {
    if (seen.has(u)) return false;
    seen.add(u);
    return true;
  });
}
