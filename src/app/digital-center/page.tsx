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
        <LoginForm />
      </LoginShell3D>
    </PublicShell>
  );
}
