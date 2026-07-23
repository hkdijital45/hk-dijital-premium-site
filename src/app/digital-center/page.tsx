import type { Metadata } from "next";
import { LoginForm } from "@/components/public/LoginForm";
import { Logo } from "@/components/public/Logo";
import { LoginShell3D } from "@/components/premium/PremiumUI";
import { getSiteContent } from "@/lib/content";

export const metadata: Metadata = {
  title: "HK Operating System — Giriş",
  description: "HK Dijital ajans operasyon merkezine güvenli, yalnızca yetkili erişim alanı.",
  robots: {
    index: false,
    follow: false,
    nocache: true
  }
};

export default async function DigitalCenterPage() {
  const content = await getSiteContent();

  return (
    <LoginShell3D logo={<Logo content={content} variant="login" />}>
      <LoginForm />
    </LoginShell3D>
  );
}
