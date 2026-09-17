import type { Metadata } from "next";
import { validateConnectToken, getCompanyDisplayName } from "@/lib/connect-links";

export const metadata: Metadata = { title: "HK Dijital — Hesap Bağlantısı", robots: { index: false, follow: false } };

const REASON_LABEL: Record<string, string> = {
  NOT_FOUND: "Bu bağlantı geçersiz.",
  EXPIRED: "Bu bağlantının süresi dolmuş.",
  REVOKED: "Bu bağlantı iptal edilmiş.",
  USED: "Bu bağlantı zaten kullanılmış."
};

export default async function ConnectPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ status?: string; integration_success?: string; integration_error?: string }> }) {
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

  if (query.integration_success) {
    return (
      <Shell>
        <p className="text-lg font-black text-[#15803d]">Bağlantı başarıyla tamamlandı ✓</p>
        <p className="mt-2 text-sm text-slate-500">Bu pencereyi kapatabilirsiniz. HK Dijital ekibi bağlantınızı kısa süre içinde kullanmaya başlayacak.</p>
      </Shell>
    );
  }
  if (query.integration_error) {
    return (
      <Shell>
        <p className="text-lg font-black text-[#b91c1c]">Bağlantı tamamlanamadı.</p>
        <p className="mt-2 text-sm text-slate-500">Lütfen tekrar deneyin. Sorun devam ederse HK Dijital ile iletişime geçin.</p>
        <Actions token={token} />
      </Shell>
    );
  }

  const companyName = await getCompanyDisplayName(validation.companyId);
  return (
    <Shell>
      <p className="text-lg font-black">Merhaba{companyName ? `, ${companyName}` : ""} 👋</p>
      <p className="mt-2 text-sm text-slate-500">
        HK Dijital, {companyName || "işletmeniz"} adına dijital pazarlama hesaplarınıza erişim istiyor. Aşağıdaki bağlantıyı seçtiğinizde ilgili platformun kendi resmi giriş ekranına yönlendirilirsiniz — şifreniz hiçbir zaman HK Dijital&apos;e iletilmez.
      </p>
      <Actions token={token} />
    </Shell>
  );
}

function Actions({ token }: { token: string }) {
  const metaConfigured = Boolean(process.env.META_CLIENT_ID && process.env.META_CLIENT_SECRET);
  const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  return (
    <div className="mt-6 grid gap-3">
      {metaConfigured && (
        <a href={`/api/integrations/meta/connect?connectToken=${encodeURIComponent(token)}`} className="rounded-[10px] px-4 py-3 text-center text-sm font-black text-white" style={{ background: "#1877F2" }}>
          Facebook / Instagram / Meta Ads ile Bağlan
        </a>
      )}
      {googleConfigured && (
        <a href={`/api/integrations/google/connect?connectToken=${encodeURIComponent(token)}`} className="rounded-[10px] border px-4 py-3 text-center text-sm font-black" style={{ borderColor: "#e2e2e2" }}>
          Google Ads / GA4 / Search Console ile Bağlan
        </a>
      )}
      {!metaConfigured && !googleConfigured && <p className="text-sm text-slate-500">Şu anda bağlantı seçeneği yapılandırılmamış. HK Dijital ile iletişime geçin.</p>}
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100dvh", background: "#0b0b10", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#ffffff", borderRadius: 16, padding: 28 }}>
        <p className="text-xs font-black uppercase tracking-wide text-slate-400">HK Dijital</p>
        <div className="mt-3 text-slate-900">{children}</div>
      </div>
    </div>
  );
}
