import type { Metadata } from "next";
import { LoginForm } from "@/components/public/LoginForm";
import { PublicShell } from "@/components/public/Shell";
import { PageHero } from "@/components/public/ui";

export const metadata: Metadata = {
  title: "Giriş Yap | HK Dijital Marketing Center",
  description: "HK Dijital müşteri paneli veya yönetim merkezine güvenli giriş yapın."
};

export default function GirisPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Güvenli Giriş"
        title="HK Dijital Marketing Center"
        text="Müşteri panelinize veya yönetim merkezine güvenli giriş yapın."
      />
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <LoginForm />
      </section>
    </PublicShell>
  );
}
