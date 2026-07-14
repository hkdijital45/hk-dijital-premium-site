import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/public/ResetPasswordForm";
import { getSession, isCustomerPasswordChangeRequired, isCustomerRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Yeni Şifre Belirleyin | HK Dijital",
  description: "HK Dijital hesabınız için güvenli bir şifre belirleyin."
};

export default async function ForcedPasswordChangePage() {
  const session = await getSession();
  if (!session) redirect("/digital-center");
  if (!isCustomerRole(session.role)) redirect("/hk-admin");
  if (!isCustomerPasswordChangeRequired(session)) redirect("/musteri-paneli");

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#020617] px-4 py-10 text-white">
      <div className="premium-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(34,211,238,.18),transparent_38%),radial-gradient(circle_at_15%_85%,rgba(250,204,21,.10),transparent_34%)]" aria-hidden="true" />
      <section className="relative z-10 w-full max-w-xl">
        <div className="mb-6 text-center">
          <p className="text-xs font-black uppercase tracking-[.22em] text-cyan-200">HK Dijital</p>
          <h1 className="mt-4 text-3xl font-black sm:text-4xl">Yeni Şifre Belirleyin</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">Güvenliğiniz için geçici şifrenizi değiştirmeniz gerekiyor.</p>
        </div>
        <ResetPasswordForm mode="forced" />
      </section>
    </main>
  );
}
