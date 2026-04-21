import { SITE_PAGE_INNER_SHELL_CLASS } from "@/lib/site-layout";

const sectionHeadingClass =
  "text-center text-[1.95rem] font-medium leading-tight text-brand-navy sm:text-[2.34rem] lg:text-[2.86rem]";

/**
 * Brand story under the home hero — mission, services, philosophy, vision, tagline.
 */
export function HomeCompanyIntro() {
  return (
    <section aria-label="About Boss Workwear" className="border-t border-brand-navy/[0.08] bg-brand-surface/60">
      <div className={`${SITE_PAGE_INNER_SHELL_CLASS} py-12 sm:py-16`}>
        <header className="text-center">
          <h2 className="text-[2.4375rem] font-medium leading-tight text-brand-navy sm:text-[2.925rem] lg:text-[3.575rem]">
            Built for Work. Designed to Lead.
          </h2>
        </header>

        <div className="mx-auto mt-10 max-w-[62.4rem] space-y-12 text-brand-navy/90">
          <div className="space-y-4 text-center text-[1.3rem] leading-relaxed sm:text-[1.4625rem]">
            <p>
              Founded in 2008, we are more than a uniform supplier — we are a brand that powers industries.
            </p>
            <p>
              We provide high-performance workwear that represents strength, professionalism, and identity
              across every sector.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className={sectionHeadingClass}>What We Do</h3>
            <div className="space-y-4 text-center text-[1.3rem] leading-relaxed sm:text-[1.4625rem]">
              <p>
                From construction sites to corporate teams, we deliver uniforms that are built to perform. Our
                in-house embroidery and printing services ensure every piece carries your brand with precision
                and impact.
              </p>
              <p className="font-medium text-brand-navy">
                We don&apos;t just supply uniforms — we build presence.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className={sectionHeadingClass}>Our Philosophy</h3>
            <div className="space-y-3 text-center text-[1.3rem] leading-relaxed sm:text-[1.4625rem]">
              <p>Workwear is not just worn.</p>
              <p className="text-[1.625rem] font-medium text-brand-navy sm:text-[1.95rem]">It speaks.</p>
              <p>
                It represents your people, your standards, and your reputation. That&apos;s why we focus on
                durability, detail, and design that commands respect.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className={sectionHeadingClass}>Our Vision</h3>
            <p className="text-center text-[1.3rem] leading-relaxed sm:text-[1.4625rem]">
              We aim to grow with our clients — not as a supplier, but as a long-term partner. As your business
              evolves, we evolve with you.
            </p>
          </div>
        </div>

        <p className="mx-auto mt-14 max-w-[62.4rem] border-t border-brand-navy/10 pt-10 text-center text-[1.4625rem] font-semibold text-brand-navy sm:text-[1.625rem]">
          Boss Workwear — Wear Your Standard.
        </p>
      </div>
    </section>
  );
}
