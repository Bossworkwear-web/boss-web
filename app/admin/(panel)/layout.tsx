import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AdminNav } from "@/app/components/admin-nav";
import { ADMIN_PATHNAME_HEADER } from "@/lib/admin-constants";
import { assertAdminPortalPath, assertAdminSession, resolveAdminPortalNavAccess } from "@/lib/admin-auth";

/** Admin routes need Supabase at render time; skip static prerender so `next build` succeeds without build-time env. */
export const dynamic = "force-dynamic";

/** Admin main: half the storefront row inset (`px-[5cm]` → `2.5cm` each side). */
const ADMIN_PANEL_ROW_CLASS = "mx-auto w-full max-w-none px-[2.5cm]";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  try {
    await assertAdminSession();
  } catch {
    redirect("/admin/login");
  }

  const pathname = (await headers()).get(ADMIN_PATHNAME_HEADER) ?? "";
  const portalAccess = await resolveAdminPortalNavAccess();
  await assertAdminPortalPath(pathname, portalAccess);

  return (
    <div className="admin-root-print-shell min-h-screen bg-slate-100 text-slate-900">
      <AdminNav portalAccess={portalAccess} />
      <div className="admin-panel-print-main overflow-x-auto lg:pl-[306px]">
        <div className="admin-panel-print-zoom">
          <div className="admin-panel-print-mobile-banner border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
            <p className="text-sm font-medium text-brand-navy">Admin — use wider screen for full menu</p>
          </div>
          <div className={`admin-panel-print-content-row py-8 ${ADMIN_PANEL_ROW_CLASS}`}>{children}</div>
        </div>
      </div>
    </div>
  );
}
