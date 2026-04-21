export const dynamic = "force-dynamic";

import Link from "next/link";

import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";

export default function TermsAndConditionsPage() {
  return (
    <main className="min-h-screen bg-white py-6 text-brand-navy sm:py-8 md:py-10">
      <div className={`${SITE_PAGE_ROW_CLASS}`}>
        <h1 className="mb-6 text-2xl font-medium">Terms &amp; Conditions</h1>
        <div className="prose prose-sm max-w-none space-y-4 text-sm leading-relaxed">
          <p className="text-brand-navy/80">
            These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your use of this website and your purchase of goods
            and services from us. Please read them carefully. By browsing this site, creating an account, requesting a
            quote, or placing an order, you agree to these Terms. If you do not agree, you must not use the site or
            submit an order.
          </p>

          <section>
            <h2 className="mb-2 text-base font-medium">1. Who we are</h2>
            <p className="text-brand-navy/80">
              This website and online store are operated by{" "}
              <strong>Boss Workwear Pty Ltd</strong> (ABN <strong>54 132 117 018</strong>), trading as{" "}
              <strong>Boss Workwear</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). References to our
              goods include workwear, uniforms, PPE-related apparel where listed, and related services such as embroidery,
              printing, and decoration arranged through us.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">2. Website use</h2>
            <p className="text-brand-navy/80">
              You agree to use the website only for lawful purposes and in a way that does not infringe the rights of
              others or restrict their use of the site. You must not attempt to gain unauthorised access to our systems,
              interfere with security features, scrape or overload the site, or upload malware. We may suspend or
              terminate access where we reasonably believe there has been a breach of these Terms or a risk to our
              systems or customers.
            </p>
            <p className="text-brand-navy/80">
              Product descriptions, images, sizing charts, and stock indicators are provided for guidance. Minor
              variations in colour, fabric batch, or branding layout can occur; nothing in these Terms excludes your
              rights if goods are not as described under the <strong>Australian Consumer Law</strong> (&ldquo;ACL&rdquo;).
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">3. Accounts, eligibility &amp; accuracy</h2>
            <p className="text-brand-navy/80">
              Where the site allows an account, you are responsible for keeping login details confidential and for all
              activity under your account. You confirm that information you provide (including delivery details,
              company name, tax or purchase order references, and artwork files) is accurate and that you have authority
              to place the order. We may contact you to verify high-value or unusual orders and may delay or refuse an
              order if we reasonably suspect fraud, error, or unauthorised use.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">4. Quotes, orders, acceptance &amp; pricing</h2>
            <p className="text-brand-navy/80">
              A quote or cart total is an invitation to treat unless we expressly state otherwise. An order is an offer
              by you. We accept your order when we confirm it (for example by order confirmation email or by commencing
              fulfilment), at which point a contract is formed for those items. Until then, we may decline or cancel an
              order (including for stock unavailability, supplier constraints, or suspected error in price or
              description).
            </p>
            <p className="text-brand-navy/80">
              Unless we clearly state otherwise, prices are in <strong>Australian dollars (AUD)</strong> and include{" "}
              <strong>GST</strong> where applicable. We may change prices, promotions, and catalogue items without
              notice; the price shown at checkout when you complete payment generally applies to that transaction.
              Delivery fees (if any) are shown before you pay.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">5. Payment</h2>
            <p className="text-brand-navy/80">
              Payment is due at the time and by the methods shown at checkout (or as agreed in writing for approved
              trade accounts). You authorise us and our payment providers to charge your selected method. If payment
              fails, is charged back, or is reversed, we may cancel or suspend the order and any related production until
              payment is cleared.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">6. Delivery, title &amp; risk</h2>
            <p className="text-brand-navy/80">
              We ship to the address you provide. Delivery may be via carriers such as <strong>Australia Post</strong>{" "}
              or other services we nominate. <strong>Dispatch and delivery timeframes are estimates only</strong> and are
              not guaranteed; delays may occur due to stock, decoration lead times, public holidays, carrier capacity,
              or events outside our reasonable control.
            </p>
            <p className="text-brand-navy/80">
              <strong>Risk of loss or damage</strong> to goods passes to you on delivery to your address or when the
              carrier records delivery in accordance with the carrier&apos;s terms (including authority to leave where
              applicable). <strong>Title</strong> passes when we receive full payment for those goods.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">7. Customisation, embroidery, printing &amp; artwork</h2>
            <p className="text-brand-navy/80">
              Where an order includes customisation, personalisation, made-to-order work, or goods produced to your
              specifications (including embroidery, heat transfer, printing, or supplied garments for decoration),
              production may begin after you approve details (including artwork, colours, sizes, placements, and
              quantities). You are responsible for the accuracy of all information and approvals you provide.
            </p>
            <p className="text-brand-navy/80">
              You represent that you have the right to supply any logos, designs, or text for reproduction and that use
              on garments does not infringe third-party rights. You indemnify us against claims arising from content you
              supply, except to the extent caused by our wrongful act or required otherwise by law.
            </p>
            <p className="text-brand-navy/80">
              Once production has started, or where goods are not suitable for resale due to personalisation,{" "}
              <strong>cancellation, return, or exchange may be limited or unavailable</strong>, except where we are
              required to provide a remedy under applicable law (including the ACL).
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">8. Returns, refunds &amp; store credit</h2>
            <p className="text-brand-navy/80">
              If you believe there is a problem with your order, contact us promptly with your order details and a clear
              description of the issue. Depending on the circumstances, we may offer a remedy that may include repair,
              replacement, a partial or full refund, or <strong>store credit</strong> usable toward a future order.
              Where we issue store credit, it is recorded as a balance against your account or the email we associate
              with your order, is not interest-bearing, may be subject to expiry or other conditions we tell you at the
              time of issue, and is generally <strong>not redeemable for cash</strong> unless we agree in writing or
              applicable law requires a cash refund. Store credit is not transferable unless we expressly allow it. If
              store credit is applied at checkout, the order total is reduced accordingly; if an order paid partly with
              store credit is cancelled or adjusted, we may restore or adjust credit in line with what you actually paid
              and what was supplied, as permitted by law.
            </p>
            <p className="text-brand-navy/80">
              For <strong>change-of-mind</strong> returns of standard (non-customised) goods, we may accept returns only
              where we choose to offer that policy and you follow our return instructions, including time limits and
              condition requirements we publish or tell you at the time. Restocking or return freight may apply where
              permitted by law. We may refuse returns where goods are not in resalable condition, where hygiene, safety,
              or customisation makes return unreasonable, or where you have not followed reasonable care or return
              instructions. <strong>Statutory rights described below are not limited by this section.</strong>
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">9. Consumer guarantees (Australia)</h2>
            <p className="text-brand-navy/80">
              Our goods and services come with guarantees that cannot be excluded under the <strong>Australian Consumer Law</strong>. You are entitled to a replacement or refund for a major failure and compensation for any other reasonably
              foreseeable loss or damage. You are also entitled to have the goods repaired or replaced if they fail to be
              of acceptable quality and the failure does not amount to a major failure.{" "}
              <strong>
                Nothing in these Terms excludes, restricts, or modifies any consumer guarantee, right, or remedy under the
                Australian Consumer Law or any other applicable law that cannot lawfully be excluded, restricted, or
                modified.
              </strong>
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">10. Warranties &amp; manufacturer claims</h2>
            <p className="text-brand-navy/80">
              Some branded products may carry a manufacturer&apos;s warranty in addition to your ACL rights. Warranty
              terms (period, process, exclusions) are those of the manufacturer unless we expressly provide a separate
              written warranty. We will pass on reasonable assistance for valid manufacturer claims where appropriate.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">11. Liability</h2>
            <p className="text-brand-navy/80">
              To the maximum extent permitted by law, we exclude all implied terms and liabilities except those that
              cannot be excluded. Where liability cannot be excluded but can be limited, our liability for any breach of a
              non-excludable guarantee or implied term is limited, at our option, to resupplying the goods or services or
              paying the cost of resupply, and otherwise to the minimum extent permitted by law. We are not liable for
              indirect or consequential loss, loss of profit, or loss of opportunity, except where such limitation is
              not permitted by law.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">12. Intellectual property</h2>
            <p className="text-brand-navy/80">
              All content on this website (including text, graphics, logos, and layout) is owned by or licensed to us
              and is protected by Australian and international intellectual property laws. You may not copy, modify,
              distribute, or exploit our content for commercial purposes without our prior written consent, except as
              permitted by law.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">13. Privacy</h2>
            <p className="text-brand-navy/80">
              We collect and use personal information to process orders, deliver goods, respond to enquiries, and operate
              the site. How we handle personal information is described in our privacy practices as updated from time to
              time (if we publish a dedicated privacy policy, that document forms part of our commitment to you). For
              questions, use our{" "}
              <Link href="/contact-us" className="font-semibold text-brand-orange hover:underline">
                Contact us
              </Link>{" "}
              page.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">14. Force majeure</h2>
            <p className="text-brand-navy/80">
              We are not liable for delay or failure to perform where caused by events outside our reasonable control,
              including natural disasters, pandemics, war, civil unrest, industrial action, supply chain disruption,
              carrier failure, or government action. Where such events continue materially, we may cancel or suspend
              affected orders and refund amounts paid for goods not supplied, as required by law.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">15. Disputes, law &amp; changes</h2>
            <p className="text-brand-navy/80">
              If a dispute arises, contact us first so we can try to resolve it fairly and promptly. These Terms are
              governed by the laws of <strong>Western Australia, Australia</strong>, and you submit to the
              non-exclusive jurisdiction of the courts of that State. We may update these Terms from time to time; the
              version on our website at the time you place an order will generally apply to that order unless a
              mandatory law says otherwise. If any part of these Terms is invalid or unenforceable, the remainder
              continues in effect.
            </p>
          </section>

          <p className="mt-8 text-xs text-brand-navy/60">
            Last updated: 16 April 2026. Questions:{" "}
            <Link href="/contact-us" className="text-brand-orange underline hover:text-brand-orange/90">
              Contact us
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
