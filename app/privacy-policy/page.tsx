import type { Metadata } from "next";
import Link from "next/link";

import { MainWithSupplierRail } from "@/app/components/supplier-ad-banner";
import { LegalPageWithCmsFallback } from "@/app/components/legal-page-with-cms-fallback";
import { TopNav } from "@/app/components/top-nav";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";
import { STOREFRONT_QUOTE_EMAIL_RECIPIENT } from "@/lib/storefront-quote-mailto";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

export default async function PrivacyPolicyPage() {
  const privacyMailto = `mailto:${STOREFRONT_QUOTE_EMAIL_RECIPIENT}?subject=${encodeURIComponent("Privacy — information correction")}`;

  return (
    <LegalPageWithCmsFallback slug="privacy" shell="storefront">
      <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <TopNav />
      <MainWithSupplierRail>
        <section className={`${SITE_PAGE_ROW_CLASS} max-w-4xl py-10`}>
          <h1 className="mb-6 text-3xl font-medium">Privacy Policy</h1>

          <div className="prose prose-sm max-w-none space-y-6 text-sm leading-relaxed text-brand-navy/90 [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-brand-navy [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-brand-navy [&_strong]:text-brand-navy [&_ul]:my-2 [&_li]:my-0.5">
            <p>
              We are committed to ensuring that all information you provide to <strong>Boss Workwear</strong> is treated
              confidentially and protected in accordance with this policy and applicable Australian privacy law,
              including the <em>Privacy Act 1988</em> (Cth) and the Australian Privacy Principles where they apply to us.
            </p>
            <p>
              We may change this policy from time to time. We recommend that you review this page periodically so that
              you are aware of the current policy. If we make material changes, we will take reasonable steps to bring
              them to your attention where required by law.
            </p>

            <h2>1. Information that we collect</h2>
            <p>We may collect the following kinds of information when you use our website or place an order, including:</p>
            <ul className="list-disc pl-5">
              <li>name, email address, mailing or delivery address, and phone number;</li>
              <li>preferences and interests you choose to share with us;</li>
              <li>other information relevant to customer surveys, promotions, or offers (where you choose to provide it).</li>
            </ul>

            <h2>2. Information usage</h2>
            <p>
              We treat your information as confidential and use it only for legitimate business purposes, including:
            </p>
            <ul className="list-disc pl-5">
              <li>internal record keeping and administration;</li>
              <li>processing, fulfilling, and delivering your orders;</li>
              <li>providing the services you request (for example, quotes, account access, or customer support);</li>
              <li>understanding your needs and improving our products and services;</li>
              <li>
                sending promotional communications about new products, special offers, or other information we believe may
                interest you, where permitted by law (you may opt out of marketing in accordance with any unsubscribe
                mechanism we provide).
              </li>
            </ul>
            <p>
              If you believe that any information we hold about you is incorrect, incomplete, or out of date, please
              contact us as soon as possible at{" "}
              <a href={privacyMailto} className="font-semibold text-brand-orange underline-offset-2 hover:underline">
                {STOREFRONT_QUOTE_EMAIL_RECIPIENT}
              </a>{" "}
              (or via our{" "}
              <Link href="/contact-us" className="font-semibold text-brand-orange underline-offset-2 hover:underline">
                Contact us
              </Link>{" "}
              page). We will take reasonable steps to correct information we agree is inaccurate, incomplete, or outdated.
            </p>

            <h2>3. Cookies and similar technologies</h2>
            <p>
              Cookies are small pieces of data stored on your browser. They are often used to remember preferences,
              maintain sessions, and understand how visitors use a website.
            </p>
            <p>
              You can choose to accept or decline cookies. Most browsers accept cookies by default; you can usually
              change your settings to refuse some or all cookies. If you disable cookies, some parts of our website may
              not function as intended.
            </p>
            <p>
              We may receive, collect, and store information you enter on our website or provide to us in other ways. This
              can include technical data such as the Internet protocol (IP) address used to connect your device to the
              Internet, login information where you have an account, and device and connection information. We may also
              collect purchase history and, where you provide it, communications, feedback, product reviews, and profile
              details.
            </p>
            <p>
              We may use third-party analytics tools (for example, <strong>Google Analytics</strong> or similar services)
              to measure traffic, session duration, page interactions, and navigation patterns. These tools may use
              cookies or similar technologies in accordance with their own policies.
            </p>
            <p>
              Where you make a payment through our website, payment details are handled by our payment service providers.
              We do not store full card numbers on our own servers; card data is processed in line with the provider&apos;s
              PCI-compliant environment.
            </p>

            <h3>3.1 How we collect information</h3>
            <p>
              When you conduct a transaction on our website (for example, placing an order or requesting a quote), we
              collect personal information you give us, such as your name, address, and email address. We use that
              information for the purposes described in this policy and at the point of collection.
            </p>

            <h3>3.2 Purposes of collection (personal and non-personal information)</h3>
            <p>We collect personal and non-personal information for purposes that include:</p>
            <ul className="list-disc pl-5">
              <li>to provide and operate our services and website;</li>
              <li>to provide customer assistance and technical support;</li>
              <li>
                to contact you with service-related notices and, where permitted, promotional messages (which you may
                opt out of where required);
              </li>
              <li>
                to create aggregated or de-identified statistical information to help us and trusted partners improve our
                services (where that information no longer identifies you);
              </li>
              <li>to comply with applicable laws and regulations.</li>
            </ul>

            <h2>4. Security</h2>
            <p>
              We implement reasonable security measures designed to protect personal information from misuse,
              interference, loss, and unauthorised access, modification, or disclosure. Access to systems that hold
              personal information is limited to people who need it for their role and who are bound by confidentiality
              obligations.
            </p>
            <p>
              No method of transmission over the Internet is completely secure; we encourage you to use strong passwords
              and to protect your account credentials.
            </p>

            <h2>5. Disclosure of information</h2>
            <p>
              Where necessary to operate our website, process payments, deliver orders, or provide services to you, we
              may share your information with trusted third parties (for example, payment processors, delivery partners,
              IT hosts, or email providers) who agree to use it only for the purposes we specify and to protect it
              appropriately.
            </p>
            <p>
              We may also disclose information where we believe in good faith that disclosure is required or permitted
              by law, to enforce our site policies, or to protect the rights, property, or safety of Boss Workwear, our
              customers, or others.
            </p>
            <p>
              We do <strong>not</strong> sell your personal information. We do not trade your personal information to
              unrelated outside parties for their own marketing.
            </p>

            <h2>5.1 Online advertising and marketing platforms</h2>
            <p>
              Where you have given us consent (for example, by opting in on our Customer Details form), we may use your
              contact details (such as your name and email address) to send you promotional communications about Boss
              Workwear products and offers.
            </p>
            <p>
              We may also share <strong>hashed</strong> versions of contact information (for example, a one-way hash of
              your email address) with advertising platforms such as <strong>Google Ads</strong> solely so that Boss
              Workwear can show relevant ads to people who have interacted with us or who may be interested in our
              products. This is sometimes called a &quot;Customer Match&quot; or similar audience feature. We use these
              tools only for Boss Workwear&apos;s own advertising — not for unrelated third parties to market to you on
              their behalf. Google&apos;s use of this data is subject to{" "}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-brand-orange underline-offset-2 hover:underline"
              >
                Google&apos;s Privacy Policy
              </a>
              ; see also{" "}
              <a
                href="https://support.google.com/adspolicy/answer/6299717"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-brand-orange underline-offset-2 hover:underline"
              >
                Google Ads Customer Match policy
              </a>
              .
            </p>
            <p>
              You can withdraw marketing consent at any time by updating your preferences on the Customer Details page
              in your account, by using any unsubscribe link in our emails, or by contacting us at{" "}
              <a href={privacyMailto} className="font-semibold text-brand-orange underline-offset-2 hover:underline">
                {STOREFRONT_QUOTE_EMAIL_RECIPIENT}
              </a>
              .
            </p>

            <h2>6. Retention and disposal of personal information</h2>
            <p>
              We retain personal information only for as long as reasonably necessary for the purposes for which it was
              collected, including to satisfy legal, accounting, or reporting requirements. When information is no longer
              required, we take reasonable steps to delete or de-identify it, subject to any legal obligation to retain
              certain records for a prescribed period.
            </p>
          </div>

          <p className="mt-10 text-sm">
            Questions about this policy?{" "}
            <Link href="/contact-us" className="font-semibold text-brand-orange underline-offset-2 hover:underline">
              Contact us
            </Link>
            .
          </p>
        </section>
      </MainWithSupplierRail>
    </main>
    </LegalPageWithCmsFallback>
  );
}
