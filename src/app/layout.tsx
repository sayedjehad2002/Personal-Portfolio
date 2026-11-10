import type { Metadata, Viewport } from "next";
import { Lilita_One, Nunito } from "next/font/google";
import "lenis/dist/lenis.css";
import "./globals.css";
import { siteUrl } from "@/lib/site";

const display = Lilita_One({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });
const body = Nunito({ subsets: ["latin"], variable: "--font-body", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Sayed Jehad Saeed · AI System Developer · Interactive Resume",
  description:
    "Walk through Sayed Jehad Saeed’s career as a 3D side-scroller across four realms, Desert, Aqua, Snow and Magma: from Bahrain roots and HR to building AI systems at Lumofy.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Sayed Jehad World · Sayed Jehad Saeed, AI System Developer",
    siteName: "Sayed Jehad World",
    url: "/",
    locale: "en_US",
    description: "A 3D side-scrolling interactive resume across four realms: Desert, Aqua, Snow and Magma. AI System Developer · Human Resources · Bahrain.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#8db7db",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
