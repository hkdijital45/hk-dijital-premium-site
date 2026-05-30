import type { Metadata } from "next";
import { PublicShell } from "@/components/public/Shell";
import { PageHero } from "@/components/public/ui";
import { AuthCallbackHandler } from "@/components/public/AuthCallbackHandler";

export const metadata: Metadata = {
  title: "Güvenli Yönlendirme | HK Dijital Marketing Center",
  description: "HK Dijital Marketing Center güvenli auth callback yönlendirme sayfası."
};

export default function AuthCallbackPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Güvenli Yönlendirme"
        title="İşleminiz Kontrol Ediliyor"
        text="Giriş veya şifre yenileme işleminiz güvenli şekilde ilgili ekrana yönlendiriliyor."
      />
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <AuthCallbackHandler />
      </section>
    </PublicShell>
  );
}
