import { NextResponse } from "next/server";
import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import { recordActionFailure, recordActivity } from "@/lib/activity-log";
import { requireModuleAccess } from "@/lib/permissions";

type QaSeverity = "kritik" | "orta" | "dusuk";

const modules = [
  { name: "Kontrol Merkezi", slug: "", api: "center-data", table: "activity_logs", columns: ["created_at", "module", "action"] },
  { name: "Müşteriler", slug: "musteriler", api: "center-data", table: "companies", columns: ["id", "name", "status"] },
  { name: "Satış Hunisi", slug: "satis-hunisi", api: "leads/pipeline", table: "leads", columns: ["calendar_follow_up_at", "next_action_at", "pipeline_stage"] },
  { name: "Tahsilat", slug: "tahsilat", api: "customer-operations", table: "payment_records", columns: ["company_id", "amount", "status", "due_date"] },
  { name: "Görevler", slug: "gorevler", api: "customer-operations", table: "agency_tasks", columns: ["company_id", "title", "description", "visible_to_customer", "archived_at"] },
  { name: "Raporlama", slug: "musteri-raporlari", api: "reports", table: "reports", columns: ["company_id", "title", "visible_to_customer"] },
  { name: "Meta Entegrasyonları", slug: "meta-istihbarat", api: "meta-ads", table: "ad_integrations", columns: ["provider", "account_id", "business_id"] },
  { name: "Google Entegrasyonları", slug: "google-istihbarat", api: "google-analysis", table: "ad_integrations", columns: ["google_customer_id", "google_analytics_id"] },
  { name: "Reklam Yorum Merkezi", slug: "ad-insights", api: "ad-insights", table: "ad_insight_snapshots", columns: ["customer_id", "metrics", "health_score"] },
  { name: "Sistem Rehberi", slug: "sistem-rehberi", api: "system-guide", table: "system_guides", columns: ["title", "content", "category"] },
  { name: "Sistem Sağlığı", slug: "sistem-sagligi", api: "ai-status", table: "integration_sync_logs", columns: ["provider", "result", "message"] }
];

function readAllMigrations() {
  const dir = path.join(/* turbopackIgnore: true */ process.cwd(), "supabase", "migrations");
  if (!existsSync(dir)) return "";
  return readdirSync(dir).filter((file) => file.endsWith(".sql")).map((file) => readFileSync(path.join(dir, file), "utf8")).join("\n").toLocaleLowerCase("tr");
}

function fileExists(relativePath: string) {
  return existsSync(path.join(/* turbopackIgnore: true */ process.cwd(), relativePath));
}

function sourceContains(pattern: string) {
  const files = [
    "src/components/admin/AdminDashboard.tsx",
    "src/components/admin/AdInsightsCenter.tsx",
    "src/app/api/admin/customer-operations/route.ts",
    "src/app/api/admin/leads/[id]/route.ts"
  ].filter(fileExists);
  return files.some((file) => readFileSync(path.join(/* turbopackIgnore: true */ process.cwd(), file), "utf8").includes(pattern));
}

function classify(message: string): QaSeverity {
  if (message.includes("eksik") || message.includes("yok")) return "kritik";
  if (message.includes("manuel")) return "orta";
  return "dusuk";
}

export async function GET() {
  const session = await requireModuleAccess("qa-center");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  try {
    const migrations = readAllMigrations();
    const checks = modules.flatMap((module) => {
      const pagePath = module.slug ? `src/app/hk-admin/${module.slug}/page.tsx` : "src/app/hk-admin/page.tsx";
      const dynamicPage = fileExists("src/app/hk-admin/[module]/page.tsx");
      const apiPath = `src/app/api/admin/${module.api}/route.ts`;
      const tableFound = migrations.includes(`create table if not exists public.${module.table}`) || migrations.includes(`create table if not exists ${module.table}`) || migrations.includes(`alter table if exists public.${module.table}`);
      const missingColumns = module.columns.filter((column) => !migrations.includes(column.toLocaleLowerCase("tr")));
      return [
        { module: module.name, check: "Sayfa", ok: fileExists(pagePath) || dynamicPage, detail: fileExists(pagePath) || dynamicPage ? "Sayfa/dinamik modül route mevcut." : "Sayfa route dosyası bulunamadı.", severity: "kritik" as QaSeverity },
        { module: module.name, check: "API", ok: fileExists(apiPath), detail: fileExists(apiPath) ? "İlgili API endpoint mevcut." : "İlgili API endpoint dosyası bulunamadı.", severity: "orta" as QaSeverity },
        { module: module.name, check: "Supabase şema", ok: tableFound && missingColumns.length === 0, detail: tableFound ? missingColumns.length ? `Manuel doğrulama gerekli. Eksik kolon sinyali: ${missingColumns.join(", ")}` : "Migrationlarda tablo/kolon beklentisi görünüyor." : `Migrationlarda ${module.table} tablo tanımı bulunamadı.`, severity: missingColumns.length ? "orta" as QaSeverity : "kritik" as QaSeverity },
        { module: module.name, check: "Buton/aksiyon", ok: sourceContains(module.name) || sourceContains(module.slug), detail: sourceContains(module.name) || sourceContains(module.slug) ? "Admin kaynaklarında modül aksiyon referansı bulundu." : "Statik analizde aksiyon referansı sınırlı; manuel doğrulama gerekli.", severity: "dusuk" as QaSeverity }
      ];
    });
    const issues = checks.filter((item) => !item.ok).map((item) => ({ ...item, priority: classify(item.detail) }));
    const summary = {
      total: checks.length,
      success: checks.filter((item) => item.ok).length,
      failed: issues.length,
      critical: issues.filter((item) => item.priority === "kritik").length,
      lastRunAt: new Date().toISOString()
    };
    await recordActivity({ session, action: "Görüntüleme", entity: "QA Merkezi", details: { message: "QA statik taraması çalıştırıldı", result: issues.length ? "Uyarı" : "Başarılı", summary } }).catch(() => null);
    return NextResponse.json({ summary, checks, issues, migrationSuggestions: issues.filter((item) => item.check === "Supabase şema") });
  } catch (error) {
    await recordActionFailure({ session, entity: "QA Merkezi", action: "QA taraması", error }).catch(() => null);
    return NextResponse.json({ error: error instanceof Error ? error.message : "QA taraması başarısız oldu." }, { status: 500 });
  }
}
