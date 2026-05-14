import type { Metadata } from "next";
import Link from "next/link";

import { MainWithSupplierRail } from "@/app/components/supplier-ad-banner";
import { TopNav } from "@/app/components/top-nav";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";
import { STOREFRONT_QUOTE_EMAIL_RECIPIENT } from "@/lib/storefront-quote-mailto";

export const metadata: Metadata = {
  title: "Returns Policy",
};

const returnRequestMailto = `mailto:${STOREFRONT_QUOTE_EMAIL_RECIPIENT}?subject=${encodeURIComponent("Return request")}`;

export default function ReturnsPolicyPage() {
  return (
    <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <TopNav />
      <MainWithSupplierRail>
        <section className={`${SITE_PAGE_ROW_CLASS} max-w-4xl py-10`}>
          <h1 className="mb-6 text-3xl font-medium">Returns Policy</h1>

          <div className="prose prose-sm max-w-none space-y-6 text-sm leading-relaxed text-brand-navy/90 [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-brand-navy [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-brand-navy [&_strong]:text-brand-navy [&_ul]:my-3 [&_ul]:list-none [&_ul]:space-y-2 [&_ul]:pl-0 [&_li]:pl-0">
            <h2>1. Cancellations</h2>
            <h3>1.1 Refund eligibility</h3>
            <p>Orders are not eligible for a 100% refund after cancellation.</p>
            <h3>1.2 Deductions from refunds</h3>
            <p>
              Any refund issued will be subject to deductions for processing surcharges, handling fees, and
              suppliers&apos; restocking fees incurred at each stage of the process.
            </p>

            <h2>2. Returns and refunds</h2>

            <h3>2.1 Refunds after order delivery</h3>
            <p>
              Refunds after order delivery are only available in cases of major product faults, defects, or where the
              delivered items differ from the order specifications. Returns based solely on product colour, fabric
              material, or personal preference will not be accepted.
            </p>
            <p>
              Please note that actual products, mock-ups, print colours, and sample embroidery may vary from what is
              shown on screens, photos, or videos. Customers are advised to review product specifications carefully before
              placing an order. If you are entitled to a refund, we will only give you the refund once we have received
              the product and inspected it and assessed whether it is eligible for a refund under these Conditions of
              Sale. Any refund we make will be by the same payment method used to purchase the product.
            </p>

            <h3>2.2 All goods must be returned to us</h3>
            <p>
              All goods must be returned to us at your cost but it will be refunded once we have tested the item and
              the fault has been verified.
            </p>

            <h3>2.3 Wrong, damaged, defective, or not as described</h3>
            <p>
              If you receive a wrong, damaged, defective item or the item is not as described, you can request returns and
              refunds when all the provisions below are met. When all the provisions below are met, we will issue a
              replacement, or if you prefer a full or partial refund of your purchase price, including your shipping
              cost.
            </p>
            <ul>
              <li>
                <strong>a.</strong> Only within 30 DAYS of invoice
              </li>
              <li>
                <strong>b.</strong> Only if the product is intact, unused and in its original packaging
              </li>
              <li>
                <strong>c.</strong> Only when accompanied by a valid tax invoice
              </li>
            </ul>

            <h3>2.4 Packaging your return</h3>
            <p>When you return the items to us, please ensure the goods are returned:</p>
            <ul>
              <li>
                <strong>a.</strong> In the original packaging including any manuals and accessories
              </li>
              <li>
                <strong>b.</strong> The item must be in the same condition that it was supplied
              </li>
              <li>
                <strong>c.</strong> NO shipping labels are fixed directly to the packaging but on the outside of the
                wrapped item
              </li>
              <li>
                <strong>d.</strong> It must be adequately packaged to ensure that it is not damaged during return delivery
                to us.
              </li>
            </ul>

            <h3>2.5 Refunds may incur fees</h3>
            <p>Refunds may incur fees.</p>

            <h2>3. How to request a Return</h2>
            <p>
              If you wish to return a product, you will need to complete and send the Return Request Form to{" "}
              <a
                href={returnRequestMailto}
                className="font-semibold text-brand-orange underline-offset-2 hover:underline"
              >
                {STOREFRONT_QUOTE_EMAIL_RECIPIENT}
              </a>
              .
            </p>

            <h3>3.1 Return request confirmation</h3>
            <p>
              Once your return request has been processed, you will receive an email with return request number and our
              return instructions. Any items sent without the process above will not be processed and returned to the
              customer.
            </p>

            <h3>3.2 Courier or collection</h3>
            <p>
              You may choose one courier company from those listed in the return instructions to return your item by
              yourself, or you can ask us to arrange for any products you want returned to be collected.
            </p>

            <p className="!mt-10 text-brand-navy/80">
              Questions?{" "}
              <Link href="/contact-us" className="font-semibold text-brand-orange underline-offset-2 hover:underline">
                Contact us
              </Link>
              .
            </p>
          </div>
        </section>
      </MainWithSupplierRail>
    </main>
  );
}
