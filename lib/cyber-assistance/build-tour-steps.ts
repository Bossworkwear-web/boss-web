import type { DriveStep } from "driver.js";

import { buildMainCategoryTourSteps, buildSubcategoryTourSteps } from "@/lib/cyber-assistance/category-browse-tour";
import { cyberAssistPageFromPathname, type CyberAssistPageKind } from "@/lib/cyber-assistance/page-context";
import { buildProductPdpTourSteps } from "@/lib/cyber-assistance/product-pdp-tour";

export function buildCyberAssistTourSteps(pathname: string | null): DriveStep[] {
  const kind = cyberAssistPageFromPathname(pathname);
  switch (kind) {
    case "product":
      return buildProductPdpTourSteps();
    case "category":
      return buildMainCategoryTourSteps();
    case "subcategory":
      return buildSubcategoryTourSteps();
    default:
      return [];
  }
}

export function cyberAssistPageLabel(kind: CyberAssistPageKind | null): string {
  switch (kind) {
    case "product":
      return "product page";
    case "category":
      return "category";
    case "subcategory":
      return "subcategory";
    default:
      return "page";
  }
}
