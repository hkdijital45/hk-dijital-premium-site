// Raw HTML twin of app/global-not-found.tsx's visual design, for the one
// call site that can't render a React Server Component: the
// [indexnowKey]/route.ts Route Handler, which also matches every other
// single-segment unmatched URL and must return a plain Response, not a
// rendered page. Keep this in visual sync with global-not-found.tsx by
// hand — there are only these two places this content lives.
export const BRANDED_NOT_FOUND_HTML = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>Sayfa Bulunamadı</title>
</head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#050b14;color:#e7faf8;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:24px;">
<div style="max-width:560px;width:100%;text-align:center;">
<img src="/branding/hk-dijital-logo-full.png" alt="HK Dijital" width="666" height="641" style="height:72px;width:auto;margin:0 auto 28px;display:block;" />
<p style="color:#23D9CE;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;font-size:13px;margin:0;">404</p>
<h1 style="font-size:28px;font-weight:900;margin:12px 0 10px;color:#ffffff;">Bu sayfa bulunamadı</h1>
<p style="font-size:15px;line-height:1.7;color:#9fb3c8;margin:0 0 32px;">Aradığınız sayfa taşınmış veya kaldırılmış olabilir. Ana sayfaya dönebilir ya da bizimle iletişime geçebilirsiniz.</p>
<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;">
<a href="/" style="background:#107C73;color:#fff;font-weight:800;font-size:14px;padding:12px 22px;border-radius:999px;text-decoration:none;">Ana Sayfaya Dön</a>
<a href="/iletisim" style="background:transparent;color:#23D9CE;font-weight:800;font-size:14px;padding:12px 22px;border-radius:999px;text-decoration:none;border:1px solid rgba(35,217,206,0.4);">Bize Ulaşın</a>
</div>
</div>
</body>
</html>
`;
