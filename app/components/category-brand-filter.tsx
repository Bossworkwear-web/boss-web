"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";

type Props = {
  brands: string[];
};

function normalizeBrandParam(raw: string | null): string {
  return (raw ?? "").trim();
}

export function CategoryBrandFilter({ brands }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = normalizeBrandParam(searchParams.get("brand"));

  const options = useMemo(() => {
    const cleaned = brands.map((b) => b.trim()).filter(Boolean);
    return [...new Set(cleaned)].sort((a, b) => a.localeCompare(b));
  }, [brands]);

  const disabled = options.length === 0;

  return (
    <div className="flex items-center gap-3">
      <label className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-navy/70">
        Brand
      </label>
      <select
        className="min-w-[21rem] rounded-xl border border-brand-navy/20 bg-white px-4 py-3 text-[1.05rem] text-brand-navy shadow-sm outline-none transition focus:border-brand-orange"
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
  );
}

