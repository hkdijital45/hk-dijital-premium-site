import type { Metadata } from "next";
import { Camera, Mail, MessageCircle, Phone } from "lucide-react";
import { getSiteContent } from "@/lib/content";
import { pageMetadata } from "@/lib/metadata";
import { PublicShell } from "@/components/public/Shell";
import { AnimatedSection } from "@/components/public/AnimatedSection";
import { PageHero, PremiumCard } from "@/components/public/ui";
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
      <PageHero eyebrow="İletişim" title="HK Dijital ile strateji görüşmesi başlatın" text={content.pages.contact.intro} />
      <AnimatedSection className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_.9fr]">
          <ContactForm />
          <div className="grid gap-4">
            <PremiumCard><MessageCircle className="text-cyan-200" /><h2 className="mt-4 font-black">WhatsApp CTA</h2><a className="mt-3 block text-slate-300" href={whatsappUrl}>WhatsApp üzerinden yazın</a></PremiumCard>
            <PremiumCard><Camera className="text-cyan-200" /><h2 className="mt-4 font-black">Instagram CTA</h2><a className="mt-3 block text-slate-300" href={content.socials.instagram}>Instagram profilini aç</a></PremiumCard>
            <PremiumCard><Mail className="text-cyan-200" /><h2 className="mt-4 font-black">E-posta CTA</h2><a className="mt-3 block text-slate-300" href={`mailto:${content.contact.email}`}>{content.contact.email}</a></PremiumCard>
            <PremiumCard><Phone className="text-cyan-200" /><h2 className="mt-4 font-black">Hizmet alanı</h2><p className="mt-3 text-slate-300">{content.contact.address}</p></PremiumCard>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-7xl">
          <PremiumCard>
            {content.contact.mapsEmbedUrl ? (
              <iframe src={content.contact.mapsEmbedUrl} className="h-80 w-full rounded-[8px]" loading="lazy" title="HK Dijital Google Maps" />
            ) : (
              <div className="grid h-80 place-items-center rounded-[8px] border border-dashed border-white/15 text-center text-slate-400">
                Google Maps embed alanı admin panelinden yönetilebilir.
              </div>
            )}
          </PremiumCard>
        </div>
      </AnimatedSection>
    </PublicShell>
  );
}
