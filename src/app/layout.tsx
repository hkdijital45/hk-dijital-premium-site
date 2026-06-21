import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TrackingPlaceholders } from "@/components/public/TrackingPlaceholders";
import { MetaPixel } from "@/components/public/MetaPixel";
import { getSiteContent } from "@/lib/content";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  return {
    title: {
      default: content.settings.siteTitle,
      template: `%s | ${content.brand.companyName}`
    },
    description: content.settings.siteDescription
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const content = await getSiteContent();

  return (
    <html lang="tr" className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}>
      <body className="min-h-full bg-[#050711] font-sans text-white">
        <TrackingPlaceholders ids={content.settings.analyticsIds} />
        <MetaPixel />
        {children}
      </body>
    </html>
  );
}
