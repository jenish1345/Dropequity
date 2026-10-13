import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SmoothScroll } from "@/components/SmoothScroll";
import { StoreProvider } from "@/lib/store";
import "./globals.css";

// Display (Clash Display) and body (General Sans) are Fontshare faces that Google Fonts does not
// carry, so they load from Fontshare's own CSS endpoint below. Clash Display: headlines, campaign
// titles and big numbers. General Sans: body, buttons, forms and navigation.
const FONTSHARE_CSS =
  "https://api.fontshare.com/v2/css?f[]=clash-display@500,600,700&f[]=general-sans@400,500,600&display=swap";

// Mono: addresses, amounts, share counts, codes, timestamps and status labels.
const mono = IBM_Plex_Mono({
  variable: "--font-mono-face",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "DropOwn — Own the next drop",
    template: "%s — DropOwn",
  },
  description:
    "Fund the release. Earn DropShares. Get rewarded for the attention you bring. A hackathon demonstration on Monad Testnet.",
};

export const viewport: Viewport = {
  themeColor: "#0B0B0F",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mono.variable} antialiased`}>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTSHARE_CSS} />
      </head>
      <body className="flex min-h-screen flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-paper focus:px-4 focus:py-2 focus:text-ink"
        >
          Skip to content
        </a>
        <StoreProvider>
          <SmoothScroll />
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </StoreProvider>
      </body>
    </html>
  );
}
