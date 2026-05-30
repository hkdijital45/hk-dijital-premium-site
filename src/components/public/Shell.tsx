import type { ReactNode } from "react";
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

  return (
    <>
      <Header content={content} />
      <main className="min-h-screen bg-background text-foreground">{children}</main>
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-5 right-5 z-40 rounded-full border border-[#25D366]/40 bg-[#25D366] px-5 py-3 text-sm font-black text-white shadow-[0_0_44px_rgba(37,211,102,.35)]"
        >
          WhatsApp
        </a>
      )}
      <Footer content={content} />
    </>
  );
}
