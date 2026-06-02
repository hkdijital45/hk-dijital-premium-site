import type { Metadata } from "next";
import { LoginForm } from "@/components/public/LoginForm";
import { PublicShell } from "@/components/public/Shell";
import { Logo } from "@/components/public/Logo";
import { LoginShell3D } from "@/components/premium/PremiumUI";
import { getSiteContent } from "@/lib/content";

export const metadata: Metadata = {
  title: "Giriş Yap | HK Dijital Marketing Center",
  description: "HK Dijital müşteri paneli veya yönetim merkezine güvenli giriş yapın."
};

export default async function GirisPage() {
  const content = await getSiteContent();
  return (
    <PublicShell>
      <LoginShell3D logo={<Logo content={content} />}>
        <LoginForm />
      </LoginShell3D>
    </PublicShell>
  );
}
