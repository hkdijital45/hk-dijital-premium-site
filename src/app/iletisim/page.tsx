import type { Metadata } from "next";
import { Camera, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { getSiteContent } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { PublicShell } from "@/components/public/Shell";
import { MarketingCard, MarketingPageHero, MarketingReveal, MarketingSection } from "@/components/public/marketing/MarketingUI";
import { ContactForm } from "@/components/public/ContactForm";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata("contact");
}

export default async function ContactPage() {
  const content = await getSiteContent();
  const whatsappUrl = content.socials.whatsapp || `https://wa.me/${content.contact.whatsappNumber.replace(/\D/g, "")}`;

  return (
    <PublicShell>
      <div className="marketing-shell">
        <MarketingPageHero eyebrow="İletişim" title="HK Dijital ile strateji görüşmesi başlatın" text={content.pages.contact.intro} />
        <MarketingSection>
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_.9fr] lg:px-8">
            <MarketingReveal><ContactForm /></MarketingReveal>
            <div className="grid gap-4">
              <MarketingCard className="p-6"><MessageCircle className="text-[#7c3aed]" /><h2 className="mt-4 font-black" style={{ color: "var(--mk-ink)" }}>WhatsApp ile Hızlı İletişim</h2><a className="mt-3 block text-sm font-bold" style={{ color: "var(--mk-violet)" }} href={whatsappUrl}>WhatsApp&apos;tan Yazın</a></MarketingCard>
              <MarketingCard className="p-6"><Camera className="text-[#7c3aed]" /><h2 className="mt-4 font-black" style={{ color: "var(--mk-ink)" }}>Instagram&apos;da Takip Edin</h2><a className="mt-3 block text-sm font-bold" style={{ color: "var(--mk-violet)" }} href={content.socials.instagram}>Instagram Profilimizi Ziyaret Edin</a></MarketingCard>
              <MarketingCard className="p-6"><Mail className="text-[#7c3aed]" /><h2 className="mt-4 font-black" style={{ color: "var(--mk-ink)" }}>E-posta Gönderin</h2><a className="mt-3 block text-sm font-bold" style={{ color: "var(--mk-violet)" }} href={`mailto:${content.contact.email}`}>Teklif İçin Mail Gönderin</a></MarketingCard>
              <MarketingCard className="p-6"><Phone className="text-[#7c3aed]" /><h2 className="mt-4 font-black" style={{ color: "var(--mk-ink)" }}>Bizi Arayın</h2><a className="mt-3 block text-sm font-bold" style={{ color: "var(--mk-violet)" }} href={`tel:${content.contact.phone.replace(/\s/g, "")}`}>{content.contact.phone}</a></MarketingCard>
              <MarketingCard className="p-6"><MapPin className="text-[#7c3aed]" /><h2 className="mt-4 font-black" style={{ color: "var(--mk-ink)" }}>Hizmet Alanımız</h2><p className="mt-3 text-sm" style={{ color: "var(--mk-ink-soft)" }}>{content.contact.address}</p></MarketingCard>
            </div>
          </div>
          <div className="mx-auto mt-8 max-w-7xl px-4 sm:px-6 lg:px-8">
            <MarketingCard className="p-6">
              {content.contact.mapsEmbedUrl ? (
                <iframe src={content.contact.mapsEmbedUrl} className="h-80 w-full rounded-xl" loading="lazy" title="HK Dijital Google Maps" />
              ) : (
                <div className="grid h-80 place-items-center rounded-xl border border-dashed text-center" style={{ borderColor: "var(--mk-border-strong)", color: "var(--mk-ink-faint)" }}>
                  Konum ve görüşme detayları iletişim talebiniz sonrasında paylaşılır.
                </div>
              )}
            </MarketingCard>
          </div>
        </MarketingSection>
      </div>
    </PublicShell>
  );
}
