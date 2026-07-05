import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { CustomerDetailsSavedNotice } from "@/app/components/customer-details-saved-notice";
import { HomeCompanyIntro } from "@/app/components/home-company-intro";
import { HomeHero } from "@/app/components/home-hero";
import { HomeShopByCategory } from "@/app/components/home-shop-by-category";
import { TopNav } from "@/app/components/top-nav";
import { MainWithSupplierRail } from "@/app/components/supplier-ad-banner";

/** Static home shell; category links only (no full-catalog SSR). */
export const revalidate = 3600;

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <Suspense fallback={null}>
        <CustomerDetailsSavedNotice />
      </Suspense>
      <MainWithSupplierRail>
        <TopNav />
        <HomeHero />
        <HomeCompanyIntro />
        <section className="bg-white pt-[1.5cm]">
          <div className="mx-auto flex w-full max-w-[2614px] flex-col items-center px-4 pb-2 sm:px-6">
            <Image
              src="/BossWW_image.jpg"
              alt="Boss WW"
              width={400}
              height={400}
              className="h-[7cm] w-[7cm] rounded-2xl object-cover"
              priority
              sizes="280px"
            />
            <Image
              src="/supplier_logo_1.jpg"
              alt="Supplier logo"
              width={1200}
              height={200}
              className="mt-[1.5cm] h-auto w-[21cm] max-w-full object-contain"
              sizes="(max-width: 768px) 100vw, 794px"
            />
          </div>
        </section>
        <HomeShopByCategory />
      </MainWithSupplierRail>
    </main>
  );
}
