import type { Metadata } from "next";
import Link from "next/link";

import { MainWithSupplierRail } from "@/app/components/supplier-ad-banner";
import { LegalPageWithCmsFallback } from "@/app/components/legal-page-with-cms-fallback";
import { TopNav } from "@/app/components/top-nav";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";

export const metadata: Metadata = {
  title: "Shipping Policy",
};

export default async function ShippingPolicyPage() {
  return (
    <LegalPageWithCmsFallback slug="shipping" shell="storefront">
      <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <TopNav />
      <MainWithSupplierRail>
        <section className={`${SITE_PAGE_ROW_CLASS} max-w-4xl py-10`}>
          <h1 className="mb-6 text-3xl font-medium">Shipping Policy</h1>

          <div className="prose prose-sm max-w-none space-y-6 text-sm leading-relaxed text-brand-navy/90 [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-brand-navy [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-brand-navy [&_strong]:text-brand-navy">
            <p>
              All deliveries will be processed after the production process is completed and may take more than 2 weeks
              depending on the suppliers&apos; delivery schedules. If stock has not been received from suppliers after 2
              weeks, partial delivery may be made.
            </p>
            <p>
              Please refer to your &ldquo;
              <Link href="/customer" className="font-semibold text-brand-orange underline-offset-2 hover:underline">
                My Account
              </Link>
              &rdquo; page to track your order.
            </p>
            <p className="text-brand-navy/80">(Shipping to remote locations may incur a surcharge.)</p>

            <h2>1. Large parcels</h2>
            <p>
              Some cartons may weigh over 20kg depending on the products. Please do not lift beyond your capacity and
              handle all parcels with care. We are not responsible for any injuries caused during parcel handling.
            </p>

            <h3>1.1 Inspection and signature</h3>
            <p>
              You are requested to <strong>inspect the item and sign for receipt</strong> when you receive a large
              parcel. Signing the delivery receipt means you agree that the goods have arrived in good condition. Please
              take the time to inspect the item carefully, as <strong>no claims will be entertained</strong> once goods
              have been signed for.
            </p>

            <h3>1.2 PO Boxes and parcel lockers</h3>
            <p>
              Large parcels <strong>cannot be delivered to PO Boxes or parcel lockers</strong>. A street address is
              required.
            </p>

            <h2>2. Pick up</h2>
            <p>
              Pick up is available <strong>from our Perth metropolitan store only</strong>. You may arrange collection
              from <strong>Shop 152, Coventry Village, 243 Walter Rd W, Morley WA 6062</strong>.
            </p>
            <p>
              If an order is not collected within <strong>7 days</strong> of purchase (or within the timeframe we agree
              in writing), your order may be cancelled and any applicable refund or restocking terms will apply as set
              out at the time of purchase or in our Terms &amp; Conditions.
            </p>

            <h2>3. Change of address</h2>
            <p>
              We cannot be held responsible if an <strong>incorrect address</strong> is entered on your order. If you
              notice an incorrect address after your order is finalised, please{" "}
              <Link href="/contact-us" className="font-semibold text-brand-orange underline-offset-2 hover:underline">
                contact us
              </Link>{" "}
              immediately. We will attempt to update incorrect order details; however, due to fast warehouse turnaround,
              <strong> some orders cannot be adjusted</strong> once processing or dispatch has begun.
            </p>

            <h2>4. Unsuccessful delivery attempt</h2>
            <p>
              If delivery fails because you and/or your authorised representative were not available at the agreed time
              or address, the courier will usually leave a card with contact details and instructions for collection or
              redelivery.
            </p>
            <p>
              If you do not collect the items by the due date, or if the shipping address is incorrect, goods may be
              returned to sender. <strong>Return-to-sender fees</strong> may apply.
            </p>
            <p>
              If we are unable to reach you to obtain correct address details or to arrange payment for reshipment, we
              may process a <strong>refund for the original amount paid</strong>, less our initial shipping cost and any
              return-to-sender or redelivery fees we reasonably incur.
            </p>

            <h2>5. International shipping</h2>
            <p>
              We typically use <strong>Australia Post</strong> (or another carrier we nominate) for international orders.
            </p>
            <p>
              A <strong>Boss Workwear</strong> team member will contact you with the <strong>exact shipping amount</strong>{" "}
              once your order has been packed and weighed. We will ask you to pay the required amount before we arrange
              shipment.
            </p>

            <h2>6. International taxes and customs charges</h2>
            <p>
              All <strong>taxes and customs charges</strong> are the responsibility of the customer and are{" "}
              <strong>not included</strong> in the price of goods or in our standard shipping quotes unless we expressly
              state otherwise in writing.
            </p>
            <p>
              Taxes and customs charges vary by country and region. We suggest contacting your local customs office if
              you are unsure of charges that may apply to your order.
            </p>
            <p>
              <strong>Boss Workwear</strong> is not responsible for any additional taxes, duties, or customs charges
              imposed during import or delivery of your order.
            </p>
          </div>

          <p className="mt-10 text-sm">
            <Link href="/contact-us" className="font-semibold text-brand-orange underline-offset-2 hover:underline">
              Contact us
            </Link>{" "}
            for shipping quotes, bulky freight, or delivery questions.
          </p>
        </section>
      </MainWithSupplierRail>
    </main>
    </LegalPageWithCmsFallback>
  );
}
