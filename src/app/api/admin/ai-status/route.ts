import { NextResponse } from "next/server";
import { getSiteContent, saveSiteContent } from "@/lib/content";
import { requireModuleAccess } from "@/lib/permissions";

function status(name: string, configured: boolean, model = "-", warning = "") {
  return {
    name,
    status: configured ? "Aktif" : "API Eksik",
    model,
    lastTestTime: new Date().toISOString(),
    warning
  };
}

export async function POST() {
  if (!(await requireModuleAccess("api-ayarlari")) && !(await requireModuleAccess("dashboard"))) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const content = await getSiteContent();
  const api = content.settings.api || {};
  const results = {
    openai: status("OpenAI", Boolean(process.env.OPENAI_API_KEY), process.env.OPENAI_MODEL || api.active_ai_model || "gpt-4.1-mini"),
    groq: status("Groq", Boolean(process.env.GROQ_API_KEY), process.env.GROQ_MODEL || "llama-3.3-70b-versatile"),
    gemini: status("Gemini", Boolean(process.env.GEMINI_API_KEY), process.env.GEMINI_MODEL || "gemini-2.0-flash"),
    meta: status("Meta", Boolean(process.env.META_AD_LIBRARY_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN), "Meta Ad Library Token"),
    googleMaps: status("Google Maps", Boolean(process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY), "Places API"),
    googleAds: status("Google Ads", Boolean(process.env.GOOGLE_ADS_DEVELOPER_TOKEN || process.env.GOOGLE_ADS_CLIENT_ID), "Google Ads API", "Google Ads bağlı değilse Google Maps sinyalleri kullanılır.")
  };

  const next = {
    ...content,
    settings: {
      ...content.settings,
      api: {
        ...api,
        ai_status_last_test_at: new Date().toISOString(),
        ai_status: results
      }
    }
  };

  await saveSiteContent(next).catch(() => null);
  return NextResponse.json({ ok: true, results, lastTestTime: next.settings.api.ai_status_last_test_at });
}
