import type { Metadata } from "next";
import { validateConnectToken, getCompanyDisplayName } from "@/lib/connect-links";
import { ConnectFlow } from "@/components/connect/ConnectFlow";

export const metadata: Metadata = { title: "HK Dijital — Hesap Bağlantısı", robots: { index: false, follow: false } };

const REASON_LABEL: Record<string, string> = {
  NOT_FOUND: "Bu bağlantı geçersiz.",
  EXPIRED: "Bu bağlantının süresi dolmuş.",
  REVOKED: "Bu bağlantı iptal edilmiş.",
  USED: "Bu bağlantıdaki tüm bağlantılar zaten tamamlanmış."
};

export default async function ConnectPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ integration_success?: string; integration_error?: string }> }) {
  const { token } = await params;
  const query = await searchParams;
  const validation = await validateConnectToken(token);

  if (!validation.valid) {
    return (
      <Shell>
        <p className="text-lg font-black">{REASON_LABEL[validation.reason] || "Bu bağlantı geçersiz."}</p>
        <p className="mt-2 text-sm text-slate-500">Yeni bir bağlantı linki için HK Dijital ile iletişime geçin.</p>
      </Shell>
    );
  }

  if (query.integration_error) {
    return (
      <Shell>
        <p className="text-lg font-black text-[#b91c1c]">Bağlantı tamamlanamadı.</p>
        <p className="mt-2 text-sm text-slate-500">Lütfen tekrar deneyin.</p>
        <ConnectFlow token={token} requested={validation.requestedCapabilities} initialCompleted={validation.completedCapabilities} justAuthorized={null} />
      </Shell>
    );
  }

  const companyName = await getCompanyDisplayName(validation.companyId);
  const justAuthorized = query.integration_success === "meta" || query.integration_success === "google" || query.integration_success === "tiktok" ? query.integration_success : null;

  return (
    <Shell>
      <p className="text-lg font-black">Merhaba{companyName ? `, ${companyName}` : ""} 👋</p>
      <p className="mt-2 text-sm text-slate-500">
        HK Dijital, {companyName || "işletmeniz"} adına dijital pazarlama hesaplarınıza erişim istiyor. Her bağlantı için ilgili platformun kendi resmi giriş ekranına yönlendirilirsiniz — şifreniz hiçbir zaman HK Dijital&apos;e iletilmez.
      </p>
      <ConnectFlow token={token} requested={validation.requestedCapabilities} initialCompleted={validation.completedCapabilities} justAuthorized={justAuthorized} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", background: "#0b0b10", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#ffffff", borderRadius: 16, padding: 28 }}>
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">HK Dijital</p>
        <div className="mt-3 text-slate-900">{children}</div>
      </div>
    </div>
  );
}
