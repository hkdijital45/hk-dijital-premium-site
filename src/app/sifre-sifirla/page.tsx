import type { Metadata } from "next";
import { PublicShell } from "@/components/public/Shell";
import { PageHero } from "@/components/public/ui";
import { ResetPasswordForm } from "@/components/public/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Şifre Sıfırla | HK Dijital Marketing Center",
  description: "HK Dijital Marketing Center hesabınız için yeni şifre oluşturun."
};

export default function SifreSifirlaPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Güvenli Şifre İşlemi"
        title="Şifrenizi Yenileyin"
        text="E-posta adresinize gelen güvenli bağlantı ile HK Dijital Marketing Center hesabınız için yeni şifre belirleyin."
      />
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <ResetPasswordForm />
      </section>
    </PublicShell>
  );
}
