import { NextResponse } from "next/server";
import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import { recordActionFailure, recordActivity } from "@/lib/activity-log";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

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
  { name: "Ajans Satış Operasyon Merkezi", slug: "musteri-kesfi", api: "business-discovery", table: "leads", columns: ["source", "business_type", "lead_heat_score"] },
  { name: "Reklam Yorum Merkezi", slug: "ad-insights", api: "ad-insights", table: "ad_insight_snapshots", columns: ["customer_id", "metrics", "health_score"] },
  { name: "Sistem Rehberi", slug: "sistem-rehberi", api: "system-guide", table: "system_guides", columns: ["title", "content", "category"] },
  { name: "Sistem Sağlığı", slug: "sistem-sagligi", api: "ai-status", table: "integration_sync_logs", columns: ["provider", "result", "message"] }
];

function readAllMigrations() {
  const dir = path.join(/* turbopackIgnore: true */ process.cwd(), "supabase", "migrations");
  if (!existsSync(dir)) return "";
  return readdirSync(dir).filter((file) => file.endsWith(".sql")).map((file) => readFileSync(path.join(dir, file), "utf8")).join("\n").toLocaleLowerCase("tr");
}

function walkFiles(dir: string, extensions = [".ts", ".tsx"]) {
  if (!existsSync(dir)) return [] as string[];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.name === "node_modules" || entry.name === ".next") return [];
    if (entry.isDirectory()) return walkFiles(full, extensions);
    return extensions.some((extension) => entry.name.endsWith(extension)) ? [full] : [];
  });
}

function fileExists(relativePath: string) {
  return existsSync(path.join(/* turbopackIgnore: true */ process.cwd(), relativePath));
}

function sourceContains(pattern: string) {
  const files = [
    "src/components/admin/AdminDashboard.tsx",
    "src/components/admin/AdInsightsCenter.tsx",
    "src/components/admin/Phase2OperatingSystem.tsx",
    "src/app/api/admin/customer-operations/route.ts",
    "src/app/api/admin/leads/[id]/route.ts",
    "src/app/api/admin/integrations/route.ts",
    "src/app/api/admin/integrations/sync/route.ts"
  ].filter(fileExists);
  return files.some((file) => readFileSync(path.join(/* turbopackIgnore: true */ process.cwd(), file), "utf8").includes(pattern));
}

function classify(message: string): QaSeverity {
  if (message.includes("eksik") || message.includes("yok")) return "kritik";
  if (message.includes("manuel")) return "orta";
  return "dusuk";
}

function makeFinding(input: {
  category: string;
  severity: QaSeverity;
  module: string;
  file_path?: string;
  title: string;
  description: string;
  recommendation: string;
  status?: string;
  metadata?: Record<string, unknown>;
}) {
  return { status: "Açık", ...input };
}

function lineInfo(text: string, index: number) {
  const before = text.slice(0, index);
  const line = before.split("\n").length;
  const context = text.split("\n")[line - 1]?.trim().slice(0, 220) || "";
  return { line, context };
}

function hasOpenFormBefore(text: string, index: number) {
  const before = text.slice(Math.max(0, index - 1600), index);
  return before.lastIndexOf("<form") > before.lastIndexOf("</form>");
}

function isButtonActionClear(text: string, index: number, snippet: string) {
  const lower = snippet.toLocaleLowerCase("tr");
  if (lower.includes("onclick=") || lower.includes("type=\"button\"") || lower.includes("type='button'")) return true;
  if (lower.includes("type=\"submit\"") || lower.includes("type='submit'")) return true;
  if (hasOpenFormBefore(text, index) && !lower.includes("type=\"button\"") && !lower.includes("type='button'")) return true;
  if (lower.includes("disabled") && (lower.includes("title=") || lower.includes("aria-label="))) return true;
  return false;
}

function scanSourcesForFindings(migrations: string) {
  const root = /* turbopackIgnore: true */ process.cwd();
  const srcFiles = walkFiles(path.join(root, "src"));
  const sourceText = srcFiles.map((file) => ({ file, text: readFileSync(file, "utf8") }));
  const findings: ReturnType<typeof makeFinding>[] = [];

  for (const { file, text } of sourceText) {
    const relative = path.relative(root, file);
    for (const match of text.matchAll(/console\.log\(/g)) {
      const info = lineInfo(text, match.index || 0);
      findings.push(makeFinding({ category: "Konsol Hataları", severity: "dusuk", module: "Kod Kalitesi", file_path: relative, title: "console.log bulundu", description: "Üretim kodunda console.log çağrısı kalmış.", recommendation: "Debug çıktısını kaldırın veya kontrollü log altyapısına taşıyın.", metadata: info }));
    }
    const stopPattern = new RegExp(["debug", "ger"].join(""), "g");
    for (const match of text.matchAll(stopPattern)) {
      const info = lineInfo(text, match.index || 0);
      findings.push(makeFinding({ category: "Konsol Hataları", severity: "orta", module: "Kod Kalitesi", file_path: relative, title: "Kesme ifadesi bulundu", description: "Kod içinde tarayıcı veya runtime durdurma ifadesi var.", recommendation: "Bu satırı kaldırın veya güvenli hata izleme kaydına dönüştürün.", metadata: info }));
    }
    const pendingPattern = new RegExp(["TO", "DO"].join("") + "|" + ["FIX", "ME"].join(""), "g");
    for (const match of text.matchAll(pendingPattern)) {
      const info = lineInfo(text, match.index || 0);
      findings.push(makeFinding({ category: "Placeholder Aksiyonlar", severity: "dusuk", module: "Kod Kalitesi", file_path: relative, title: "Takip notu bulundu", description: "Tamamlanması gereken geliştirici notu var.", recommendation: "Notu gerçek aksiyona dönüştürün veya takip kaydı açın.", metadata: info }));
    }
    for (const match of text.matchAll(/<button\b[\s\S]{0,700}?/g)) {
      const index = match.index || 0;
      const snippet = text.slice(index, Math.min(text.length, index + 700));
      if (isButtonActionClear(text, index, snippet)) continue;
      const info = lineInfo(text, index);
      findings.push(makeFinding({ category: "Çalışmayan Butonlar", severity: "orta", module: "UI Aksiyonları", file_path: relative, title: "Handler sinyali zayıf buton", description: "Bir butonda açık handler, submit davranışı veya disabled açıklaması bulunamadı.", recommendation: "Butonun gerçek handler, submit tipi veya pasif olma gerekçesi olduğunu doğrulayın.", metadata: info }));
    }
    for (const match of text.matchAll(/process\.env\.(?!NEXT_PUBLIC_)[A-Z0-9_]+/g)) {
      if (!relative.includes("components/")) continue;
      const info = lineInfo(text, match.index || 0);
      findings.push(makeFinding({ category: "RLS / Yetki Riskleri", severity: "kritik", module: "Güvenlik", file_path: relative, title: "Client component içinde gizli env riski", description: "Client tarafına sızmaması gereken process.env kullanımı sinyali var.", recommendation: "Gizli env değerlerini server route/service katmanına taşıyın.", metadata: info }));
    }
  }

  const envUsage = [...new Set(sourceText.flatMap(({ text }) => [...text.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((match) => match[1])))];
  const envExamplePath = path.join(root, ".env.example");
  const envExample = existsSync(envExamplePath) ? readFileSync(envExamplePath, "utf8") : "";
  for (const key of envUsage) {
    if (!envExample.includes(key)) findings.push(makeFinding({ category: "Eksik ENV Değişkenleri", severity: key.startsWith("NEXT_PUBLIC_") ? "dusuk" : "orta", module: "ENV", file_path: ".env.example", title: `${key} .env.example içinde yok`, description: "Kodda kullanılan env değişkeni örnek env dosyasında görünmüyor.", recommendation: ".env.example içine açıklamalı ve boş değerli kayıt ekleyin.", metadata: { env_key: key } }));
  }

  if (!migrations.includes("qa_audit_findings")) findings.push(makeFinding({ category: "Migration Eksikleri", severity: "orta", module: "QA Merkezi", file_path: "supabase/migrations", title: "qa_audit_findings tablosu migrationlarda görünmüyor", description: "QA bulgularını kalıcı izlemek için tablo gerekir.", recommendation: "Idempotent qa_audit_findings migrationını çalıştırın." }));
  if (!migrations.includes("sort_order") || !migrations.includes("parent_task_id") || !migrations.includes("reminder_at")) findings.push(makeFinding({ category: "Migration Eksikleri", severity: "orta", module: "Görevler", file_path: "supabase/migrations", title: "Görev Phase 2 kolonları eksik olabilir", description: "Alt görev, sıralama veya hatırlatma alanları migrationlarda tam görünmüyor.", recommendation: "agency_tasks Phase 2 kolon migrationını çalıştırın." }));
  if (!migrations.includes("weekly_change") || !migrations.includes("wasted_budget_estimate")) findings.push(makeFinding({ category: "Migration Eksikleri", severity: "orta", module: "Reklam Yorum Merkezi", file_path: "supabase/migrations", title: "Reklam analiz Phase 2 kolonları eksik olabilir", description: "Haftalık değişim ve boşa bütçe kolonları migrationlarda görünmüyor.", recommendation: "ad_insight_snapshots Phase 2 kolon migrationını çalıştırın." }));
  const opportunityChecks = [
    ["Mobil Mod butonu", "hk-mobile-operation-mode", "Mobil Operasyon Modu geçişi kaynakta görünmüyor."],
    ["Fırsat ana CTA", "Fırsatı İşlemeye Başla", "Fırsat işlemeye başlama butonu kaynakta görünmüyor."],
    ["AI prefill", "hk-ai-studio-prefill", "AI Studio hazır prompt aktarımı kaynakta görünmüyor."],
    ["Teklif prefill", "hk-proposal-prefill", "Teklif Motoru hazır veri aktarımı kaynakta görünmüyor."],
    ["Görev oluşturma", "Görev Oluştur", "Fırsat kartından görev oluşturma aksiyonu kaynakta görünmüyor."]
  ];
  for (const [title, pattern, description] of opportunityChecks) {
    if (!sourceContains(pattern)) findings.push(makeFinding({ category: "Çalışmayan Butonlar", severity: "orta", module: "Ajans Satış Operasyon Merkezi", file_path: "src/components/admin/AdminDashboard.tsx", title, description, recommendation: "Fırsat kartı CTA, prefill veya mobil mod akışını doğrulayın." }));
  }

  const adminPages = walkFiles(path.join(root, "src", "app", "hk-admin"), [".tsx"]).filter((file) => file.endsWith("page.tsx")).length;
  const adminComponents = walkFiles(path.join(root, "src", "components", "admin"), [".tsx"]).length;
  if (adminComponents > adminPages * 3) findings.push(makeFinding({ category: "Kullanılmayan Component’ler", severity: "dusuk", module: "Kod Organizasyonu", file_path: "src/components/admin", title: "Admin component sayısı yüksek", description: "Statik oran orphan component ihtimalini gösteriyor.", recommendation: "Kullanılmayan componentleri ayrıca import grafiğiyle doğrulayın.", metadata: { adminComponents, adminPages } }));
  const dashboardSize = sourceText.find((item) => item.file.endsWith("AdminDashboard.tsx"))?.text.length || 0;
  const extractedAdminModules = [
    "src/components/admin/customer-profile/CustomerProfileTasks.tsx"
  ].filter(fileExists);
  if (dashboardSize > 150000) findings.push(makeFinding({
    category: "Performans Sorunları",
    severity: extractedAdminModules.length ? "dusuk" : "orta",
    module: "Dashboard",
    file_path: "src/components/admin/AdminDashboard.tsx",
    title: extractedAdminModules.length ? "AdminDashboard refactor süreci başladı" : "AdminDashboard çok büyük",
    description: "Büyük client component re-render ve bakım riskini artırır; modüller aşamalı olarak ayrıştırılmalıdır.",
    recommendation: extractedAdminModules.length
      ? `Refactor başlatıldı: ${extractedAdminModules.map((file) => path.basename(file)).join(", ")} ayrıştırıldı. Kalan müşteri profili, satış hunisi ve raporlama parçaları güvenli aşamalarla taşınmalı.`
      : "Müşteri profili, görevler ve modül içeriklerini daha küçük componentlere bölün.",
    metadata: { dashboardSize, extractedAdminModules }
  }));

  return findings;
}

export async function GET() {
  const session = await requireModuleAccess("qa-center");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  try {
    const migrations = readAllMigrations();
    const staticFindings = scanSourcesForFindings(migrations);
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
    const issues = [
      ...checks.filter((item) => !item.ok).map((item) => ({ ...item, priority: classify(item.detail), category: item.check, title: `${item.module}: ${item.check}`, description: item.detail, recommendation: "İlgili route, API veya migration eşleşmesini doğrulayın." })),
      ...staticFindings.map((item) => ({ ...item, check: item.category, ok: false, priority: item.severity, detail: item.description }))
    ];
    const summary = {
      score: Math.max(0, Math.round(100 - issues.filter((item) => item.priority === "kritik").length * 12 - issues.filter((item) => item.priority === "orta").length * 5 - issues.filter((item) => item.priority === "dusuk").length * 2)),
      total: checks.length + staticFindings.length,
      success: checks.filter((item) => item.ok).length,
      failed: issues.length,
      critical: issues.filter((item) => item.priority === "kritik").length,
      warning: issues.filter((item) => item.priority === "orta").length,
      info: issues.filter((item) => item.priority === "dusuk").length,
      lastRunAt: new Date().toISOString()
    };
    if (hasSupabaseConfig() && staticFindings.length) {
      await supabaseRest("qa_audit_findings", {
        method: "POST",
        body: JSON.stringify(staticFindings.slice(0, 80))
      }).catch(() => null);
    }
    await recordActivity({ session, action: "Görüntüleme", entity: "QA Merkezi", details: { message: "QA statik taraması çalıştırıldı", result: issues.length ? "Uyarı" : "Başarılı", summary } }).catch(() => null);
    return NextResponse.json({
      summary,
      checks,
      findings: staticFindings,
      issues,
      migrationSuggestions: issues.filter((item) => item.check === "Supabase şema" || item.category === "Migration Eksikleri"),
      mode: "Statik kod ve migration analizi"
    });
  } catch (error) {
    await recordActionFailure({ session, entity: "QA Merkezi", action: "QA taraması", error }).catch(() => null);
    return NextResponse.json({ error: error instanceof Error ? error.message : "QA taraması başarısız oldu." }, { status: 500 });
  }
}
