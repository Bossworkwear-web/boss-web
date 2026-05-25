import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Encode_Sans_Condensed, Montserrat } from "next/font/google";
import "./globals.css";
import "./store-ui.css";
import "./product-listing-cards.css";
import { GoogleAnalytics } from "@/app/components/google-analytics";
import { GlobalLatinInputGuard } from "@/app/components/global-latin-input-guard";
import { RouteLoading } from "@/app/components/route-loading";
import { SiteFooter } from "@/app/components/site-footer";
import { CyberAssistanceGate } from "@/app/components/cyber-assistance/cyber-assistance-gate";
import { StorePublicChatGate } from "@/app/components/store-public-chat-gate";
import { finalizeCustomerAuthSession, getAuthenticatedCustomerUser } from "@/lib/customer-auth";
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
  let storeChatCustomerSignedIn = Boolean((cookieStore.get("customer_email")?.value ?? "").trim());

  if (!storeChatCustomerSignedIn) {
    const authUser = await getAuthenticatedCustomerUser();
    if (authUser) {
      try {
        const synced = await finalizeCustomerAuthSession(authUser);
        if (synced.status === "ready") {
          storeChatCustomerSignedIn = true;
        }
      } catch {
        /* profile incomplete or DB error — user completes customer-details */
      }
    }
  }

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${encodeSansCondensed.variable} ${montserrat.variable} font-sans h-full antialiased`}
    >
      <body suppressHydrationWarning className="flex min-h-full flex-col overflow-x-clip font-sans antialiased">
        <GoogleAnalytics />
        <GlobalLatinInputGuard />
        <RouteLoading />
        <div className="flex-1 min-w-0">{children}</div>
        <SiteFooter />
        <CyberAssistanceGate />
        <StorePublicChatGate initialCustomerSignedIn={storeChatCustomerSignedIn} />
      </body>
    </html>
  );
}
