import type { Metadata } from "next";
import { PublicShell } from "@/components/public/Shell";
import { PageHero } from "@/components/public/ui";
import { SuperAdminBootstrapForm } from "@/components/public/SuperAdminBootstrapForm";

export const metadata: Metadata = {
  title: "Süper Admin Kurulumu | HK Dijital Kontrol Merkezi",
  description: "HK Dijital için geçici süper admin oluşturma ve onarma ekranı."
};

export default function SuperAdminKurulumPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="Acil Yönetici Onarımı"
        title="Süper Admin Kurulumu"
        text="Supabase Auth kullanıcısını ve public.users profil bağlantısını güvenli şekilde oluşturun veya onarın."
      />
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <SuperAdminBootstrapForm />
      </section>
    </PublicShell>
  );
}
