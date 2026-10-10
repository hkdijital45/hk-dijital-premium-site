import { resolvePublicTelHref, resolvePublicWhatsappUrl } from "@/lib/public-contact";
import type { ReactNode } from "react";
import { getPublicPerformanceMode, getPublicSiteContent } from "@/lib/content";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { ScrollProgressBar } from "./ScrollProgressBar";
import { ContactDock } from "./ContactDock";
import { CursorGlow } from "./motion/CursorGlow";
import { RouteFade } from "./motion/RouteFade";

export async function PublicShell({ children }: { children: ReactNode }) {
  // getPublicSiteContent/getPublicPerformanceMode query only the named
  // public fields directly from Supabase (PostgREST JSON-path select) —
  // see their doc comments in src/lib/content.ts. Neither ever touches the
  // full site_settings row (~3.2 MB in production, shared with real
  // leads/users/customer data that must never reach a "use client"
  // component like Header/Footer below — see PublicSiteContent in
  // types.ts for the security reasoning).
  const [content, performanceMode] = await Promise.all([getPublicSiteContent(), getPublicPerformanceMode()]);
  const whatsappUrl = resolvePublicWhatsappUrl(content.socials.whatsapp, content.contact.whatsappNumber, undefined, content.contact.whatsappDefaultMessage);
  const phoneHref = resolvePublicTelHref(content.contact.phone);

  return (
    <>
      <ScrollProgressBar />
      <CursorGlow />
      <Header content={content} />
      <main className={`public-site public-performance-${performanceMode} relative min-h-screen overflow-hidden bg-background text-foreground`}>
        <div className="public-impact-bg pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
        <div className="public-impact-grid pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
        {performanceMode === "ultra" && <div className="public-impact-particles pointer-events-none fixed inset-0 z-0" aria-hidden="true" />}
        <div className="relative z-10"><RouteFade>{children}</RouteFade></div>
      </main>
      <ContactDock whatsappUrl={whatsappUrl} phoneHref={phoneHref} phoneLabel={content.contact.phone} />
      <Footer content={content} />
    </>
  );
}
