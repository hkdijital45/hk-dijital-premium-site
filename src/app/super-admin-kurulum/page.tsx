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
        text={process.env.FORCE_BOOTSTRAP_ADMIN === "true" ? "Supabase Auth kullanıcısını ve public.users profil bağlantısını güvenli şekilde oluşturun veya onarın." : "Süper admin kurulumu kapalı."}
      />
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <SuperAdminBootstrapForm enabled={process.env.FORCE_BOOTSTRAP_ADMIN === "true"} />
      </section>
    </PublicShell>
  );
}
