import { NextResponse } from "next/server";
import { getSiteContent, getSiteContentVersion, saveSiteContentIfUnchanged } from "@/lib/content";
import { requireModuleAccess } from "@/lib/permissions";
import type { SiteContent } from "@/lib/types";
import { validateContactAndSocials } from "@/lib/public-contact-validation";
import { findUnauthorizedTopLevelKeys } from "@/lib/site-content-allowlist";

const sensitiveApiKeys = [
  "geminiApiKey",
  "groqApiKey",
  "openAiApiKey",
  "meta_app_secret",
  "meta_access_token",
  "google_maps_key",
  "google_ads_key",
  "smtp_password",
  "webhook_secret"
];

function withoutApiKeys(content: SiteContent) {
  const api = { ...content.settings.api } as SiteContent["settings"]["api"];
  sensitiveApiKeys.forEach((key) => {
    if (key in api) api[key] = "";
  });
  return {
    ...content,
    settings: {
      ...content.settings,
      api
    }
  };
}

export async function GET() {
  // CRITICAL FIX (2026-10-11): this had no auth check at all — anyone,
  // unauthenticated, could GET the entire site_content blob (real leads,
  // user accounts, customer documents/integrations with encrypted tokens,
  // ad metrics, etc. — everything saveSiteContent/PUT ever wrote here,
  // since this table is shared storage for far more than public CMS
  // copy). PUT already required "site-ayarlari"; GET now matches it.
  if (!(await requireModuleAccess("site-ayarlari"))) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }
  const content = await getSiteContent();
  const version = await getSiteContentVersion();
  return NextResponse.json({ ...withoutApiKeys(content), _version: version });
}

export async function PUT(request: Request) {
  if (!(await requireModuleAccess("site-ayarlari"))) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  // _version round-trips the site_settings row's updated_at the client's
  // copy of content was last read at (see getAdminPageData/_version on
  // GET above) — stripped out before the rest of this body is treated as
  // SiteContent. See saveSiteContentIfUnchanged for why this matters: two
  // admin tabs/sessions editing different parts of the same JSONB row at
  // the same time must not be able to silently overwrite each other.
  const { _version: clientVersion, ...rest } = (await request.json()) as SiteContent & { _version?: string | null };

  const unauthorizedKeys = findUnauthorizedTopLevelKeys(rest);
  if (unauthorizedKeys.length > 0) {
    return NextResponse.json({ error: `Geçersiz alan(lar) gönderildi: ${unauthorizedKeys.join(", ")}` }, { status: 400 });
  }
  const content = rest as SiteContent;

  // İletişim ve Sosyal Medya settings — server-side validation mirrors the
  // admin form's own checks (never trust the client alone: this endpoint
  // is reachable directly, not only through the form). Rejects dangerous
  // URL schemes, a non-Google-Maps embed URL, and implausible phone
  // numbers before anything is ever written.
  const validationError = validateContactAndSocials(content.contact || {}, content.socials || {});
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  try {
    const current = await getSiteContent();
    const nextApi = { ...content.settings.api } as SiteContent["settings"]["api"];
    sensitiveApiKeys.forEach((key) => {
      if (!nextApi[key] || nextApi[key] === "••••••••") {
        nextApi[key] = current.settings.api[key] || "";
      }
    });
    const next: SiteContent = {
      ...content,
      settings: {
        ...content.settings,
        api: nextApi
      }
    };
    const expectedVersion = clientVersion ?? (await getSiteContentVersion());
    const result = await saveSiteContentIfUnchanged(next, expectedVersion);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Ayarlar bu sırada başka bir oturumda güncellendi. Sayfayı yenileyip tekrar deneyin." },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true, content: withoutApiKeys(next), _version: result.version });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kaydedilemedi. Supabase bağlantısını ve ortam değişkenlerini kontrol edin." },
      { status: 500 }
    );
  }
}
