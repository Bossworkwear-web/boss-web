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
            <h2 className="mb-2 text-base font-medium">1. Definitions &amp; who we are</h2>
            <p className="text-brand-navy/80">
              In these Terms, <strong>&ldquo;Supplier&rdquo;</strong>, <strong>&ldquo;we&rdquo;</strong>,{" "}
              <strong>&ldquo;us&rdquo;</strong>, and <strong>&ldquo;our&rdquo;</strong> mean{" "}
              <strong>Boss Workwear Pty Ltd</strong> (ABN <strong>54 132 117 018</strong>), trading as{" "}
              <strong>Boss Workwear</strong>. <strong>&ldquo;Purchaser&rdquo;</strong> and <strong>&ldquo;you&rdquo;</strong>{" "}
              mean the person or entity ordering the goods. <strong>&ldquo;Goods&rdquo;</strong> means the goods we supply.
              References to <strong>&ldquo;amounts due&rdquo;</strong> include the purchase price, delivery and freight
              charges, any extra packing or handling charges we disclose, and GST where applicable.
            </p>
            <p className="text-brand-navy/80">
              Our goods include workwear, uniforms, PPE-related apparel where listed, and related services such as
              embroidery, printing, and decoration arranged through us.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">2. Which terms apply</h2>
            <p className="text-brand-navy/80">
              The contractual terms binding on us are those set out in these Terms and any additional terms we agree in
              writing. Statutory rights that cannot be excluded or limited (including under the{" "}
              <strong>Australian Consumer Law</strong>) continue to apply — see section 18 below.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">3. Website use</h2>
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
              rights if goods are not as described under the Australian Consumer Law (&ldquo;ACL&rdquo;).
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">4. Accounts, eligibility &amp; accuracy</h2>
            <p className="text-brand-navy/80">
              Where the site allows an account, you are responsible for keeping login details confidential and for all
              activity under your account. You confirm that information you provide (including delivery details,
              company name, tax or purchase order references, and artwork files) is accurate and that you have authority
              to place the order. We may contact you to verify high-value or unusual orders and may delay or refuse an
              order if we reasonably suspect fraud, error, or unauthorised use.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">5. Quotes, orders, acceptance &amp; payment timing</h2>
            <p className="text-brand-navy/80">
              A quote or cart total is an invitation to treat unless we expressly state otherwise. An order is an offer
              by you. We accept your order when we confirm it (for example by order confirmation email or by commencing
              fulfilment), at which point a contract is formed for those items. Until then, we may decline or cancel an
              order (including for stock unavailability, supplier constraints, or suspected error in price or
              description).
            </p>
            <p className="text-brand-navy/80">
              Unless we agree otherwise in writing, orders are processed on the basis that payment is made at the time we
              process the order (or as shown at checkout). If payment fails, is charged back, or is reversed, we may
              cancel or suspend the order and any related production until payment is cleared.
            </p>
            <p className="text-brand-navy/80">
              Items missing from a delivered order may be placed on back-order and dispatched when available, or we may
              refund the unit price for the missing item(s) only. Where an order is delivered with missing or incorrect
              items, we may (at our discretion, consistent with our obligations at law) refund, back-order, or supply
              replacement or substitute items as appropriate.
            </p>
            <p className="text-brand-navy/80">
              We aim to deliver on time but delivery dates are estimates only; we are not liable for delays beyond what
              the ACL or other applicable law allows (see also sections 10 and 23).
            </p>

            <h3 className="mb-2 mt-4 text-sm font-semibold text-brand-navy">5.1 Changing or cancelling an order</h3>
            <p className="text-brand-navy/80">
              You may need to adjust an order after it is placed. Once an order is &ldquo;in progress&rdquo; (it has moved
              to the next stage of fulfilment), we are generally unable to modify or cancel it, because our systems move
              orders forward for prompt processing.
            </p>
            <p className="text-brand-navy/80">
              <strong>Additions:</strong> Orders in progress are usually final; additional items must be purchased as a
              new order and are subject to shipping charges.
            </p>
            <p className="text-brand-navy/80">
              <strong>Cancellations:</strong> Contact us for assistance. Such requests are subject to our returns and
              cancellation processes and may incur a restocking or administrative fee where permitted by law.
            </p>
            <p className="text-brand-navy/80">
              <strong>Alterations:</strong> Requests to change items within an order may need to go through our returns
              or exchanges process and may incur fees as permitted by law.
            </p>

            <h3 className="mb-2 mt-4 text-sm font-semibold text-brand-navy">5.2 Orders we may decline or cancel</h3>
            <p className="text-brand-navy/80">
              Without limiting sections 4 and 13, we may decline, cancel, suspend, or refuse to proceed with any order,
              quote, or production (whether or not payment has been made, and whether or not production has started)
              where we reasonably consider it appropriate and permitted by law. This includes, but is not limited to,
              orders or requests that:
            </p>
            <p className="text-brand-navy/80">
              (a) are abusive, threatening, harassing, or otherwise unreasonable in volume, turnaround, pricing, or
              specification; (b) are commercially impractical, unsafe, or inconsistent with the workwear, uniform, PPE
              apparel, or decoration services we supply; (c) include Customer Artwork or instructions that are unlawful,
              sexually explicit or pornographic, obscene, gratuitously offensive, discriminatory, hateful, or that
              promote violence or illegal activity; (d) appear likely to infringe intellectual property, privacy, or
              publicity rights, or where you cannot demonstrate authority to use the materials; (e) would require us to
              breach applicable law, card or payment network rules, supplier or decorator policies, or reasonable
              community standards for a business of our kind; or (f) we reasonably suspect involve fraud, error, or
              unauthorised use.
            </p>
            <p className="text-brand-navy/80">
              If we decline or cancel for these reasons before goods or services are supplied, we will refund amounts you
              paid for the affected items (and related delivery charges for those items), except where we have fairly
              incurred non-recoverable costs with your prior agreement or as otherwise permitted by law. If production
              has already started, sections 11, 13, and 17 and our returns policy apply. We are not obliged to give
              detailed reasons where doing so could prejudice investigation of fraud or unlawful conduct, but we will act
              fairly and in accordance with the ACL and other applicable law.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">6. Coupon codes &amp; promotions</h2>
            <p className="text-brand-navy/80">
              We do not retroactively apply discounts or issue refunds because a valid coupon code was not entered at
              checkout. Coupon codes are valid only within their stated terms and expiry; invalid or expired codes may be
              rejected at the cart or checkout.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">7. Pricing</h2>
            <p className="text-brand-navy/80">
              Unless we clearly state otherwise, prices are in <strong>Australian dollars (AUD)</strong> and include{" "}
              <strong>GST</strong> where applicable. Prices are subject to change; the price shown at checkout when you
              complete payment generally applies to that transaction. Non-stocked or special-order goods may be quoted
              separately. Delivery fees (if any) are shown before you pay.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">8. Payment</h2>
            <p className="text-brand-navy/80">
              Payment is due at the time and by the methods shown at checkout (or as agreed in writing for approved trade
              accounts). You authorise us and our payment providers to charge your selected method. Our usual payment
              terms are that payment is received before dispatch unless we have agreed otherwise in writing.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">9. Delivery, title &amp; risk</h2>
            <p className="text-brand-navy/80">
              We ship to the address you provide. Delivery may be via carriers such as <strong>Australia Post</strong>{" "}
              or other services we nominate. Dispatch and delivery timeframes are estimates only and are not guaranteed;
              delays may occur due to stock, decoration lead times, public holidays, carrier capacity, or events outside
              our reasonable control.
            </p>
            <p className="text-brand-navy/80">
              <strong>Risk</strong> in the goods passes to you when we dispatch the goods to you (or as agreed with the
              carrier). If you arrange delivery to a third party, risk passes as above and we do not accept liability
              for loss arising solely from that arrangement beyond what the law requires.
            </p>
            <p className="text-brand-navy/80">
              <strong>Title</strong> passes when we receive full payment for those goods. If deemed necessary, you should
              insure goods while they are at your risk.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">10. Processing &amp; turnaround</h2>
            <p className="text-brand-navy/80">
              We recommend allowing approximately <strong>10–15 business days</strong> for processing (including
              decoration where applicable) and dispatch, unless we quote a different timeframe. For custom orders,
              turnaround often runs from when artwork is approved and is met when goods are dispatched.
            </p>
            <p className="text-brand-navy/80">
              Plain or undecorated orders may arrive sooner. Remote delivery may take longer. You may receive split
              shipments if items come from different warehouses. If you order decoration (screen print, embroidery,
              vinyl, etc.) and are a new customer, artwork setup may be required before production; setup time depends on
              your requirements.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">11. Artwork proofing &amp; approval</h2>
            <p className="text-brand-navy/80">
              To reduce errors, we may require written approval of a final artwork proof before production. Custom
              merchandise orders may require approval by email before we decorate stock we hold or order for you. Your
              approval confirms you have read and agree to this section.
            </p>

            <h3 className="mb-2 mt-4 text-sm font-semibold text-brand-navy">11.1 Proofing process</h3>
            <p className="text-brand-navy/80">
              We may supply a digital proof (often PDF) by email. The proof represents the intended decoration; it is your
              final chance to check details before production. Production will not start until we receive your explicit
              written approval (for example an email stating that you approve the artwork).
            </p>

            <h3 className="mb-2 mt-4 text-sm font-semibold text-brand-navy">11.2 Your responsibility</h3>
            <p className="text-brand-navy/80">
              You are responsible for carefully reviewing the proof, including spelling, grammar, dates, phone numbers,
              addresses, layout, logo version/size/colour, product quantities and specifications, and colours (see
              section 12). We recommend reviewing on a desktop monitor and printing the proof if needed; mobile screens
              may not match print output.
            </p>

            <h3 className="mb-2 mt-4 text-sm font-semibold text-brand-navy">11.3 Authority to approve</h3>
            <p className="text-brand-navy/80">
              The person who approves the proof warrants they have authority to bind their organisation. We are not
              responsible for internal miscommunication; if an employee approves a proof that management later disputes,
              your organisation remains responsible for payment of goods produced in line with that approval, subject to
              your statutory rights.
            </p>

            <h3 className="mb-2 mt-4 text-sm font-semibold text-brand-navy">11.4 Colour matching</h3>
            <p className="text-brand-navy/80">
              Digital proofs show layout and design, not guaranteed colour. Screen colours (RGB) differ from printed or
              embroidered colours (CMYK, PMS, threads). We use commercially reasonable efforts to match specified
              colours but cannot guarantee an exact match to your monitor or to prior print runs. Where colour is
              critical, supply <strong>Pantone (PMS)</strong> codes (see section 12).
            </p>

            <h3 className="mb-2 mt-4 text-sm font-semibold text-brand-navy">11.5 Errors after approval</h3>
            <p className="text-brand-navy/80">
              Subject to the ACL, we are not liable for errors or omissions that were visible on the proof you approved.
              Rework after approval may incur additional charges and delays. Nothing in this section limits remedies for
              major failure or other non-excludable rights.
            </p>

            <h3 className="mb-2 mt-4 text-sm font-semibold text-brand-navy">11.6 Response timeframe</h3>
            <p className="text-brand-navy/80">
              You should provide written approval or feedback within <strong>14 business days</strong> of us sending the
              proof, unless we agree otherwise. We may contact you by email or phone for approval.
            </p>

            <h3 className="mb-2 mt-4 text-sm font-semibold text-brand-navy">11.7 Failure to respond</h3>
            <p className="text-brand-navy/80">
              If we do not receive approval within that period, we may dispatch plain (undecorated) stock to your
              nominated address and charge for the goods and delivery as agreed; returning plain stock to suppliers is not
              always possible. We are not responsible for losses from stock shipped without decoration for that reason.
              Decoration after that period may require a new order, subject to availability and current pricing.
            </p>

            <h3 className="mb-2 mt-4 text-sm font-semibold text-brand-navy">11.8 Storage</h3>
            <p className="text-brand-navy/80">
              Warehouse space is limited; we cannot hold stock indefinitely beyond agreed timeframes without your
              approval.
            </p>

            <h3 className="mb-2 mt-4 text-sm font-semibold text-brand-navy">11.9 Contact details</h3>
            <p className="text-brand-navy/80">
              You are responsible for keeping email and phone details accurate and for checking messages (including spam
              folders).
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">12. Colour selection &amp; accuracy</h2>
            <p className="text-brand-navy/80">
              Colours can look different on screens than on the finished product; RGB does not always match CMYK, PMS,
              or thread colours.
            </p>
            <p className="text-brand-navy/80">
              For best results, provide <strong>PMS solid coated</strong> codes where possible. You are responsible for
              the correctness of codes for your brand.
            </p>
            <p className="text-brand-navy/80">
              If you do not supply PMS codes, we may use professional judgement to select the closest stock thread, ink,
              vinyl, or CMYK match available. That match is subjective and may not match your expectations. Subject to
              the ACL, we are not obliged to reprint or refund solely for colour perception issues where PMS codes were
              not supplied when requested.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">13. Customer-supplied artwork</h2>
            <p className="text-brand-navy/80">
              Where you supply logos, designs, images, or text (&ldquo;Customer Artwork&rdquo;), you warrant you own the
              content or have all licences and permissions needed, and that use does not infringe third-party rights
              (including copyright and trade marks).
            </p>
            <p className="text-brand-navy/80">
              You indemnify us against claims arising from Customer Artwork you supply, except to the extent caused by our
              wrongful act or as required by law. You must supply print-ready files in formats we specify; poor-quality
              files may delay production, incur extra fees, or reduce output quality. We may refuse or cancel orders
              (see section 5.2) where artwork or instructions appear unlawful, defamatory, obscene, sexually explicit or
              pornographic, harassing, discriminatory, or likely to infringe third-party rights.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">14. Artwork sizing, positioning &amp; fees</h2>
            <p className="text-brand-navy/80">
              Website &ldquo;design size&rdquo; options indicate a guide or maximum width (for example up to 300&nbsp;mm).
              Final print size may be adjusted to fit the printable area of each garment. Logos may be scaled down for
              small sizes, tall/portrait artwork, or obstructed areas (reflective tape, pockets, vents, hoods).
            </p>
            <p className="text-brand-navy/80">
              &ldquo;Position&rdquo; indicates your preferred placement; we may move decoration slightly to fit the
              garment or avoid obstructions.
            </p>
            <p className="text-brand-navy/80">
              <strong>New logo orders</strong> may attract a one-time artwork setup fee covering print-ready conversion,
              proofing (as a guide — final size/position may vary per clauses above), and typically up to two rounds of
              reasonable changes; further changes may be charged. <strong>Repeat logo</strong> orders may not be re-proofed
              by default; request a repeat proof with changes if you need it (fees may apply). If you do not select proof
              options where offered, decoration may follow your last approved proof.
            </p>
            <p className="text-brand-navy/80">
              You must give accurate information about whether we have decorated a logo before. If a logo is new to our
              production records, a setup fee may be required before the order proceeds; refusal to pay may lead to
              cancellation under our returns policy, including applicable fees where lawful.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">15. Ownership &amp; use of proofs</h2>
            <p className="text-brand-navy/80">
              Proofs and mock-ups we prepare are our intellectual property, supplied only for you to review and approve
              production with us. You must not share them with third-party decorators for quoting or production without
              our consent. Misuse may breach these Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">16. Standard embroidery (double backing)</h2>
            <p className="text-brand-navy/80">
              For quality and durability we typically apply a double layer of backing (stabiliser) on embroidered orders.
              This helps reduce puckering and distortion on varied fabrics. Minor puckering can still occur with complex
              designs and certain fabrics and may ease after washing. This practice does not override your statutory
              guarantees where goods are not of acceptable quality.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">17. Customisation &amp; statutory rights</h2>
            <p className="text-brand-navy/80">
              Where an order includes customisation or goods produced to your specifications, production may begin after
              approvals described above. Once production has started, or where goods cannot reasonably be resold due to
              customisation, cancellation, return, or exchange may be limited except as required by the ACL or other law.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">18. Returns, refunds &amp; store credit</h2>
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
            <h2 className="mb-2 text-base font-medium">19. Consumer guarantees (Australia)</h2>
            <p className="text-brand-navy/80">
              Our goods and services come with guarantees that cannot be excluded under the{" "}
              <strong>Australian Consumer Law</strong>. You are entitled to a replacement or refund for a major failure
              and compensation for any other reasonably foreseeable loss or damage. You are also entitled to have the
              goods repaired or replaced if they fail to be of acceptable quality and the failure does not amount to a
              major failure.{" "}
              <strong>
                Nothing in these Terms excludes, restricts, or modifies any consumer guarantee, right, or remedy under the
                Australian Consumer Law or any other applicable law that cannot lawfully be excluded, restricted, or
                modified.
              </strong>
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">20. Warranties &amp; manufacturer claims</h2>
            <p className="text-brand-navy/80">
              Some branded products may carry a manufacturer&apos;s warranty in addition to your ACL rights. Warranty
              terms (period, process, exclusions) are those of the manufacturer unless we expressly provide a separate
              written warranty. We will pass on reasonable assistance for valid manufacturer claims where appropriate.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">21. Liability</h2>
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
            <h2 className="mb-2 text-base font-medium">22. Intellectual property</h2>
            <p className="text-brand-navy/80">
              All content on this website (including text, graphics, logos, and layout) is owned by or licensed to us
              and is protected by Australian and international intellectual property laws. You may not copy, modify,
              distribute, or exploit our content for commercial purposes without our prior written consent, except as
              permitted by law. Proofs we create are addressed in section 15.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">23. Privacy</h2>
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
            <h2 className="mb-2 text-base font-medium">24. Force majeure</h2>
            <p className="text-brand-navy/80">
              We are not liable for delay or failure to perform where caused by events outside our reasonable control,
              including natural disasters, pandemics, war, civil unrest, industrial action, supply chain disruption,
              carrier failure, or government action. Where such events continue materially, we may cancel or suspend
              affected orders and refund amounts paid for goods not supplied, as required by law.
            </p>
          </section>

          <section>
            <h2 className="mb-2 text-base font-medium">25. Disputes, law &amp; changes</h2>
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
            Last updated: 17 May 2026. Questions:{" "}
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
