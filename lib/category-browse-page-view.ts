import { compareCategoryBrowseDefaultSort, sortCategoryBrowseDefault } from "@/lib/category-browse-sort";
import { inferCategoryBrowseBrandLabel } from "@/lib/category-browse-brand-label";
import { isBizCollectionListing } from "@/lib/fashion-biz-gender-route";
import {
  CATEGORY_BROWSE_PAGE_SIZE,
  filterProductsForMainCategoryBrowse,
  filterProductsForSubCategoryBrowse,
  type CategoryBrowseProductRow,
} from "@/lib/main-category-browse";
import { storefrontRetailFromSupplierBase, storefrontRetailProductMetaFromRow } from "@/lib/product-price";
import { resolveProductSubSlug } from "@/lib/product-subslug";
import {
  isAussiePacificCatalogListing,
  isJbWearSixSeriesListing,
  isJbWorkwearExcludedHeadwearOrSocks,
} from "@/lib/product-visibility";
import {
  filterWorkwearExclusiveMainBrowseRows,
  isWorkwearExclusiveBrandRow,
} from "@/lib/workwear-exclusive-main-browse";

export type CategoryBrowseSortParam = "" | "price-asc" | "price-desc";

export type CategoryBrowsePageView = {
  pageItems: CategoryBrowseProductRow[];
  brandsForDropdown: string[];
  brandParamEffective: string;
  sortEffective: CategoryBrowseSortParam;
  currentPage: number;
  totalPages: number;
  pageWindow: number[];
  sortedCount: number;
  catalogHasMappedProducts: boolean;
};

function normalizeSortParam(raw: string | null | undefined): CategoryBrowseSortParam {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "price-asc" || v === "price-desc") {
    return v;
  }
  return "";
}

function jbLooksHiVis(item: {
  name: string;
  slug?: string | null;
  category?: string | null;
  description?: string | null;
}): boolean {
  const hay = `${item.name} ${item.slug ?? ""} ${item.category ?? ""} ${item.description ?? ""}`.toLowerCase();
  return /\bhv\b/.test(hay) || /\bhi[\s-]*vis\b/.test(hay) || /\bhigh[\s-]*vis\b/.test(hay);
}

function applyBrandFilter(
  mainSlug: string,
  rows: CategoryBrowseProductRow[],
  brandParamEffective: string,
): CategoryBrowseProductRow[] {
  if (!brandParamEffective) {
    return rows;
  }
  return rows.filter((item) => {
    if (inferCategoryBrowseBrandLabel(item) !== brandParamEffective) {
      return false;
    }
    if (mainSlug === "workwear" && brandParamEffective === "JB's Wear") {
      if (isJbWorkwearExcludedHeadwearOrSocks(item.name, { category: item.category ?? null })) {
        return false;
      }
      return isJbWearSixSeriesListing(item.name, {
        slug: item.slug ?? null,
        supplier_name: item.supplier_name ?? null,
      });
    }
    return true;
  });
}

function applySort(
  mainSlug: string,
  rows: CategoryBrowseProductRow[],
  sortEffective: CategoryBrowseSortParam,
  subSlug?: string,
): CategoryBrowseProductRow[] {
  if (!sortEffective) {
    return rows;
  }
  return [...rows].sort((a, b) => {
    const ap =
      storefrontRetailFromSupplierBase(a.base_price, storefrontRetailProductMetaFromRow(a)) ??
      Number.POSITIVE_INFINITY;
    const bp =
      storefrontRetailFromSupplierBase(b.base_price, storefrontRetailProductMetaFromRow(b)) ??
      Number.POSITIVE_INFINITY;
    if (ap !== bp) {
      return sortEffective === "price-asc" ? ap - bp : bp - ap;
    }
    return compareCategoryBrowseDefaultSort(mainSlug, a, b, inferCategoryBrowseBrandLabel, subSlug);
  });
}

function paginateBrowseRows(
  rows: CategoryBrowseProductRow[],
  pageParam: string | null | undefined,
): Pick<CategoryBrowsePageView, "pageItems" | "currentPage" | "totalPages" | "pageWindow" | "sortedCount"> {
  const parsed = Number.parseInt(String(pageParam ?? "1"), 10);
  const requestedPage = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
  const totalPages = Math.max(1, Math.ceil(rows.length / CATEGORY_BROWSE_PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const offset = (currentPage - 1) * CATEGORY_BROWSE_PAGE_SIZE;
  const pageItems = rows.slice(offset, offset + CATEGORY_BROWSE_PAGE_SIZE);

  const maxButtons = 5;
  const count = Math.min(totalPages, maxButtons);
  const half = Math.floor(count / 2);
  let start = Math.max(1, currentPage - half);
  let end = start + count - 1;
  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - count + 1);
  }
  const pageWindow = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return { pageItems, currentPage, totalPages, pageWindow, sortedCount: rows.length };
}

function brandsFromRows(mainSlug: string, rows: CategoryBrowseProductRow[]): string[] {
  const fromRows = new Set(rows.map((r) => inferCategoryBrowseBrandLabel(r)).filter((s) => s.length > 0));
  if (mainSlug === "workwear") {
    fromRows.add("JB's Wear");
  }
  return [...fromRows].sort((a, b) => a.localeCompare(b));
}

export function catalogHasMappedBrowseProducts(rows: CategoryBrowseProductRow[]): boolean {
  return rows.some(
    (item) => resolveProductSubSlug(item.name, item.category, item.slug, item.description) != null,
  );
}

export function buildMainCategoryBrowsePageView(
  mainSlug: string,
  catalogRows: CategoryBrowseProductRow[],
  options: {
    brandParam?: string | null;
    sortParam?: string | null;
    pageParam?: string | null;
  },
): CategoryBrowsePageView {
  const baseRows = (
    mainSlug === "workwear"
      ? filterWorkwearExclusiveMainBrowseRows(catalogRows)
      : filterProductsForMainCategoryBrowse(mainSlug, catalogRows)
  ).filter((item) => mainSlug === "workwear" || !isWorkwearExclusiveBrandRow(item));

  const filteredAllBrands = sortCategoryBrowseDefault(mainSlug, baseRows, inferCategoryBrowseBrandLabel);
  const brandsForDropdown = brandsFromRows(mainSlug, filteredAllBrands);

  const brandParam = String(options.brandParam ?? "").trim();
  const brandParamEffective =
    brandParam.length > 0 && brandsForDropdown.includes(brandParam) ? brandParam : "";

  const brandFiltered = applyBrandFilter(mainSlug, filteredAllBrands, brandParamEffective);
  const sortEffective = normalizeSortParam(options.sortParam);
  const sorted = applySort(mainSlug, brandFiltered, sortEffective);
  const page = paginateBrowseRows(sorted, options.pageParam);

  return {
    ...page,
    brandsForDropdown,
    brandParamEffective,
    sortEffective,
    catalogHasMappedProducts: catalogHasMappedBrowseProducts(catalogRows),
  };
}

export function buildSubCategoryBrowsePageView(
  mainSlug: string,
  subSlug: string,
  catalogRows: CategoryBrowseProductRow[],
  options: {
    brandParam?: string | null;
    sortParam?: string | null;
    pageParam?: string | null;
  },
): CategoryBrowsePageView {
  const subCategoryRows = filterProductsForSubCategoryBrowse(mainSlug, subSlug, catalogRows).filter((item) => {
    if (mainSlug === "workwear") {
      if (isBizCollectionListing(item.name, item.slug ?? null, item.category ?? null)) {
        return false;
      }
      if (
        isAussiePacificCatalogListing(item.name, {
          slug: item.slug ?? null,
          supplier_name: item.supplier_name ?? null,
        })
      ) {
        return false;
      }
      const b = inferCategoryBrowseBrandLabel(item).toLowerCase();
      if (b === "jb's wear") {
        if (isJbWorkwearExcludedHeadwearOrSocks(item.name, { category: item.category ?? null })) {
          return false;
        }
        return (
          isJbWearSixSeriesListing(item.name, {
            slug: item.slug ?? null,
            supplier_name: item.supplier_name ?? null,
          }) || jbLooksHiVis(item)
        );
      }
      return true;
    }
    const sn = String(item.supplier_name ?? "").trim().toLowerCase();
    if (sn === "bisley" || sn === "syzmik") {
      return false;
    }
    const hay = `${item.name} ${item.slug ?? ""}`.toLowerCase();
    return !(hay.includes("bisley") || hay.includes("syzmik"));
  });

  const filteredAllBrands = sortCategoryBrowseDefault(
    mainSlug,
    subCategoryRows,
    inferCategoryBrowseBrandLabel,
    subSlug,
  );
  const brandsForDropdown = brandsFromRows(mainSlug, filteredAllBrands);

  const brandParam = String(options.brandParam ?? "").trim();
  const brandParamEffective =
    brandParam.length > 0 && brandsForDropdown.includes(brandParam) ? brandParam : "";

  const brandFiltered = applyBrandFilter(mainSlug, filteredAllBrands, brandParamEffective);
  const sortEffective = normalizeSortParam(options.sortParam);
  const sorted = applySort(mainSlug, brandFiltered, sortEffective, subSlug);
  const page = paginateBrowseRows(sorted, options.pageParam);

  return {
    ...page,
    brandsForDropdown,
    brandParamEffective,
    sortEffective,
    catalogHasMappedProducts: catalogHasMappedBrowseProducts(catalogRows),
  };
}

export function categoryBrowsePageHref(
  basePath: string,
  page: number,
  brand?: string,
  sort?: string,
): string {
  const params = new URLSearchParams();
  const b = String(brand ?? "").trim();
  if (b) {
    params.set("brand", b);
  }
  const s = String(sort ?? "").trim();
  if (s) {
    params.set("sort", s);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
