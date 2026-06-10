import type { ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { getSiteContent } from "@/lib/content";
import { Header } from "./Header";
import { Footer } from "./Footer";

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

  return (
    <>
      <Header content={content} />
      <main className={`public-site public-performance-${performanceMode} relative min-h-screen overflow-hidden bg-background text-foreground`}>
        <div className="public-impact-bg pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
        <div className="public-impact-grid pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
        {performanceMode === "ultra" && <div className="public-impact-particles pointer-events-none fixed inset-0 z-0" aria-hidden="true" />}
        <div className="relative z-10">{children}</div>
      </main>
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          aria-label="WhatsApp üzerinden iletişime geçin"
          className="impact-btn fixed bottom-5 right-5 z-40 inline-flex min-h-12 items-center gap-2 rounded-full border border-[#25D366]/50 bg-[#25D366] px-5 py-3 text-sm font-black text-white shadow-[0_0_44px_rgba(37,211,102,.35)] transition hover:-translate-y-1 hover:bg-[#20bd5b]"
        >
          <MessageCircle size={18} /> WhatsApp
        </a>
      )}
      <Footer content={content} />
    </>
  );
}
