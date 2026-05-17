import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Encode_Sans_Condensed, Montserrat } from "next/font/google";
import "./globals.css";
import "./store-ui.css";
import "./product-listing-cards.css";
import { SiteFooter } from "@/app/components/site-footer";
import { StorePublicChatGate } from "@/app/components/store-public-chat-gate";
import { getSiteUrl } from "@/lib/site-url";

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

const metadataBaseUrl = getSiteUrl();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(metadataBaseUrl),
  title: {
    default: "Boss Workwear",
    template: "%s | Boss Workwear",
  },
  description:
    "Professional workwear, uniforms, embroidery and printing for teams across Australia — corporate polos, medical scrubs, PPE and more.",
  applicationName: "Boss Workwear",
  icons: {
    icon: [{ url: "/Boss_favicon.svg", type: "image/svg+xml" }],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const storeChatCustomerSignedIn = Boolean((cookieStore.get("customer_email")?.value ?? "").trim());

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${encodeSansCondensed.variable} ${montserrat.variable} font-sans h-full antialiased`}
    >
      <body suppressHydrationWarning className="flex min-h-full flex-col overflow-x-clip font-sans antialiased">
        <div className="flex-1 min-w-0">{children}</div>
        <SiteFooter />
        <StorePublicChatGate initialCustomerSignedIn={storeChatCustomerSignedIn} />
      </body>
    </html>
  );
}
