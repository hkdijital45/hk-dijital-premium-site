import type { Metadata } from "next";
import { LoginForm } from "@/components/public/LoginForm";
import { PublicShell } from "@/components/public/Shell";
import { LoginShell3D } from "@/components/premium/PremiumUI";

export const metadata: Metadata = {
  title: "Giriş Yap | HK Dijital Marketing Center",
  description: "HK Dijital müşteri paneli veya yönetim merkezine güvenli giriş yapın."
};

export default function GirisPage() {
  return (
    <PublicShell>
      <LoginShell3D>
        <LoginForm />
      </LoginShell3D>
    </PublicShell>
  );
}
