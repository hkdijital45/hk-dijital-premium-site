import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { getSafeSupabaseError } from "@/lib/supabase";
import { safeCompare } from "@/lib/secure-compare";
import { analyticsTablesReady } from "@/lib/analytics-center/metrics-store";
import { syncCompanyAnalytics, defaultSyncRange } from "@/lib/analytics-center/sync";
import { ANALYTICS_PROVIDERS } from "@/lib/analytics-center/types";

// Scheduled daily sync for every company with at least one connected
// analytics provider — mirrors the dual cron/manual auth pattern already
// used by the other .../run-daily routes (see
// src/lib/social-autopilot/cron-auth.ts), generalized here rather than
// reusing that file directly since it is hardcoded to the
// "social-autopilot" module. Register in vercel.json's crons array once
// this has been smoke-tested manually — deliberately not added
// automatically by this change, per "avoid duplicate/unreviewed
// deployments" caution.
function bearerToken(request: Request) {
  const match = (request.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function authorize(request: Request) {
  if (safeCompare(bearerToken(request), process.env.CRON_SECRET)) return "cron" as const;
  const session = await requireModuleAccess("analiz-raporlama");
  return session ? ("manual" as const) : null;
}

async function run(request: Request) {
  const mode = await authorize(request);
  if (!mode) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  if (!(await analyticsTablesReady())) return NextResponse.json({ error: "Analiz Merkezi veritabanı tabloları henüz oluşturulmadı." }, { status: 503 });

  try {
    const rows = await supabaseRest<Array<{ company_id: string; integration_assets: unknown }>>(
      "customer_integrations?select=company_id,integration_assets&integration_assets=neq.[]"
    );
    const companyIds = [...new Set(rows.filter((row) => Array.isArray(row.integration_assets) && row.integration_assets.length).map((row) => row.company_id))];
    const range = defaultSyncRange();
    const summary: Array<{ companyId: string; results: unknown }> = [];
    // Sequential per company (not Promise.all) — this fans out to up to 5
    // provider requests per company already; running many companies at
    // once risks tripping Meta/Google per-app rate limits across the whole
    // batch rather than just one company's sync.
    for (const companyId of companyIds) {
      const results = await syncCompanyAnalytics(companyId, ANALYTICS_PROVIDERS, range);
      summary.push({ companyId, results });
    }
    return NextResponse.json({ ok: true, mode, companiesSynced: companyIds.length, summary });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return run(request);
}
export async function GET(request: Request) {
  return run(request);
}
