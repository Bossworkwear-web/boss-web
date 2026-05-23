/** Mirrors column breakpoints in `app/store-ui.css` (`.subcategory-browse-grid-gap`). */
export function categoryBrowseGridColumnCount(): number {
  if (typeof window === "undefined") {
    return 1;
  }
  if (window.matchMedia("(min-width: 640px) and (pointer: coarse)").matches) {
    return 4;
  }
  if (window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)").matches) {
    return 5;
  }
  if (window.matchMedia("(min-width: 640px) and (max-width: 1279px)").matches) {
    return 4;
  }
  if (window.matchMedia("(min-width: 640px)").matches) {
    return 4;
  }
  return 1;
}

const COLUMN_COUNT_MEDIA = [
  "(min-width: 640px) and (pointer: coarse)",
  "(min-width: 1024px) and (hover: hover) and (pointer: fine)",
  "(min-width: 640px) and (max-width: 1279px)",
  "(min-width: 640px)",
] as const;

export function subscribeCategoryBrowseGridColumnCount(onStoreChange: () => void): () => void {
  const mqs = COLUMN_COUNT_MEDIA.map((q) => window.matchMedia(q));
  const notify = () => onStoreChange();
  mqs.forEach((mq) => mq.addEventListener("change", notify));
  window.addEventListener("resize", notify);
  return () => {
    mqs.forEach((mq) => mq.removeEventListener("change", notify));
    window.removeEventListener("resize", notify);
  };
}
