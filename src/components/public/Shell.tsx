import { resolvePublicTelHref, resolvePublicWhatsappUrl } from "@/lib/public-contact";
import type { ReactNode } from "react";
import type { PublicSiteContent } from "@/lib/types";
import { getSiteContent } from "@/lib/content";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { ScrollProgressBar } from "./ScrollProgressBar";
import { ContactDock } from "./ContactDock";
import { CursorGlow } from "./motion/CursorGlow";
import { RouteFade } from "./motion/RouteFade";

export async function PublicShell({ children }: { children: ReactNode }) {
  const rawContent = await getSiteContent();
  // CRITICAL (2026-10-11): rawContent is the shared site_settings row — in
  // production it also carries real leads/users/customer documents/
  // integration credentials/ad metrics (none of that is on the SiteContent
  // type, but it's on the real row, and an object spread copies it anyway).
  // Header/Footer below are "use client" — whatever object they receive
  // gets serialized into the page's RSC payload and is visible to anyone
  // who views source. Only ever pass this named, explicit subset — never
  // `{ ...rawContent }` — see PublicSiteContent's definition in types.ts.
  const content: PublicSiteContent = {
    brand: rawContent.brand,
    socials: rawContent.socials,
    contact: rawContent.contact,
    services: rawContent.services
  };
  const whatsappUrl = resolvePublicWhatsappUrl(content.socials.whatsapp, content.contact.whatsappNumber);
  const performanceMode = rawContent.settings.performanceMode || "balanced";
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
