import Link from "next/link";
import { PublicShell } from "@/components/public/Shell";
import { MarketingCard } from "@/components/public/marketing/MarketingUI";

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
      <div className="marketing-shell">
        <section className="relative overflow-hidden border-b px-4 py-20 sm:px-6 lg:px-8 lg:py-28" style={{ borderColor: "var(--mk-border)" }}>
          <div className="mx-auto max-w-5xl">
            <p className="marketing-eyebrow">{eyebrow}</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-6xl" style={{ color: "var(--mk-ink)" }}>{title}</h1>
            <p className="mt-5 max-w-3xl text-base leading-8" style={{ color: "var(--mk-ink-soft)" }}>{description}</p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold" style={{ color: "var(--mk-ink-faint)" }}>
              <span className="rounded-full border px-3 py-2" style={{ borderColor: "var(--mk-border)", background: "var(--mk-bg-alt)" }}>Marka: HK Dijital</span>
              <span className="rounded-full border px-3 py-2" style={{ borderColor: "var(--mk-border)", background: "var(--mk-bg-alt)" }}>Domain: https://www.hkdijital.com.tr</span>
              <a className="rounded-full border px-3 py-2" style={{ borderColor: "var(--mk-border-strong)", color: "var(--mk-violet)" }} href="mailto:hayrikamali@icloud.com">hayrikamali@icloud.com</a>
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-5xl gap-5">
            {sections.map((section) => (
              <MarketingCard key={section.title} className="p-7">
                <h2 className="text-2xl font-black" style={{ color: "var(--mk-ink)" }}>{section.title}</h2>
                <ul className="mt-5 grid gap-3 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>
                  {section.items.map((item) => (
                    <li key={item} className="rounded-xl border p-4" style={{ borderColor: "var(--mk-border)", background: "var(--mk-bg-alt)" }}>{item}</li>
                  ))}
                </ul>
              </MarketingCard>
            ))}
            <MarketingCard className="p-7">
              <h2 className="text-2xl font-black" style={{ color: "var(--mk-ink)" }}>İletişim</h2>
              <p className="mt-4 text-sm leading-7" style={{ color: "var(--mk-ink-soft)" }}>
                Bu sayfa ve HK Dijital hizmetleriyle ilgili talepleriniz için <a className="font-black" style={{ color: "var(--mk-violet)" }} href="mailto:hayrikamali@icloud.com">hayrikamali@icloud.com</a> adresine yazabilirsiniz.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link className="marketing-btn marketing-btn-secondary" href="/gizlilik-politikasi">Gizlilik Politikası</Link>
                <Link className="marketing-btn marketing-btn-secondary" href="/kullanim-sartlari">Kullanım Şartları</Link>
                <Link className="marketing-btn marketing-btn-secondary" href="/veri-silme">Veri Silme</Link>
              </div>
            </MarketingCard>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
