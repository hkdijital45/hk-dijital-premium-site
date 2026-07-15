import Link from "next/link";
import { PublicShell } from "@/components/public/Shell";
import { PremiumCard } from "@/components/public/ui";

type LegalSection = {
  title: string;
  items: string[];
};

export function LegalPage({
  eyebrow,
  title,
  description,
  sections
}: {
  eyebrow: string;
  title: string;
  description: string;
  sections: LegalSection[];
}) {
  return (
    <PublicShell>
      <section className="relative overflow-hidden px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-black uppercase tracking-[.24em] text-cyan-200">{eyebrow}</p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-6xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300">{description}</p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold text-slate-400">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">Marka: HK Dijital</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">Domain: https://www.hkdijital.com.tr</span>
            <a className="rounded-full border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-cyan-100" href="mailto:hayrikamali@icloud.com">hayrikamali@icloud.com</a>
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-5">
          {sections.map((section) => (
            <PremiumCard key={section.title}>
              <h2 className="text-2xl font-black text-white">{section.title}</h2>
              <ul className="mt-5 grid gap-3 text-sm leading-7 text-slate-300">
                {section.items.map((item) => (
                  <li key={item} className="rounded-[14px] border border-white/10 bg-white/[0.04] p-4">{item}</li>
                ))}
              </ul>
            </PremiumCard>
          ))}
          <PremiumCard>
            <h2 className="text-2xl font-black text-white">İletişim</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              Bu sayfa ve HK Dijital hizmetleriyle ilgili talepleriniz için <a className="font-black text-cyan-100" href="mailto:hayrikamali@icloud.com">hayrikamali@icloud.com</a> adresine yazabilirsiniz.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-white" href="/gizlilik-politikasi">Gizlilik Politikası</Link>
              <Link className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-white" href="/kullanim-sartlari">Kullanım Şartları</Link>
              <Link className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-white" href="/veri-silme">Veri Silme</Link>
            </div>
          </PremiumCard>
        </div>
      </section>
    </PublicShell>
  );
}
