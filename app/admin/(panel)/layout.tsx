import { AdminNav } from "@/app/components/admin-nav";

/** Admin main: half the storefront row inset (`px-[5cm]` → `2.5cm` each side). */
const ADMIN_PANEL_ROW_CLASS = "mx-auto w-full max-w-none px-[2.5cm]";

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-root-print-shell min-h-screen bg-slate-100 text-slate-900">
      <AdminNav />
      <div className="admin-panel-print-main overflow-x-auto lg:pl-[306px]">
        <div className="admin-panel-print-zoom [zoom:1.3]">
          <div className="admin-panel-print-mobile-banner border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
            <p className="text-sm font-medium text-brand-navy">Admin — use wider screen for full menu</p>
          </div>
          <div className={`admin-panel-print-content-row py-8 ${ADMIN_PANEL_ROW_CLASS}`}>{children}</div>
        </div>
      </div>
    </div>
  );
}
