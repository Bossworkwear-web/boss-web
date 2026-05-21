import Link from "next/link";

import type { StorefrontNavSub } from "@/lib/catalog";

type Props = {
  mainSlug: string;
  mainLabel: string;
  subs: readonly StorefrontNavSub[];
  /** Set on `/categories/[main]/[sub]`; omit on main category browse. */
  activeSubSlug?: string | null;
};

/**
 * Touch / tablet category browse — desktop uses header hover sub-links (1280px+ fine pointer).
 */
export function CategorySubcategoryPicker({ mainSlug, mainLabel, subs, activeSubSlug }: Props) {
  if (subs.length === 0) {
    return null;
  }

  const allActive = activeSubSlug == null || activeSubSlug === "";

  return (
    <nav className="category-subcategory-picker-shell mb-6" aria-label={`${mainLabel} groupings`}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-brand-navy/70">Shop by type</p>
      <ul className="subcategory-list-grid m-0 list-none p-0">
        <li>
          <Link
            href={`/categories/${mainSlug}`}
            className={`subcategory-list-link text-center font-semibold transition ${
              allActive
                ? "bg-slate-500 text-white"
                : "bg-brand-surface text-brand-navy hover:bg-brand-navy/5"
            }`}
            aria-current={allActive ? "page" : undefined}
          >
            All {mainLabel}
          </Link>
        </li>
        {subs.map((sub) => {
          const active = activeSubSlug === sub.slug;
          return (
            <li key={sub.slug}>
              <Link
                href={`/categories/${mainSlug}/${sub.slug}`}
                className={`subcategory-list-link text-center font-semibold transition ${
                  active
                    ? "bg-slate-500 text-white"
                    : "bg-brand-surface text-brand-navy hover:bg-brand-navy/5"
                }`}
                aria-current={active ? "page" : undefined}
              >
                {sub.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
