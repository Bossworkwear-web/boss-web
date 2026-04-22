"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

type Props = {
  brands: string[];
};

function normalizeBrandParam(raw: string | null): string {
  return (raw ?? "").trim();
}

function normalizeSortParam(raw: string | null): "" | "price-asc" | "price-desc" {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "price-asc" || v === "price-desc") {
    return v;
  }
  return "";
}

export function CategoryBrandFilter({ brands }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = normalizeBrandParam(searchParams.get("brand"));
  const sort = normalizeSortParam(searchParams.get("sort"));

  const options = useMemo(() => {
    const cleaned = brands.map((b) => b.trim()).filter(Boolean);
    return [...new Set(cleaned)].sort((a, b) => a.localeCompare(b));
  }, [brands]);

  const disabled = options.length === 0;

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex items-center gap-3">
        <label className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-navy/70">
          Brand
        </label>
        <select
          className="min-w-[21rem] rounded-xl border border-brand-navy/20 bg-white px-[1.2rem] py-[0.9rem] text-[1.26rem] text-brand-navy shadow-sm outline-none transition focus:border-brand-orange"
          value={current}
          disabled={disabled}
          onChange={(e) => {
            const next = e.target.value;
            const nextParams = new URLSearchParams(searchParams.toString());
            // Brand selection should reset pagination to page 1.
            nextParams.delete("page");
            if (next) {
              nextParams.set("brand", next);
            } else {
              nextParams.delete("brand");
            }
            if (sort) {
              nextParams.set("sort", sort);
            }
            const qs = nextParams.toString();
            router.push(qs ? `${pathname}?${qs}` : pathname);
          }}
        >
          <option value="">All brands</option>
          {options.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-navy/70">
          Sort
        </label>
        <select
          className="min-w-[14rem] rounded-xl border border-brand-navy/20 bg-white px-[1.2rem] py-[0.9rem] text-[1.26rem] text-brand-navy shadow-sm outline-none transition focus:border-brand-orange"
          value={sort}
          onChange={(e) => {
            const next = normalizeSortParam(e.target.value);
            const nextParams = new URLSearchParams(searchParams.toString());
            // Sort selection should reset pagination to page 1.
            nextParams.delete("page");
            if (next) {
              nextParams.set("sort", next);
            } else {
              nextParams.delete("sort");
            }
            const qs = nextParams.toString();
            router.push(qs ? `${pathname}?${qs}` : pathname);
          }}
        >
          <option value="">Default</option>
          <option value="price-asc">Price: Low → High</option>
          <option value="price-desc">Price: High → Low</option>
        </select>
      </div>
    </div>
  );
}

