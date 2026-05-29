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
      <main className="min-h-screen bg-[#050711] text-white">{children}</main>
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-5 right-5 z-40 rounded-full border border-cyan-200/30 bg-cyan-300 px-5 py-3 text-sm font-black text-slate-950 shadow-[0_0_44px_rgba(18,217,255,.35)]"
        >
          WhatsApp
        </a>
      )}
      <Footer content={content} />
    </>
  );
}
