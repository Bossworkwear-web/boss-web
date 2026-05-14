import Link from "next/link";

const TABS = [
  { href: "/admin/warehouse", label: "Overview", labelKorean: "개요" },
  { href: "/admin/warehouse/manager", label: "Manager", labelKorean: "매니저" },
  { href: "/admin/warehouse/worker", label: "Worker", labelKorean: "작업자" },
] as const;

export default function WarehouseSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-8">
      <nav aria-label="Warehouse sections" className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-brand-navy shadow-sm transition hover:border-brand-orange/50 hover:bg-brand-orange/5"
          >
            <span className="text-brand-orange">{tab.labelKorean}</span>
            <span className="ml-1.5 text-slate-500">({tab.label})</span>
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
