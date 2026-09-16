import type { ReactNode } from "react";
import { getSiteContent } from "@/lib/content";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { ScrollProgressBar } from "./ScrollProgressBar";
import { ContactDock } from "./ContactDock";
import { CursorGlow } from "./motion/CursorGlow";
import { RouteFade } from "./motion/RouteFade";

export async function PublicShell({ children }: { children: ReactNode }) {
  const rawContent = await getSiteContent();
  const content = {
    ...rawContent,
    settings: {
      ...rawContent.settings,
      api: { ...rawContent.settings.api, geminiApiKey: "", groqApiKey: "", openAiApiKey: "" }
    }
  };
  const whatsappUrl =
    content.socials.whatsapp ||
    (content.contact.whatsappNumber
      ? `https://wa.me/${content.contact.whatsappNumber.replace(/\D/g, "")}`
      : "");
  const performanceMode = content.settings.performanceMode || "balanced";
  const phoneHref = content.contact.phone ? `tel:${content.contact.phone.replace(/[^\d+]/g, "")}` : "";

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
