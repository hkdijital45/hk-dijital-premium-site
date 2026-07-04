import type { Metadata } from "next";
import { LoginForm } from "@/components/public/LoginForm";
import { PublicShell } from "@/components/public/Shell";
import { Logo } from "@/components/public/Logo";
import { LoginShell3D } from "@/components/premium/PremiumUI";
import { getSiteContent } from "@/lib/content";

export const metadata: Metadata = {
  title: "Digital Center | HK Dijital",
  description: "HK Dijital rapor, proje ve dijital performans verilerine güvenli erişim alanı."
};

export default async function DigitalCenterPage() {
  const content = await getSiteContent();

  return (
    <PublicShell>
      <LoginShell3D logo={<Logo content={content} />}>
        <section className="mx-auto mb-5 grid max-w-3xl gap-3 sm:grid-cols-3">
          {[
            ["Admin OS", "Ajans operasyonu, reklam, CRM ve rapor yönetimi tek merkezde."],
            ["Müşteri Paneli", "Rapor, dosya, ödeme ve hesap bağlama akışı sade görünür."],
            ["Güvenli Entegrasyon", "API key ve tokenlar frontend’e dönmeden sunucu tarafında yönetilir."]
          ].map(([title, text]) => (
            <div key={title} className="rounded-[18px] border border-white/10 bg-white/[0.07] p-4 text-left shadow-[0_18px_55px_rgba(0,0,0,.22)] backdrop-blur-xl">
              <p className="text-xs font-black uppercase tracking-[.16em] text-cyan-100">{title}</p>
              <p className="mt-2 text-xs leading-5 text-slate-300">{text}</p>
            </div>
          ))}
        </section>
        <LoginForm />
      </LoginShell3D>
    </PublicShell>
  );
}
