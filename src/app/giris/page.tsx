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

export default async function GirisPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const content = await getSiteContent();
  const params = await searchParams;
  const desktopMode = params?.desktop === "1";

  if (desktopMode) {
    return (
      <main className="grid min-h-screen place-items-center overflow-hidden bg-[#050711] px-5 py-10 text-white">
        <div className="premium-grid pointer-events-none absolute inset-0 opacity-55" />
        <div className="relative w-full max-w-md">
          <div className="mb-7 flex flex-col items-center text-center">
            <Logo content={content} />
            <span className="mt-5 rounded-full border border-amber-200/25 bg-amber-300/12 px-3 py-1 text-[10px] font-black uppercase tracking-[.16em] text-amber-100">Desktop</span>
            <h1 className="mt-4 text-3xl font-black tracking-tight">HK Intelligence</h1>
            <p className="mt-2 text-sm font-semibold text-slate-400">Yönetim panelini açmak için güvenli oturum açın.</p>
          </div>
          <LoginForm desktopMode />
        </div>
      </main>
    );
  }

  return (
    <PublicShell>
      <LoginShell3D logo={<Logo content={content} />}>
        <LoginForm />
      </LoginShell3D>
    </PublicShell>
  );
}
