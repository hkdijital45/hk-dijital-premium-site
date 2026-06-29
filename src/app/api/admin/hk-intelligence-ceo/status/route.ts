import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";

function envStatus(keys: string[]) {
  const missing = keys.filter((key) => !process.env[key]);
  return {
    status: missing.length ? "Eksik" : "Hazır",
    missingEnv: missing,
    configuredCount: keys.length - missing.length,
    total: keys.length
  };
}

export async function GET() {
  const session = await requireModuleAccess("hk-intelligence-ceo");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  const ai = envStatus([
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "GROQ_API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENROUTER_API_KEY",
    "MANUS_API_KEY",
    "OLLAMA_BASE_URL"
  ]);
  const analytics = envStatus([
    "META_ACCESS_TOKEN",
    "META_DATASET_ID",
    "GA4_PROPERTY_ID",
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    "GOOGLE_ADS_DEVELOPER_TOKEN",
    "GOOGLE_SEARCH_CONSOLE_SITE_URL"
  ]);
  const operations = envStatus([
    "AGENT_HUB_CRON_SECRET",
    "DISCORD_WEBHOOK_URL",
    "SMTP_HOST",
    "RESEND_API_KEY"
  ]);

  return NextResponse.json({
    title: "HK Intelligence Autonomous Agency",
    mode: "HK Intelligence Final Layer",
    generatedAt: new Date().toISOString(),
    checks: {
      ai,
      analytics,
      operations
    },
    modules: [
      "HK Intelligence CEO",
      "HK Digital Team",
      "AI Operasyon Takvimi",
      "Risk Merkezi",
      "Rakip Alarm Merkezi",
      "AI Kreatif Stüdyosu",
      "AI Satış Asistanı",
      "Ajans KPI Merkezi",
      "HK Learning Center",
      "Digital Twin",
      "Marketplace",
      "Health Center",
      "AI Cost Center",
      "Backup Center"
    ],
    security: {
      secretsReturned: false,
      customerPanelTouched: false,
      authChanged: false
    }
  });
}
