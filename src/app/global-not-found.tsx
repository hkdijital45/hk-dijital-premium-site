import Image from "next/image";
import Link from "next/link";
import "./globals.css";

// Testing showed root app/not-found.tsx is NOT rendered for a genuinely
// unmatched URL in this Next.js build (confirmed with a minimal
// not-found.tsx that never appeared either) — only global-not-found.tsx,
// gated behind experimental.globalNotFound in next.config.ts, is. Per the
// framework's own file-convention docs, this file bypasses the normal
// root layout entirely and must be a full, self-contained HTML document
// (own <html>/<body>, own global style import) — PublicShell/Header/
// Footer assume they're nested inside the real root layout, so they
// can't be reused here; this intentionally stays light (no client JS,
// no extra font) per the same docs' own performance guidance for this
// page.
export const metadata = {
  title: "Sayfa Bulunamadı",
  description: "Aradığınız sayfa bulunamadı."
};

export default function GlobalNotFound() {
  return (
    <html lang="tr">
      <body style={{ margin: 0, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#050b14", color: "#e7faf8", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", padding: "24px" }}>
        <div style={{ maxWidth: 560, width: "100%", textAlign: "center" }}>
          <Image src="/branding/hk-dijital-logo-full.png" alt="HK Dijital" width={666} height={641} priority style={{ height: 72, width: "auto", margin: "0 auto 28px" }} />
          <p style={{ color: "#23D9CE", fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", fontSize: 13, margin: 0 }}>404</p>
          <h1 style={{ fontSize: 28, fontWeight: 900, margin: "12px 0 10px", color: "#ffffff" }}>Bu sayfa bulunamadı</h1>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: "#9fb3c8", margin: "0 0 32px" }}>
            Aradığınız sayfa taşınmış veya kaldırılmış olabilir. Ana sayfaya dönebilir ya da bizimle iletişime geçebilirsiniz.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center" }}>
            <Link
              href="/"
              style={{ background: "#107C73", color: "#fff", fontWeight: 800, fontSize: 14, padding: "12px 22px", borderRadius: 999, textDecoration: "none" }}
            >
              Ana Sayfaya Dön
            </Link>
            <Link
              href="/iletisim"
              style={{ background: "transparent", color: "#23D9CE", fontWeight: 800, fontSize: 14, padding: "12px 22px", borderRadius: 999, textDecoration: "none", border: "1px solid rgba(35,217,206,0.4)" }}
            >
              Bize Ulaşın
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
