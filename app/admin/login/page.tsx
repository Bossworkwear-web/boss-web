import { AdminLoginForm } from "./login-form";
import { SITE_PAGE_INSET_X_CLASS } from "@/lib/site-layout";

export default function AdminLoginPage() {
  const devHint =
    process.env.NODE_ENV === "development" && !process.env.BOSS_ADMIN_PASSWORD?.trim()
      ? "Local dev: password is dev-admin (set BOSS_ADMIN_PASSWORD to override)."
      : null;

  return (
    <main
      className={`flex min-h-screen flex-col items-center justify-center bg-brand-navy text-white ${SITE_PAGE_INSET_X_CLASS}`}
    >
      <AdminLoginForm devHint={devHint} />
    </main>
  );
}
