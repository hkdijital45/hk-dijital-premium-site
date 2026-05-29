import type { Metadata } from "next";
import { PublicShell } from "@/components/public/Shell";
import { PageHero } from "@/components/public/ui";
import { SetupAdminForm } from "@/components/public/SetupAdminForm";

export const metadata: Metadata = {
  title: "Kurulum | HK Dijital Kontrol Merkezi",
  description: "HK Dijital Kontrol Merkezi için ilk yönetici hesabını oluşturun."
};

export default function KurulumPage() {
  return (
    <PublicShell>
      <PageHero
        eyebrow="İlk Kurulum"
        title="HK Dijital Kontrol Merkezi Kurulumu"
        text="Supabase Auth üzerinde ilk yönetici hesabını güvenli şekilde oluşturun."
      />
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <SetupAdminForm />
      </section>
    </PublicShell>
  );
}
