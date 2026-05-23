"use client";

import { Children, type ReactNode } from "react";
import { useSyncExternalStore } from "react";

import { CATEGORY_BROWSE_GRID_CLASS } from "@/lib/main-category-browse";
import {
  categoryBrowseGridColumnCount,
  subscribeCategoryBrowseGridColumnCount,
} from "@/lib/category-browse-grid-columns";

/**
 * Category product grid — first row wrapped for cyber-assist highlight (`cat-products`).
 * Uses CSS subgrid so layout matches a single grid while the tour targets row one only.
 * Accepts server-rendered card elements as `children` (no render props across RSC boundary).
 */
export function CategoryBrowseProductsGrid({ children }: { children: ReactNode }) {
  const columnCount = useSyncExternalStore(
    subscribeCategoryBrowseGridColumnCount,
    categoryBrowseGridColumnCount,
    () => 1,
  );
  const cards = Children.toArray(children);
  const firstRowCount = Math.min(columnCount, cards.length);
  const firstRow = cards.slice(0, firstRowCount);
  const rest = cards.slice(firstRowCount);

  return (
    <div className={CATEGORY_BROWSE_GRID_CLASS}>
      {firstRow.length > 0 ? (
        <div data-cyber-guide="cat-products" className="category-browse-grid-first-row">
          {firstRow}
        </div>
      ) : null}
      {rest}
    </div>
  );
}
