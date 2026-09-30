import type { Metadata, Viewport } from "next";
import { Lilita_One, Nunito, Pixelify_Sans } from "next/font/google";
import "lenis/dist/lenis.css";
import "./globals.css";
import { siteUrl } from "@/lib/site";

const display = Lilita_One({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });
const body = Nunito({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const pixel = Pixelify_Sans({ subsets: ["latin"], variable: "--font-pixel", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Sayed Jehad Saeed · AI System Developer · Interactive Resume",
  description:
    "Walk through Sayed Jehad Saeed’s career as a winter side-scroller: from Bahrain roots and HR to building AI systems at Lumofy.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Sayed Jehad World · Sayed Jehad Saeed, AI System Developer",
    siteName: "Sayed Jehad World",
    url: "/",
    locale: "en_US",
    description: "An ice-themed, side-scrolling interactive resume. AI System Developer · Human Resources · Bahrain.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#0e1b33",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${pixel.variable}`}>
      <body>{children}</body>
    </html>
  );
}
