import Image from "next/image";
import Link from "next/link";

import { ArrowRightIcon } from "@/app/components/icons";
import { MAIN_CATEGORIES } from "@/lib/catalog";
import { SITE_PAGE_INNER_SHELL_CLASS } from "@/lib/site-layout";

/** Hero/top banner images — same assets as `*CategoryTopAd` on `/categories/[slug]`. */
const MAIN_CATEGORY_IMAGE_MAP: Record<string, string> = {
  workwear: "/Ad_workwear.png",
  mens: "/Ad_men's.png",
  womens: "/Ad_women's.png",
  kids: "/Ad_kid's.png",
  "health-care": "/Ad_Health%20care%20.png",
  chef: "/Ad_chef.png",
  ppe: "/Ad_PPE.png",
};

/** Home category grid — matches `/service` imagery. */
const IN_STORE_SERVICE_CARD_IMAGE = "/service_Emb.jpg";

function CategoryPromoImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative h-[6.545rem] w-full overflow-hidden">
      <Image src={src} alt={alt} fill className="object-cover object-center" sizes="(max-width: 640px) 100vw, 25vw" />
      <div className="absolute inset-0 bg-brand-navy/20" aria-hidden />
    </div>
  );
}

/** Static "Shop by Category" grid for the home page — no product catalog fetch. */
export function HomeShopByCategory() {
  return (
    <section id="shop-categories" className={`${SITE_PAGE_INNER_SHELL_CLASS} py-12`}>
      <div className="min-w-0">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[1.4625rem] font-semibold uppercase tracking-[0.12em] text-brand-navy/70">
              Featured Range
            </p>
            <h2 className="text-[3.65625rem] font-medium leading-tight">Shop by Category</h2>
          </div>
          <p className="text-[1.70625rem] font-semibold text-brand-orange sm:text-right">
            {MAIN_CATEGORIES.length + 1} categories
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {MAIN_CATEGORIES.map((main) => {
            const imageSrc = MAIN_CATEGORY_IMAGE_MAP[main.slug] ?? MAIN_CATEGORY_IMAGE_MAP.workwear;
            return (
              <article
                key={main.slug}
                className="group overflow-hidden rounded-2xl border border-brand-navy/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <CategoryPromoImage src={imageSrc} alt={`${main.label} category`} />

                <div className="flex flex-row items-center justify-between gap-[0.357rem] p-[1.624rem] sm:gap-[0.476rem]">
                  <p className="min-w-0 flex-1 truncate text-left text-[1.638rem] font-semibold uppercase leading-snug tracking-[0.1em] text-brand-navy/65">
                    {main.label}
                  </p>
                  <Link
                    href={`/categories/${main.slug}`}
                    className="inline-flex shrink-0 items-center gap-[0.2796rem] rounded-lg border border-brand-navy/20 px-[1.0483rem] py-[0.5242rem] text-[1.223rem] font-semibold leading-none transition group-hover:border-brand-orange group-hover:text-brand-orange"
                  >
                    Select
                    <ArrowRightIcon className="h-[1.223rem] w-[1.223rem] shrink-0" />
                  </Link>
                </div>
              </article>
            );
          })}
          <article className="group overflow-hidden rounded-2xl border border-brand-navy/10 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
            <CategoryPromoImage src={IN_STORE_SERVICE_CARD_IMAGE} alt="In-store service" />

            <div className="flex flex-row items-center justify-between gap-[0.357rem] p-[1.624rem] sm:gap-[0.476rem]">
              <p className="min-w-0 flex-1 truncate text-left text-[1.638rem] font-semibold uppercase leading-snug tracking-[0.1em] text-brand-navy/65">
                In Store Service
              </p>
              <Link
                href="/service"
                className="inline-flex shrink-0 items-center gap-[0.2796rem] rounded-lg border border-brand-navy/20 px-[1.0483rem] py-[0.5242rem] text-[1.223rem] font-semibold leading-none transition group-hover:border-brand-orange group-hover:text-brand-orange"
              >
                Select
                <ArrowRightIcon className="h-[1.223rem] w-[1.223rem] shrink-0" />
              </Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
