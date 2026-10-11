import type { Metadata } from "next";
import { Geist, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { TrackingPlaceholders } from "@/components/public/TrackingPlaceholders";
import { MetaPixel } from "@/components/public/MetaPixel";
import { FirstPartyAnalytics } from "@/components/public/FirstPartyAnalytics";
import { SecretAccessGate } from "@/components/public/SecretAccessGate";
import { getLayoutSiteContent, getSiteTheme } from "@/lib/content";
import { SITE_URL } from "@/lib/metadata";
import { getGlobalMetaPixelId } from "@/lib/meta-pixel-settings";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Public homepage typography reference. Scoped via CSS variable so it only
// applies where explicitly opted into (.cinematic-home) — the admin panel
// keeps its existing Geist typography untouched.
const plusJakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

export async function generateMetadata(): Promise<Metadata> {
  const { companyName } = await getLayoutSiteContent();
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: "Manisa Dijital Pazarlama Ajansı | HK Dijital",
      template: `%s | ${companyName}`
    },
    description: "HK Dijital; Manisa merkezli Meta reklam yönetimi, Google Ads, sosyal medya stratejisi, dönüşüm takibi ve dijital pazarlama danışmanlığı sunar.",
    applicationName: companyName,
    alternates: {
      canonical: "/"
    },
    openGraph: {
      type: "website",
      locale: "tr_TR",
      url: SITE_URL,
      siteName: companyName,
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
  // Perf fix (2026-10-11): these three used to run as sequential awaits,
  // each a separate Supabase round trip (and the first used to fetch the
  // ENTIRE site_settings row just for a company name + 3 analytics IDs —
  // see getLayoutSiteContent) — stacking on every single page load
  // sitewide. Independently-measured live TTFB (~2.3-2.8s) traced back to
  // exactly this kind of avoidable waterfall. Now narrow and parallel.
  const [{ analyticsIds }, theme] = await Promise.all([getLayoutSiteContent(), getSiteTheme()]);
  const metaPixelId = await getGlobalMetaPixelId(analyticsIds?.metaPixel || "");

  return (
    <html lang="tr" data-hk-theme={theme.name} style={{ "--hk-theme-bg": theme.background, "--hk-theme-surface": theme.surface, "--hk-theme-text": theme.text, "--hk-theme-muted": theme.mutedText, "--hk-theme-primary": theme.primaryButton, "--hk-theme-accent": theme.accent, "--hk-theme-border": theme.border } as React.CSSProperties} className={`${geistSans.variable} ${geistMono.variable} ${plusJakarta.variable} h-full scroll-smooth antialiased`}>
      <body className="min-h-full bg-[#050711] font-sans text-white">
        <TrackingPlaceholders ids={analyticsIds} />
        <FirstPartyAnalytics />
        <MetaPixel pixelId={metaPixelId} />
        {children}
        <SecretAccessGate />
      </body>
    </html>
  );
}
