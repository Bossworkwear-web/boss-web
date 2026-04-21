import type { Metadata } from "next";
import Link from "next/link";
import { Encode_Sans_Condensed, Montserrat } from "next/font/google";
import "./globals.css";
import "./store-ui.css";
import "./product-listing-cards.css";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";

const encodeSansCondensed = Encode_Sans_Condensed({
  variable: "--font-encode-sans-condensed",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const metadataBaseUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(metadataBaseUrl),
  title: {
    default: "Boss Workwear",
    template: "%s | Boss Workwear",
  },
  description:
    "Professional workwear, uniforms, embroidery and printing for teams across Australia — corporate polos, medical scrubs, PPE and more.",
  applicationName: "Boss Workwear",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${encodeSansCondensed.variable} ${montserrat.variable} font-sans h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col font-sans antialiased">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-brand-navy/10 bg-white print:hidden">
          <div className={`flex flex-wrap items-center justify-center gap-3 py-6 ${SITE_PAGE_ROW_CLASS}`}>
            <Link
              href="/admin"
              className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-navy/60 hover:text-brand-orange"
            >
              Admin
            </Link>
            <span className="rounded-full border border-brand-navy/20 bg-brand-surface px-4 py-1.5 text-xs font-medium uppercase tracking-[0.08em] text-brand-navy">
              ISO Certified
            </span>
            <span className="rounded-full border border-brand-navy/20 bg-brand-surface px-4 py-1.5 text-xs font-medium uppercase tracking-[0.08em] text-brand-navy">
              Australia-wide Shipping
            </span>
            <span className="rounded-full border border-brand-navy/20 bg-brand-surface px-4 py-1.5 text-xs font-medium uppercase tracking-[0.08em] text-brand-navy">
              Bulk Order Discounts
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
