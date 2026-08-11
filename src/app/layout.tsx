import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { TrackingPlaceholders } from "@/components/public/TrackingPlaceholders";
import { MetaPixel } from "@/components/public/MetaPixel";
import { SecretAccessGate } from "@/components/public/SecretAccessGate";
import { getSiteContent, getSiteTheme } from "@/lib/content";
import { SITE_URL } from "@/lib/metadata";
import { getGlobalMetaPixelId } from "@/lib/meta-pixel-settings";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Public homepage typography reference. Scoped via CSS variable so it only
// applies where explicitly opted into (.cinematic-home) — the admin panel
// keeps its existing Geist typography untouched.
const plusJakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export async function generateMetadata(): Promise<Metadata> {
  const content = await getSiteContent();
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: "Manisa Dijital Pazarlama Ajansı | HK Dijital",
      template: `%s | ${content.brand.companyName}`
    },
    description: "HK Dijital; Manisa merkezli Meta reklam yönetimi, Google Ads, sosyal medya stratejisi, dönüşüm takibi ve dijital pazarlama danışmanlığı sunar.",
    applicationName: content.brand.companyName,
    alternates: {
      canonical: "/"
    },
    openGraph: {
      type: "website",
      locale: "tr_TR",
      url: SITE_URL,
      siteName: content.brand.companyName,
      title: "Manisa Dijital Pazarlama Ajansı | HK Dijital",
      description: "Manisa merkezli, Türkiye geneline hizmet veren dijital pazarlama ve reklam danışmanlığı ajansı."
    },
    twitter: {
      card: "summary_large_image",
      title: "Manisa Dijital Pazarlama Ajansı | HK Dijital",
      description: "Meta reklamları, Google Ads, sosyal medya stratejisi ve dönüşüm takibi için HK Dijital."
    },
    robots: {
      index: true,
      follow: true
    }
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const content = await getSiteContent();
  const theme = await getSiteTheme();
  const metaPixelId = await getGlobalMetaPixelId(content.settings.analyticsIds?.metaPixel || "");

  return (
    <html lang="tr" data-hk-theme={theme.name} style={{ "--hk-theme-bg": theme.background, "--hk-theme-surface": theme.surface, "--hk-theme-text": theme.text, "--hk-theme-muted": theme.mutedText, "--hk-theme-primary": theme.primaryButton, "--hk-theme-accent": theme.accent, "--hk-theme-border": theme.border } as React.CSSProperties} className={`${geistSans.variable} ${geistMono.variable} ${plusJakarta.variable} h-full scroll-smooth antialiased`}>
      <body className="min-h-full bg-[#050711] font-sans text-white">
        <TrackingPlaceholders ids={content.settings.analyticsIds} />
        <MetaPixel pixelId={metaPixelId} />
        {children}
        <SecretAccessGate />
      </body>
    </html>
  );
}
