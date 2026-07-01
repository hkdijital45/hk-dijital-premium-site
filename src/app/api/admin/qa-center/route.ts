/* eslint-disable @typescript-eslint/no-explicit-any */
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
  { name: "Reklam Yorum Merkezi", slug: "ad-insights", api: "ad-insights", table: "ad_insight_snapshots", columns: ["customer_id", "metrics", "health_score"] },
  { name: "HK Intelligence CEO", slug: "hk-intelligence-ceo", api: "hk-intelligence-ceo/status", table: "hk_intelligence_ceo_runs", columns: ["command_text", "agent_plan", "final_report"] },
  { name: "HK Dijital Ekibi", slug: "hk-intelligence-ceo", api: "hk-intelligence-ceo/status", table: "hk_virtual_agents", columns: ["agent_key", "role_label", "preferred_provider"] },
  { name: "HK Risk Events", slug: "hk-intelligence-ceo", api: "hk-intelligence-ceo/status", table: "hk_risk_events", columns: ["risk_key", "severity", "recommendation"] },
  { name: "Müşteri Şubeleri", slug: "hk-intelligence-ceo", api: "customers/[id]/branches", table: "customer_branches", columns: ["company_id", "branch_name", "status", "created_by", "updated_by"] },
  { name: "HK CEO Paket Pazarı", slug: "hk-intelligence-ceo", api: "hk-intelligence-ceo/marketplace", table: "hk_marketplace_packages", columns: ["package_name", "sector", "workflow_steps", "operation_plan", "tracking_metrics", "seven_day_plan"] },
  { name: "HK CEO Paket Uygulama Logları", slug: "hk-intelligence-ceo", api: "hk-intelligence-ceo/marketplace", table: "hk_marketplace_package_applications", columns: ["package_id", "company_id", "result_summary", "created_records", "post_apply_plan", "next_actions"] },
  { name: "HK Agent Hub", slug: "agent-hub", api: "agent-hub/providers", table: "agent_runs", columns: ["task_type", "selected_provider", "output_payload", "final_report", "provider_chain", "progress_events"] },
  { name: "HK Agent Hub Planlı Görevler", slug: "agent-hub", api: "agent-hub/scheduled", table: "agent_scheduled_tasks", columns: ["task_type", "schedule_frequency", "next_run_at", "multi_agent"] },
  { name: "HK Agent Hub Hafıza", slug: "agent-hub", api: "agent-hub/memory", table: "agent_memories", columns: ["company_id", "memory_type", "impact_score", "is_active"] },
  { name: "HK Agent Hub Eğitim", slug: "agent-hub", api: "agent-hub/training", table: "agent_training_rules", columns: ["rule_type", "priority", "is_active"] },
  { name: "HK Agent Hub Benchmark", slug: "agent-hub", api: "agent-hub/benchmark", table: "agent_benchmarks", columns: ["task_type", "providers", "results", "winner_provider"] },
  { name: "Ajans Operasyon Kalıcılığı", slug: "musteri-kesfi", api: "center-data", table: "agency_opportunities", columns: ["pipeline_status", "next_recommended_action", "last_offer_at"] },
  { name: "Teklif Takip Merkezi", slug: "teklif-takip-merkezi", api: "center-data", table: "proposal_followups", columns: ["next_followup_at", "status", "proposal_amount"] },
  { name: "Ajans Hedef Panosu", slug: "ajans-hedefleri", api: "center-data", table: "agency_targets", columns: ["month", "target_revenue", "target_customers"] },
  { name: "Sistem Rehberi", slug: "sistem-rehberi", api: "system-guide", table: "system_guides", columns: ["title", "content", "category"] },
  { name: "Sistem Sağlığı", slug: "sistem-sagligi", api: "ai-status", table: "integration_sync_logs", columns: ["provider", "result", "message"] }
];

function readAllMigrations() {
  const dir = path.join(/* turbopackIgnore: true */ process.cwd(), "supabase", "migrations");
  if (!existsSync(dir)) return "";
  return readdirSync(dir).filter((file) => file.endsWith(".sql")).map((file) => readFileSync(path.join(dir, file), "utf8")).join("\n").toLocaleLowerCase("tr");
}

function walkFiles(dir: string, extensions = [".ts", ".tsx"]): string[] {
  if (!existsSync(dir)) return [];
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
    "src/components/admin/HKAutonomousAgencyCenter.tsx",
    "src/components/admin/AgentHubCenter.tsx",
    "src/components/admin/AdInsightsCenter.tsx",
    "src/components/admin/Phase2OperatingSystem.tsx",
    "src/components/admin/WebsiteAnalyticsCenter.tsx",
    "src/components/admin/QaCenter.tsx",
    "src/components/admin/customer-profile/CustomerIntegrationsPanel.tsx",
    "src/components/admin/customer-profile/CustomerProfileModal.tsx",
    "src/components/admin/customer-profile/CustomerBranchFilter.tsx",
    "src/lib/admin-navigation.ts",
    "src/lib/agent-hub.ts",
    "src/lib/customer-onboarding.ts",
    "src/lib/website-analytics.ts",
    "src/lib/system-guide-content.ts",
    "src/app/api/admin/customer-operations/route.ts",
    "src/app/api/admin/customers/[id]/branches/route.ts",
    "src/app/api/admin/customers/[id]/branches/[branchId]/route.ts",
    "src/app/api/admin/customers/[id]/integrations/route.ts",
    "src/app/api/admin/leads/[id]/route.ts",
    "src/app/api/admin/integrations/route.ts",
    "src/app/api/admin/integrations/sync/route.ts",
    "src/app/api/admin/hk-intelligence-ceo/status/route.ts",
    "src/app/api/admin/hk-intelligence-ceo/copilot/route.ts",
    "src/app/api/admin/hk-intelligence-ceo/marketplace/route.ts",
    "src/app/api/admin/hk-intelligence-ceo/marketplace/generate/route.ts",
    "src/app/api/admin/hk-intelligence-ceo/marketplace/[id]/apply-to-customer/route.ts",
    "src/app/api/admin/hk-intelligence-ceo/agents/route.ts",
    "src/app/api/admin/hk-intelligence-ceo/operations/route.ts"
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

function friendlySeverity(severity: string) {
  if (severity === "kritik") return "Kritik";
  if (severity === "orta") return "Orta";
  return "Düşük";
}

function friendlyMeaning(issue: any) {
  const title = String(issue.title || issue.check || "");
  const category = String(issue.category || issue.check || "");
  if (title.includes("Handler sinyali zayıf buton")) {
    return "Bu, butonun ekranda göründüğü ama tıklanınca gerçek işlem başlatıp başlatmadığının statik analizle netleşmediği anlamına gelir. Kullanıcı açısından buton çalışmıyor gibi görünebilir.";
  }
  if (category.includes("Migration") || title.includes("migration") || title.includes("Supabase şema")) {
    return "Bu uyarı, kodun beklediği tablo veya kolonun migration dosyalarında tam görünmediğini belirtir. Canlı veritabanında ilgili SQL çalışmadıysa kayıt işlemleri hata verebilir.";
  }
  if (category.includes("Güvenlik") || title.includes("secret") || title.includes("env")) {
    return "Bu uyarı, API key, token, secret veya private key gibi hassas bilgilerin yanlış katmanda kullanılma ihtimalini gösterir.";
  }
  if (title.includes("Slack")) return "Slack bildirimi artık kullanıcı arayüzünden kaldırıldı; bildirim tarafında Discord tercih edilir. Bu kontrol eski Slack beklentisinin tekrar görünmemesini izler.";
  if (title.includes("Auto Router") || title.includes("Provider") || title.includes("Groq")) {
    return "Bu kontrol, manuel AI sağlayıcı seçiminin Auto Router tarafından ezilmediğini ve yedek akış varsa bunun kullanıcıya açıklandığını doğrular.";
  }
  if (title.includes("Rapor") || category.includes("Raporlama")) {
    return "Bu kontrol, rapor çıktısının ekran görüntüsü yerine profesyonel rapor verisi, HTML, CSV veya metin taslağı olarak üretildiğini doğrular.";
  }
  if (title.includes("CSV")) return "Bu kontrol, Türkçe karakterlerin Excel/CSV çıktılarında bozulmaması için UTF-8 BOM kullanımını doğrular.";
  return "Bu bulgu sistemin hemen çöktüğü anlamına gelmez; ilgili modülün daha güvenilir, anlaşılır veya sürdürülebilir hale getirilmesi gereken bir noktasını gösterir.";
}

function userImpact(issue: any) {
  const category = String(issue.category || issue.check || "");
  const title = String(issue.title || issue.check || "");
  if (title.includes("Handler sinyali")) return "Kullanıcı butona bastığında hiçbir şey olmuyor gibi algılayabilir.";
  if (category.includes("Migration")) return "Kayıt veya güncelleme sırasında Supabase şema hatası alınabilir.";
  if (category.includes("Güvenlik")) return "Hassas bilginin yanlışlıkla client tarafına taşınması riski oluşabilir.";
  if (category.includes("Buton Okunabilirliği")) return "Açık temada buton metni zor okunabilir.";
  if (category.includes("Eksik ENV")) return "Canlı entegrasyon yerine demo/yedek akış çalışabilir.";
  return "İlgili modülde kullanıcı deneyimi, bakım kolaylığı veya operasyon güvenilirliği azalabilir.";
}

function technicalReason(issue: any) {
  const file = issue.file_path ? `${issue.file_path}${issue.metadata?.line ? `:${issue.metadata.line}` : ""}` : "Statik analiz";
  const context = issue.metadata?.context ? ` Kod bağlamı: ${issue.metadata.context}` : "";
  return `${file} üzerinde statik analiz sinyali üretildi.${context}`;
}

function routeForModule(moduleName: string) {
  const found = modules.find((module) => module.name === moduleName || module.slug === moduleName);
  if (!found) return "/hk-admin/qa-center";
  return found.slug ? `/hk-admin/${found.slug}` : "/hk-admin";
}

function repairCategory(issue: any) {
  const category = String(issue.category || issue.check || "");
  if (issue.priority === "kritik") return "Kritik";
  if (category.includes("Güvenlik") || category.includes("RLS")) return "Güvenlik";
  if (category.includes("Migration") || String(issue.title || "").includes("migration")) return "Migration";
  if (category.includes("Buton") || category.includes("UI") || String(issue.title || "").includes("Buton")) return "UI/UX";
  if (String(issue.module || "").includes("Agent")) return "Agent Hub";
  if (category.includes("Rapor")) return "Raporlama";
  if (issue.priority === "orta") return "Orta";
  return "Teknik borç";
}

function enrichIssue(issue: any) {
  return {
    ...issue,
    status: issue.status || "Açık",
    riskLevel: friendlySeverity(issue.priority || issue.severity || "dusuk"),
    where: issue.file_path || issue.module || "Genel sistem",
    meaning: friendlyMeaning(issue),
    userImpact: userImpact(issue),
    technicalReason: technicalReason(issue),
    suggestedSolution: issue.recommendation || "İlgili route, API, handler veya migration eşleşmesini doğrulayın.",
    actionRoute: routeForModule(issue.module),
    codeReference: issue.file_path ? `${issue.file_path}${issue.metadata?.line ? `:${issue.metadata.line}` : ""}` : "",
    repairCategory: repairCategory(issue),
    canMarkFixed: true,
    canRetest: true
  };
}

function buildRepairPlan(issues: any[]) {
  const groups = ["Kritik", "Orta", "Düşük", "Teknik borç", "UI/UX", "Güvenlik", "Raporlama", "Agent Hub", "Migration"];
  return groups.map((group) => {
    const rows = issues.filter((issue) =>
      issue.repairCategory === group ||
      (group === "Orta" && issue.priority === "orta") ||
      (group === "Düşük" && issue.priority === "dusuk")
    );
    return {
      category: group,
      count: rows.length,
      topIssues: rows.slice(0, 3).map((issue) => issue.title || issue.check),
      modules: [...new Set(rows.map((issue) => issue.module).filter(Boolean))].slice(0, 5),
      nextStep: rows.length ? rows[0].suggestedSolution : "Bu kategoride aktif sorun görünmüyor.",
      priority: group === "Kritik" || group === "Güvenlik" ? "Önce" : group === "Migration" || group === "UI/UX" ? "Sıradaki" : "Planlı"
    };
  });
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
    for (const match of text.matchAll(/<button\b[\s\S]{0,500}?className=(?:\{`|["'`])[\s\S]{0,260}?bg-(?:black|slate-950|gray-950)/g)) {
      const info = lineInfo(text, match.index || 0);
      findings.push(makeFinding({ category: "Buton Okunabilirliği", severity: "orta", module: "UI", file_path: relative, title: "Siyah/dark buton sınıfı bulundu", description: "Açık temada okunabilirliği düşürebilecek koyu buton sınıfı tespit edildi.", recommendation: "Primary butonları marka uyumlu cyan/amber/blue varyantlara veya açık zeminli secondary stile taşıyın.", metadata: info }));
    }
  }

  const envUsage = [...new Set(sourceText
    .flatMap(({ text }: { text: string }) => [...text.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((match) => match[1]))
    .filter((key): key is string => Boolean(key)))];
  const envExamplePath = path.join(root, ".env.example");
  const envExample = existsSync(envExamplePath) ? readFileSync(envExamplePath, "utf8") : "";
  for (const key of envUsage) {
    if (!envExample.includes(key)) findings.push(makeFinding({ category: "Eksik ENV Değişkenleri", severity: key.startsWith("NEXT_PUBLIC_") ? "dusuk" : "orta", module: "ENV", file_path: ".env.example", title: `${key} .env.example içinde yok`, description: "Kodda kullanılan env değişkeni örnek env dosyasında görünmüyor.", recommendation: ".env.example içine açıklamalı ve boş değerli kayıt ekleyin.", metadata: { env_key: key } }));
  }

  if (!migrations.includes("qa_audit_findings")) findings.push(makeFinding({ category: "Migration Eksikleri", severity: "orta", module: "QA Merkezi", file_path: "supabase/migrations", title: "qa_audit_findings tablosu migrationlarda görünmüyor", description: "QA bulgularını kalıcı izlemek için tablo gerekir.", recommendation: "Idempotent qa_audit_findings migrationını çalıştırın." }));
  if (!migrations.includes("sort_order") || !migrations.includes("parent_task_id") || !migrations.includes("reminder_at")) findings.push(makeFinding({ category: "Migration Eksikleri", severity: "orta", module: "Görevler", file_path: "supabase/migrations", title: "Görev Phase 2 kolonları eksik olabilir", description: "Alt görev, sıralama veya hatırlatma alanları migrationlarda tam görünmüyor.", recommendation: "agency_tasks Phase 2 kolon migrationını çalıştırın." }));
  if (!migrations.includes("weekly_change") || !migrations.includes("wasted_budget_estimate")) findings.push(makeFinding({ category: "Migration Eksikleri", severity: "orta", module: "Reklam Yorum Merkezi", file_path: "supabase/migrations", title: "Reklam analiz Phase 2 kolonları eksik olabilir", description: "Haftalık değişim ve boşa bütçe kolonları migrationlarda görünmüyor.", recommendation: "ad_insight_snapshots Phase 2 kolon migrationını çalıştırın." }));
  [
    ["Menü kategorileri duplicate mi?", "Müşteri & Satış", "admin-navigation.ts içinde müşteri/satış modülleri tek kategori altında toplanmalı."],
    ["Aynı route iki farklı isimle gösteriliyor mu?", "legacySlugRedirects", "Eski slug değerleri canonical route’a yönlenmeli."],
    ["Mobil mod toggle görünüyor mu?", "Mobil Operasyon Modu Toggle", "Admin toolbar üzerinde görünür toggle bulunmalı."],
    ["Mobil mod localStorage tercihi korunuyor mu?", "hk-mobile-operation-mode", "Mobil mod tercihi CRM/lead kaydı yerine localStorage’da tutulmalı."],
    ["Fırsat operasyon verileri Supabase’e kaydediliyor mu?", "agencyOpportunities", "Fırsat kartı center-data üzerinden agency_opportunities koleksiyonuna yazmalı."],
    ["Pipeline değişimi timeline’a yazılıyor mu?", "agencyOpportunityEvents", "Pipeline ve aksiyon kayıtları agency_opportunity_events koleksiyonuna eklenmeli."],
    ["Teklif takip akışı oluşuyor mu?", "proposalFollowups", "Teklif taslağı 3/7/14 günlük takip tarihleriyle kayıt üretmeli."],
    ["Günlük görevler kalıcı mı?", "agencyDailyTasks", "Fırsat kartından görev oluşturma agency_daily_tasks koleksiyonuna yazmalı."],
    ["Ajans hedefleri kalıcı mı?", "agencyTargets", "Ajans Hedef Panosu hedefleri agency_targets koleksiyonuna kaydetmeli."],
    ["Gerçek/tahmini veri etiketi görünüyor mu?", "Tahmini veri", "Karar panellerinde veri kaynağı etiketi bulunmalı."],
    ["Rehber güncel mi?", "Teklif Takip Merkezi", "Sistem Rehberi yeni operasyon başlıklarını içermeli."],
    ["Migration gerekli ama eksik mi?", "agency_opportunities", "Ajans operasyon migrationı çalıştırılabilir olmalı."]
    ,
    ["Agent Hub route var mı?", "HK Agent Hub", "Agent Hub menüden açılmalı ve /hk-admin/agent-hub route'u erişilebilir olmalı."],
    ["Agent provider secretları client'a sızıyor mu?", "secret_value", "Agent provider secretları sadece server-side route içinde kalmalı; client response maskeli olmalı."],
    ["Manus varsayılan değil mi?", "Derin Araştırma Uzmanı", "Manus günlük kısa cevap değil, derin araştırma görevleri için konumlandırılmalı."],
    ["Agent run log kalıcı mı?", "agent_runs", "Agent görevleri agent_runs tablosuna yazılmalı."],
    ["Müşteriler ana navigasyonda görünür mü?", "Aktif, pasif ve aday müşteri kayıtlarını yönet.", "Müşteriler ana CRM grubunda ve görünür ilk öğeler arasında olmalı."],
    ["Müşteriler ayarlar altında mı kalmış?", "Müşteri & Satış", "Müşteri yönetimi Ayarlar altında değil, Müşteri & Satış kategorisinde konumlanmalı."],
    ["Agent Hub final_report kolonları bekleniyor mu?", "final_report", "Agent run kayıtları HK Intelligence final raporunu saklamalı."],
    ["Agent Hub scheduled endpoint var mı?", "agent-hub/scheduled", "Planlanmış agent görevleri için API endpoint görünmeli."],
    ["Env eksikse kullanıcı dostu uyarı var mı?", "API anahtarı eklenmedi", "Sağlayıcı kartları eksik API anahtarı durumunu secret göstermeden açıklamalı."],
    ["System Repair Phase 3: gerçek provider runner var mı?", "runRealAgentProvider", "Agent Hub gerçek API key varsa server-side sağlayıcı çağrısı yapmalı."],
    ["System Repair Phase 3: export route güvenli payload üretiyor mu?", "prepared_payload", "Export butonları bozuk link yerine print-ready HTML, metin veya slayt taslağı üretmeli."],
    ["System Repair Phase 3: e-posta gönderim route'u var mı?", "email-send", "E-posta taslağı kullanıcı onayıyla gönderim route'una bağlanmalı."],
    ["System Repair Phase 3: WhatsApp özeti var mı?", "whatsapp-summary", "Agent final raporundan kısa WhatsApp metni üretilebilmeli."],
    ["Agent Hub Slack butonu kaldırıldı mı?", "Slack bildirimi kaldırıldı", "Slack kullanıcı arayüzünden kaldırılmalı; Discord tek bildirim seçeneği olarak kalmalı."],
    ["System Repair Phase 3: webhook bildirimleri var mı?", "DISCORD_WEBHOOK_URL", "Discord webhook env değeri varsa bildirim endpointi çalışmalı."],
    ["System Repair Phase 3: queue yönetimi var mı?", "agent-hub/queue", "Agent görevleri queue panelinde iptal/tekrar çalıştır aksiyonlarıyla izlenmeli."],
    ["System Repair Phase 3: Agent Memory var mı?", "agent_memories", "Müşteri geçmişi ve agent öğrenimleri kalıcı hafızaya yazılmalı."],
    ["System Repair Phase 3: AI Training Center var mı?", "agent_training_rules", "HK Intelligence dil ve risk kuralları yönetilebilir olmalı."],
    ["System Repair Phase 3: Prompt Versioning var mı?", "agent_prompt_versions", "Prompt geçmişi ve geri dönüş migration/API desteği bulunmalı."],
    ["System Repair Phase 3: Benchmark var mı?", "agent_benchmarks", "Aynı prompt farklı sağlayıcılarla kıyaslanabilmeli."],
    ["System Repair Phase 3: Manus endpoint env var mı?", "MANUS_API_ENDPOINT", "Manus endpoint hardcode edilmeden env üzerinden yapılandırılmalı."]
    ,
    ["Agent Hub sekmeleri Türkçe mi?", "İş Akışı Oluşturucu", "Agent Hub sekmeleri ve görünür teknik terimler Türkçe olmalı."],
    ["Auto Router varsayılan mı?", "Otomatik Seçim aktif", "Yeni görev formunda normal kullanıcı Auto Router ile başlamalı."],
    ["AI seçim nedeni gösteriliyor mu?", "AI Seçim Nedeni", "Run sonucunda seçilen sağlayıcının nedeni görünmeli."],
    ["Sonucu Kaydet çalışıyor mu?", "Sonucu Kaydet", "Agent sonucu agent_runs üzerinde kaydedilebilir olmalı."],
    ["AI Hafızasına Kaydet çalışıyor mu?", "AI Hafızasına Kaydet", "Agent sonucu agent_memories tablosuna kaydedilebilir olmalı."],
    ["Demo fallback kullanıcıya açıkça belirtiliyor mu?", "Demo / Yerel Yedek Akış", "Gerçek AI çalışmadığında kullanıcı bunu açıkça görmeli."],
    ["Entegrasyon Kontrolü eksik env'leri gösteriyor mu?", "Entegrasyon Kontrolü", "Eksik API anahtarları secret göstermeden listelenmeli."],
    ["AI provider selector merkezi mi?", "AiProviderSelector", "AI kullanan admin modülleri tek merkezi sağlayıcı seçiciyi kullanmalı."],
    ["Google İstihbarat eski hardcoded listeyi kullanıyor mu?", "Google İstihbarat", "Google İstihbarat modalı Auto Router, Gemini, OpenAI, Claude, Groq, Manus, OpenRouter, Ollama ve Demo sırasını merkezi kaynaktan almalı."],
    ["Tüm AI sağlayıcıları listeleniyor mu?", "unifiedAiProviderOptions", "Sağlayıcı listesi Agent Hub ve diğer modüllerde aynı source of truth üzerinden gelmeli."],
    ["Auto Router en üstte mi?", "Auto AI Router / Otomatik Seçim", "Auto Router tüm AI seçimlerinde ilk ve önerilen seçenek olmalı."],
    ["AI secretları frontend'e sızıyor mu?", "maskedKey", "Provider durum endpointi sadece durum/maskeli bilgi döndürmeli, gerçek API key dönmemeli."],
    ["Manus kısa analizlerde varsayılan mı?", "Manus günlük kısa cevaplar için değil", "Manus yalnız derin araştırma, rakip/pazar analizi ve kapsamlı raporlarda önerilmeli."],
    ["Manuel Groq seçimi Ollama'ya düşüyor mu?", "requestedProvider", "Manuel sağlayıcı seçilirse sistem önce seçilen provider key'i denemeli; Groq seçimi sessizce Ollama'ya dönüşmemeli."],
    ["selectedProvider ile actualProvider farkı açıklanıyor mu?", "actualProvider", "Yedek akış kullanıldığında kullanıcı seçilen ve kullanılan sağlayıcıyı ayrı ayrı görmeli."],
    ["Auto Router sadece auto seçiliyken mi devreye giriyor?", "Manuel seçim yapıldığı için Auto Router devreye girmedi", "Manuel seçimde Auto Router sağlayıcı kararını ezmemeli."],
    ["Provider key alias mapping doğru mu?", "normalizeAiProvider", "groq, gemini, openai, anthropic, manus, openrouter, ollama ve demo alias eşleşmeleri merkezi normalize edilmeli."],
    ["Google İstihbarat sonuç kartları doğru provider gösteriyor mu?", "aiExecutionMetadata", "Google İstihbarat route'u sonuç meta bilgisini istenen ve kullanılan sağlayıcı ayrımıyla üretmeli."],
    ["Sağlayıcı sağlık paneli var mı?", "Sağlayıcı Sağlığı", "Agent Hub içinde son 24 saat başarı, hata, yanıt süresi, maliyet ve router skoru görünmeli."],
    ["HK Intelligence final layer tüm AI çıktılarında çalışıyor mu?", "HK Intelligence final", "AI çıktıları yönetici özeti, riskler, fırsatlar ve aksiyon planı formatına normalize edilmeli."],
    ["Veri Aktarma tam yedek admin-only mi?", "Tüm Sistem Yedeği", "Tam sistem yedeği ve geri yükleme yalnız admin rolüne görünmeli."],
    ["Secret alanlar export dışı mı?", "blockedKeyPattern", "API key, token, secret, şifre hash'i ve auth hassas alanları export edilmemeli."],
    ["Import önizleme olmadan commit yapılamıyor mu?", "confirmedPreview", "Geri yükleme işlemi dosya önizlemesi ve açık onay olmadan database'e yazmamalı."],
    ["Müşteri export butonları var mı?", "Müşteri Bilgilerini İndir", "Müşteriler ekranında Excel, Word, PDF ve CSV indirme aksiyonları bulunmalı."],
    ["Rapor çıktıları screenshot yerine rapor payload kullanıyor mu?", "buildPrintableHtmlReport", "Çıktı alma ekran görüntüsü yerine profesyonel rapor şablonu üretmeli."],
    ["CSV Türkçe karakter desteği var mı?", "\\uFEFF", "CSV/Excel uyumlu dışa aktarımlarda UTF-8 BOM ile Türkçe karakterler korunmalı."],
    ["Export/import log tutuluyor mu?", "data_export_logs", "Dışa ve içe aktarma işlemleri log tablolarına yazılmalı."],
    ["Sistem Rehberi'nin ilk bölümü Bir Müşterinin Serüveni mi?", "bir-musterinin-seruveni", "Rehberin ilk seed'i müşteri serüveni olmalı."],
    ["Müşteri kaydından sözleşme bitimine kadar süreç var mı?", "Sözleşme bitiminde veri yedekleme", "Rehber lead aşamasından kapanış/yedekleme adımına kadar süreci anlatmalı."],
    ["İlgili sayfa butonları bozuk link veriyor mu?", "customerJourneyActions", "Bir Müşterinin Serüveni hızlı aksiyonları mevcut hk-admin route'larına gitmeli."],
    ["Token/API bilgileri için güvenlik uyarısı var mı?", "Token, API anahtarı", "Rehber token ve API anahtarlarının güvenli entegrasyon alanlarına girilmesini belirtmeli."],
    ["Kapanış/pasifleştirme/yedekleme adımları var mı?", "Pasifleştir", "Rehber kapanış, pasife alma, arşivleme ve veri yedekleme adımlarını içermeli."]
    ,
    ["Meta Dataset ID durumu kontrol ediliyor mu?", "META_DATASET_ID", "Website Analytics Center Meta Dataset ID durumunu secret göstermeden kontrol etmeli."],
    ["Google servis hesabı secret sızdırmadan kontrol ediliyor mu?", "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "Google servis hesabı private key değeri sadece server-side var/yok ve format kontrolünden geçmeli."],
    ["GA4 Property ID ve Measurement ID format kontrolü var mı?", "GA4_PROPERTY_ID", "GA4 Property ID numeric, Measurement ID G- formatı kontrol edilmeli."],
    ["Search Console hazırlığı var mı?", "GOOGLE_SEARCH_CONSOLE_SITE_URL", "Search Console site URL ve servis hesabı yetki hazırlığı görünmeli."],
    ["Google Ads env kontrolü var mı?", "GOOGLE_ADS_REFRESH_TOKEN", "Google Ads Customer ID, developer token, OAuth ve refresh token eksikleri listelenmeli."],
    ["Website Analytics kurulum rehberi var mı?", "Meta Dataset ID nasıl alınır?", "Website Analytics Center içinde Meta, Google servis hesabı, Search Console ve Google Ads kurulum rehberi bulunmalı."],
    ["Eksik env sonrası kullanıcı dostu uyarı var mı?", "Eksik Entegrasyonlar", "Eksik env değerleri panik yaratmadan temel/gelişmiş ölçüm ayrımıyla açıklanmalı."],
    ["Müşteri profilinde Entegrasyonlar sekmesi var mı?", "CustomerIntegrationsPanel", "Müşteri detay profilinde Entegrasyonlar sekmesi ve düzenleme paneli bulunmalı."],
    ["customer_integrations tablosu bekleniyor mu?", "customer_integrations", "Müşteri bazlı entegrasyon bilgileri kalıcı customer_integrations tablosuna yazılmalı."],
    ["Setup progress 14 adım üzerinden hesaplanıyor mu?", "getCustomerSetupSteps", "Müşteri kurulum ilerlemesi 14 adımlı helper çıktısından hesaplanmalı."],
    ["Secret değerleri müşteri profilinde açık gösteriliyor mu?", "meta_access_token_masked", "Müşteri profilinde yalnız maskeli/durum alanları tutulmalı; gerçek token/private key saklanmamalı."],
    ["Website Analytics Center müşteri entegrasyon durumunu gösteriyor mu?", "customerIntegrations", "Genel merkez müşteri entegrasyon yüzdesi ve düzenleme linkini göstermeli."],
    ["Entegrasyon düzenleme admin-only mi?", "requireModuleAccess(\"musteriler\")", "Müşteri entegrasyon API route'ları admin/staff yetki kontrolüne bağlı olmalı."],
    ["GA4/GTM/Meta ID validasyonları var mı?", "GA4 Measurement ID G-", "Kaydetmeden önce GA4, GTM, Meta Pixel/Dataset ve Search Console URL formatları doğrulanmalı."]
    ,
    ["HK Intelligence CEO modülü var mı?", "HKAutonomousAgencyCenter", "Autonomous Agency Operating System tek component üzerinden dashboard ve route'a bağlanmalı."],
    ["HK CEO Masası ana ekranda mı?", "HK CEO Masası", "Executive Command Center dashboard üstünde ve ayrı modül olarak görünmeli."],
    ["AI Yardımcı Sohbet route çalışıyor mu?", "hk-intelligence-ceo/copilot", "Copilot doğal dil sorusunu HK Intelligence final layer formatında cevaplamalı."],
    ["Akıllı Komut Merkezi görünüyor mu?", "Akıllı Komut Merkezi", "Komut merkezi müşteri, görev, teklif, agent, rapor, tahsilat ve rehber hedeflerine bağlanmalı."],
    ["Genel Arama merkezi var mı?", "Genel Arama", "Müşteri, görev, belge, rapor, tahsilat, kampanya, komut metni ve hafıza araması kategori bazlı görünmeli."],
    ["Sağlık Merkezi sinyali var mı?", "Sağlık / Maliyet / Yedekleme Merkezi", "Database, Supabase, Storage, Cron, Queue, API ve AI sağlayıcı sağlıkları izlenmeli."],
    ["AI Cost Center sinyali var mı?", "estimated_monthly_cost", "Sanal ajan ve agent run maliyetleri tahmini olarak izlenmeli."],
    ["Backup Center sinyali var mı?", "Otomatik günlük/haftalık/aylık yedek", "Veri Aktarma merkezi backup center mantığıyla günlük, haftalık ve aylık yedek hazırlığı göstermeli."],
    ["Müşteri Zaman Çizelgesi var mı?", "Müşteri Zaman Çizelgesi", "Müşteri olayları kronolojik operasyon zaman çizelgesiyle görünmeli."],
    ["AI Öneri Motoru var mı?", "AI Öneri Motoru", "Her öneride beklenen etki, zorluk, süre, maliyet ve başarı olasılığı bulunmalı."],
    ["Dijital İkiz var mı?", "Dijital İkiz", "Müşteri için Google, Meta, SEO, CRM, rapor, tahsilat ve not bağlamı tek müşteri ikizinde toplanmalı."],
    ["Paket Pazarı hazır paketleri var mı?", "Paket Pazarı", "Sektör paketleri komut metni, iş akışı, AI ekibi, KPI ve rapor şablonuyla görünmeli."],
    ["Çok şubeli yapı migrationı var mı?", "customer_branches", "Müşterinin birden fazla şubesini aynı panel altında ayıran tablo beklenmeli."],
    ["HK Intelligence Final Layer zorunlu mu?", "HK Intelligence Final Layer", "Hiçbir AI çıktısı doğrudan değil, final karar katmanı üzerinden sunulmalı."],
    ["Secret client'a dönüyor mu?", "secretsReturned: false", "Status endpointleri secret değerleri yerine yalnız hazır/eksik durumunu döndürmeli."]
    ,
    ["HK CEO kartları tıklanabilir mi?", "openDetail", "CEO ekranındaki kartlar modal, yönlendirme veya hazırlık verisi aksiyonuna bağlanmalı."],
    ["Paket Pazarı komut metni üretimi çalışıyor mu?", "marketplace/generate", "Paket Pazarı komut metni, iş akışı, KPI, rapor ve teklif çıktısı üreten route kullanmalı."],
    ["Yeni Paket Üret butonu var mı?", "Yeni Paket Üret", "Paket Pazarı üstünde yeni paket modalı açan aksiyon bulunmalı."],
    ["Akıllı Komut Merkezi linkleri bozuk mu?", "commandToTarget", "Komut satırları mevcut admin modül hedeflerine yönlenmeli."],
    ["Copilot cevap veriyor mu?", "HK Intelligence ile Yanıtla", "Copilot route bağlamla Türkçe cevap üretmeli ve aksiyon butonları göstermeli."],
    ["Agent kartları düzenleniyor mu?", "hk-intelligence-ceo/agents", "Sanal ajanlar API üzerinden listelenebilir, düzenlenebilir ve çalıştırma hazırlık verisi üretebilir olmalı."],
    ["Operasyon takvimi düzenleniyor mu?", "hk-intelligence-ceo/operations", "Operasyon takvimi GET/POST/PATCH route'larıyla planlanabilir olmalı."],
    ["Risk/öneri görev oluşturabiliyor mu?", "convert-task", "Öneriler görev hazırlık verisine veya agency_tasks kaydına dönüşebilmeli."],
    ["Migration SQL final raporda veriliyor mu?", "hk_ceo_functional_actions", "Yeni migration SQL'i final raporda SQL Editor için tam içerikle paylaşılmalı."]
    ,
    ["Paket Pazarı Müşteriye Uygula gerçek müşteri seçtiriyor mu?", "Paketi Müşteriye Uygula", "Paket uygulama sihirbazı müşteri arama/seçim adımı göstermeli."],
    ["Uygulama sonrası kayıt oluşuyor mu?", "hk_marketplace_package_applications", "Paket uygulama sonucu log tablosuna result_summary ve created_records yazmalı."],
    ["AI Hafızası kaydı oluşuyor mu?", "marketplace_package", "Paket stratejisi agent_memories içine marketplace_package türüyle kaydedilmeli."],
    ["Görev taslakları oluşuyor mu?", "30 günlük görev planı oluştur", "Uygulama sihirbazı agency_tasks kayıtları veya görev hazırlık verisi üretmeli."],
    ["Müşteri notu oluşuyor mu?", "Müşteri notu oluştur", "Uygulama sonucu customer_updates veya güvenli payload ile müşteri notu üretmeli."],
    ["Müşteri profil popup açılıyor mu?", "CustomerProfileModal", "Müşteriyi Görüntüle aksiyonları müşteriler ekranıyla ortak modal component'i açmalı."],
    ["Popup X ile kapanıyor mu?", "onClose", "Müşteri profil popup X butonuyla kapanmalı."],
    ["Popup dışına tıklayınca kapanıyor mu?", "event.currentTarget", "Popup overlay dış tıklamayla kapanmalı."],
    ["Popup iç scroll çalışıyor mu?", "overflow-y-auto", "Popup içerik alanı max-height içinde scroll olmalı."],
    ["Boş hazırlık verisi gösterip işlem yapmayan modal kaldı mı?", "Paketi Uygula", "Paket uygulama modalı gerçek uygulama butonuna ve kayıt route'una bağlanmalı."]
    ,
    ["Paket Pazarı başarı ekranı JSON yerine Türkçe özet gösteriyor mu?", "Paket müşteriye uygulandı", "Paket uygulama sonucu teknik JSON yerine kullanıcı dostu kayıt kartları göstermeli."],
    ["Oluşan kayıtlara yönlendirme butonları var mı?", "Sonraki Adımlar", "Başarı ekranında müşteri, görev, hafıza, iş akışı, rapor, teklif ve uygulama kaydı butonları bulunmalı."],
    ["Müşteri popup müşteriler ekranındaki modal ile aynı component'i kullanıyor mu?", "CustomerProfileModal", "HK CEO ve Müşteriler ekranı aynı shared müşteri profil modalını kullanmalı."],
    ["Escape ile kapanıyor mu?", "Escape", "Shared müşteri modalı Escape tuşuyla kapanmalı."],
    ["HK CEO ekranında İngilizce başlık kaldı mı?", "AI Yardımcı Sohbet", "AI Yardımcı Sohbet, Paket Pazarı ve Genel Arama başlıkları Türkçe görünmeli."],
    ["Teknik terimler Türkçeleştirildi mi?", "Hazırlık verisi", "Hazırlık verisi, iş akışı, taslak ve şablon kullanıcı arayüzünde Türkçe karşılıklarla gösterilmeli."],
    ["Uygulanan paketler müşteri profilinde görünüyor mu?", "Uygulanan Paketler", "Müşteri profil modalında paket uygulama kayıtları özetlenmeli."]
    ,
    ["Paket uygulama sonrası operasyon paneli var mı?", "Uygulanan Plan Sonrası Operasyon Paneli", "Başarı ekranı kayıt, metrik ve planları tek operasyon panelinde göstermeli."],
    ["Ne yapıldı kartı gösteriliyor mu?", "Ne Yapıldı?", "Paket uygulandıktan sonra kullanıcıya kısa ve net işlem özeti gösterilmeli."],
    ["Yapılacaklar listesi oluşuyor mu?", "Yapılacaklar", "Paket sonrası sorumlu AI ajanı ve öncelik bilgisiyle yapılacaklar listesi görünmeli."],
    ["Takip edilecek metrikler oluşuyor mu?", "Takip Edilecek Metrikler", "KPI metrikleri açıklama, hedef, kaynak ve kontrol sıklığıyla görünmeli."],
    ["7 günlük ve 30 günlük plan oluşuyor mu?", "İlk 30 Günlük Plan", "Uygulama sonucu 7 günlük ve 30 günlük plan kartları üretmeli."],
    ["Yeni Paket Üret ile özel sektör paketi oluşturulabiliyor mu?", "AI Destekli Yeni Paket Üret", "Kullanıcı sektör, niş, bütçe, rekabet ve teklif diliyle yeni paket üretebilmeli."],
    ["Benim Paketlerim listeleniyor mu?", "Benim Paketlerim", "Kaydedilmiş kullanıcı paketleri hazır paketlerden ayrı görünmeli."],
    ["Paketi Aç modalı okunabilir sekmeli mi?", "Satış Argümanları", "Paket detayı komut metni, iş akışı, KPI, rapor, teklif, risk/fırsat ve satış argümanlarını ayrı başlıklarda göstermeli."]
    ,
    ["Yeni Paket Üret AI ile otomatik dolduruyor mu?", "AI ile Doldur", "Paket üretici AI ile Otomatik Doldur modunda sektör bağlamından strateji, plan, KPI, teklif ve içerik fikirleri üretmeli."],
    ["Manuel mod hâlâ çalışıyor mu?", "Manuel Doldur", "Paket üretici manuel modda alanları elle doldurup Paketi Önizle aksiyonuyla hazırlık verisi üretebilmeli."],
    ["Benim Paketlerim çalışıyor mu?", "Benim Paketlerim", "Kaydedilen paketler hazır paketlerden ayrı listelenmeli ve Paketi Aç / Müşteriye Uygula aksiyonları çalışmalı."],
    ["Müşteri profilinde Şubeler sekmesi var mı?", "Şubeler", "Ortak müşteri profil modalında şube kartları ve şube aksiyonları görünmeli."],
    ["Şube ekleme/düzenleme çalışıyor mu?", "Şube Ekle", "Müşteri profilinde Şube Ekle ve Şubeyi Düzenle aksiyonları mevcut müşteri yönetimi akışına yönlenmeli."],
    ["Müşteri + şube filtresi ortak component ile kullanılıyor mu?", "CustomerBranchFilter", "Paket uygulama sihirbazı müşteri + şube seçimini ortak CustomerBranchFilter bileşeniyle yapmalı."],
    ["Paket şubeye uygulanabiliyor mu?", "branch_id", "Marketplace apply route branch_id değerini uygulama loguna yazmalı ve şube bağlamını plan özetine eklemeli."],
    ["Ajans operasyon planları üretiliyor mu?", "social_media_plan", "Paket üretici sosyal medya planı, onay akışı, kampanya operasyonu, müşteri iletişimi ve rapor onay akışı üretmeli."],
    ["İngilizce/teknik ifadeler temiz mi?", "AI ile Otomatik Doldur", "Kullanıcı arayüzünde workflow/draft/payload yerine iş akışı, taslak ve hazırlık verisi karşılıkları kullanılmalı."],
    ["Secret frontend'e sızıyor mu?", "secret", "Yeni şube ve paket akışları token/private key değerlerini client tarafına taşımamalı."]
    ,
    ["Şube Ekle formu gerçekten açılıyor mu?", "Yeni Şube Ekle", "Müşteri profilindeki Şube Ekle butonu gerçek modal/drawer formu açmalı."],
    ["Google Maps butonu doğru URL açıyor mu?", "googleMapsTarget", "Şubede Google Maps URL varsa onu, yoksa adres/şehir/ilçe arama URL'ini açmalı."],
    ["Agent analizi context ile açılıyor mu?", "branchId", "Şube analizi Agent Hub'a companyId, branchId ve taskType query bağlamıyla gitmeli."],
    ["Şube raporu boş sayfa yerine rapor payload üretiyor mu?", "Şube Raporu Hazırla", "Şube raporu en az print-ready veya JSON hazırlık verisi üretmeli."],
    ["Telefon format helper tüm formlarda kullanılıyor mu?", "formatTurkishPhone", "Telefon ve WhatsApp alanları ortak 0 (***) *** ** ** format helper'ını kullanmalı."],
    ["yok / mevcut değil validasyonu kabul ediliyor mu?", "isEmptyLikeValue", "Boş, yok, mevcut değil ve - değerleri opsiyonel alanlarda hata üretmemeli."],
    ["Müşteri popup geniş ve sekmeli mi?", "max-w-6xl", "Müşteri popup dar görünmemeli; kendi içinde scroll ve geniş layout kullanmalı."],
    ["Rakipler sekmesi var mı?", "Rakipler", "Müşteri profilinde rakip kayıtları ve Rakip Analizi yönlendirmesi görünmeli."],
    ["Muhasebe menüsü yetkisiz kullanıcıya gizli mi?", "Muhasebe", "Tahsilat, kârlılık ve finans export alanları admin/finance yetkisine bağlanmalı."],
    ["Müşteriye gösterilsin toggle'ı var mı?", "Müşteriye gösterilsin", "Görev ve müşteriyle ilişkili kayıtlarda müşteri görünürlüğü açıkça yönetilmeli."],
    ["Kritik işlemler ActionResultPanel kullanıyor mu?", "ActionResultPanel", "Şube ve toplu görev gibi önemli işlemlerden sonra ne oldu/sonraki adım paneli görünmeli."],
    ["API response içinde actionResult var mı?", "actionResult", "Yeni veya güncellenen route'lar standart işlem sonucu payload'ı döndürmeli."],
    ["Raw JSON kullanıcıya açık gösteriliyor mu?", "Teknik detayı göster", "Ham teknik detaylar varsayılan kapalı accordion içinde kalmalı."],
    ["İşlem sonrası Ne oldu alanı var mı?", "Ne oldu?", "Önemli işlemlerden sonra kullanıcıya işlemin sonucu açıklanmalı."],
    ["İşlem sonrası şimdi ne yapmalısın alanı var mı?", "Şimdi ne yapmalısın?", "İşlem sonrası takip edilecek öneriler gösterilmeli."],
    ["Nereden kontrol edeceksin butonları var mı?", "checkLinks", "İşlem sonucu panelinde ilgili sayfalara güvenli yönlendirme butonları bulunmalı."]
    ,
    ["Rakip listesi ham JSON göstermiyor mu?", "Rakip İstihbarat Merkezi", "Rakip Analizi ekranı ham JSON textarea yerine kart, tablo ve teknik detay accordion düzeni kullanmalı."],
    ["AI ile rakip bul öneri kartları üretiyor mu?", "Rakip olarak kaydet", "AI ile Rakip Bul akışı önerileri kart halinde göstermeli ve seçilenleri rakip listesine kaydetmelidir."],
    ["Rakip kaydetme çalışıyor mu?", "/api/admin/competitors", "Rakip kaydı GET/POST/PATCH route’larıyla competitor_watchlist tablosuna yazılmalıdır."],
    ["Rakip bildirim ayarları çalışıyor mu?", "notify-settings", "Yeni reklam, paylaşım, yorum, web sitesi ve fiyat/kampanya bildirim tercihleri route üzerinden güncellenmelidir."],
    ["Rakip kontrol sonucu ActionResultPanel gösteriyor mu?", "Rakip kontrolü tamamlandı", "Rakip kontrolünden sonra ne oldu, hangi sinyal oluştu ve sonraki adım ActionResultPanel ile anlatılmalıdır."],
    ["Müşteri profilinde Rakipler sekmesi gerçek veriye bağlı mı?", "competitorWatchlist", "Müşteri profilindeki Rakipler bölümü competitorWatchlist verisinden son kontrol, bildirim ve görünürlük durumunu göstermelidir."],
    ["Müşteriye gösterilsin toggle’ı kritik modüllerde var mı?", "Müşteriye gösterilsin", "Rakip, görev, rapor, belge ve müşteriyle ilişkili kayıtlarda müşteri görünürlüğü açıkça yönetilmelidir."],
    ["Müşteri paneli sadece görünür kayıtları gösteriyor mu?", "competitorSummaries", "Müşteri paneli yalnız show_to_customer veya show_customer_summary açık rakip özetlerini göstermelidir."],
    ["Rakip analizinde Müşteriye Gönderilecek Özet alanı var mı?", "Müşteriye Gönderilecek Özet", "Admin teknik analizi ile müşteriye gönderilecek sade özet ayrı bölümlerde tutulmalıdır."],
    ["Admin analizi ve müşteri özeti ayrıldı mı?", "Admin İç Analiz", "Teknik gözlemler, iç operasyon notları ve müşteri metni farklı alanlarda görünmelidir."],
    ["Ham JSON müşteriye gösterilmiyor mu?", "Teknik Detayı Göster", "Teknik payload varsayılan kapalı teknik detay alanında kalmalı; müşteri paneline taşınmamalıdır."],
    ["WhatsApp özeti kopyalama çalışıyor mu?", "WhatsApp Özeti Kopyala", "Müşteriye gönderilecek rakip özeti kısa ve sade WhatsApp metni olarak kopyalanabilmelidir."],
    ["Google Maps gerçek rakip buluyor mu?", "/api/admin/competitors/discover", "Rakip keşfi server-side Google Maps Places endpoint’iyle çalışmalı; anahtar yoksa yedek akış açıkça belirtilmelidir."],
    ["Meta API varsa reklam sinyali geliyor mu?", "META_ACCESS_TOKEN", "Meta Ad Library erişimi server-side kontrol edilmeli; token yoksa sahte gerçek veri gibi gösterilmemelidir."],
    ["Rakip skoru hesaplanıyor mu?", "competitor_score", "Her rakip 0-100 arası rakip skoru ile önceliklendirilmelidir."],
    ["Tehdit/fırsat skoru üretiliyor mu?", "threat_score", "Rakip kartlarında tehdit skoru ve fırsat skoru ayrı gösterilmelidir."],
    ["Kaç rakip seçimi çalışıyor mu?", "Kaç rakip bulunsun", "Kullanıcı 5, 10, 20 veya 50 rakip hedefi seçebilmelidir."],
    ["Otomatik müşteri profilinden veri çekiyor mu?", "Profil bilgilerinden doldur", "Müşteri profilinden sektör, il, ilçe, adres ve şube bilgileri discovery formuna taşınmalıdır."],
    ["Manuel arama çalışıyor mu?", "Manuel Rakip Arama", "Kullanıcı müşteri profilinden bağımsız sektör, il, ilçe, yarıçap, rakip tipi ve minimum skor filtresi girebilmelidir."],
    ["Rakip kayıtları müşteri profiline bağlanıyor mu?", "Rakip skoru:", "Müşteri profilindeki Rakipler bölümü kayıtlı rakiplerin skorlarını, son Maps/Meta kontrolünü ve görünürlük durumunu göstermelidir."],
    ["Rakip keşfi adımlı akışa sahip mi?", "Rakip Keşif Akışı", "Rakip Analizi ekranı profil doldurma, alt niş, Maps keşfi, skor, kayıt ve müşteri özeti sırasını göstermelidir."],
    ["Alt niş önerileri üretiliyor mu?", "Alt Niş Öner", "Sektöre göre seçilebilir alt niş önerileri üretip Maps aramasına dahil etmelidir."],
    ["Seçilenler kaydediliyor mu?", "Seçilenleri Kaydet", "Bulunan rakipler tek tek veya toplu olarak competitor_watchlist kaydına dönüştürülmelidir."],
    ["Müşteri özeti oluşturuluyor mu?", "Müşteri Özeti Oluştur", "En güçlü rakipler, yorum sinyali, reklam sinyali ve yerel fırsatlardan sade müşteri özeti hazırlanmalıdır."],
    ["Admin API kullanılıyor mu?", "Admin entegrasyonu", "Google Maps ve Meta Ad Library çağrıları müşteri API bilgisi istemeden HK Dijital admin ENV değerleriyle server-side çalışmalıdır."],
    ["Müşteri API’sine bağımlılık yok mu?", "Müşteriden ayrıca API anahtarı istenmez", "Rakip keşfi müşteri profilindeki API alanlarına zorunlu bağımlılık kurmamalıdır."],
    ["Rakip detay modalı var mı?", "Detaylı Rakip İncelemesi", "Detaylı Gör aksiyonu genel bilgi, Maps verisi, reklam sinyali, skor detayı ve teknik detay sekmelerini modalda göstermelidir."]
    ,
    ["Takip Edilen Rakipler paneli var mı?", "Takip Edilen Rakipler", "Rakip Analizi ekranında izlemeye alınmış rakipler ayrı panelde, skor ve son kontrol bilgisiyle görünmelidir."],
    ["Yeni Sinyaller paneli var mı?", "Yeni Sinyaller", "Rakip değişimleri competitor_signals verisinden yeni sinyal kartları olarak gösterilmelidir."],
    ["Periyodik kontrol endpoint’i çalışıyor mu?", "/api/admin/competitors/check-due", "Kontrol zamanı gelen rakipleri skorlayıp sinyal oluşturan cron-ready endpoint bulunmalıdır."],
    ["Rakip toplu işlem endpoint’i var mı?", "/api/admin/competitors/bulk", "Kaydet, takip, görünürlük, bildirim, arşiv, pasif ve sil aksiyonları toplu route üzerinden yapılmalıdır."],
    ["Rakip sinyalleri müşteri bazlı görünüyor mu?", "competitorSignals", "Center-data ve müşteri profil popup competitor_signals kayıtlarını müşteri bağlamında göstermelidir."],
    ["Müşteriye göster/gizle toggle’ı çalışıyor mu?", "show_to_customer", "Rakip ve sinyal kartlarında müşteri görünürlüğü açıkça yönetilmelidir."],
    ["Sinyalden görev oluşturulabiliyor mu?", "Görev Oluştur", "Yeni sinyal kartları görev taslağı veya görev ekranı aksiyonuna bağlanmalıdır."],
    ["Müşteri özeti teknik detaydan ayrılmış mı?", "Müşteriye Gönderilecek Özet", "Rakip sinyal ve rakip analizlerinde teknik detay kapalı, müşteri özeti sade dilde olmalıdır."],
    ["Tam Sistem Onarım Taraması var mı?", "Tam Sistem Onarım Taraması", "QA Center bulguları çalışmayan buton, hrefsiz link, siyah buton, müşteri görünürlüğü ve secret risklerini anlaşılır açıklamalıdır."],
    ["Gelir Tahmini Muhasebe altında mı?", "label: \"Muhasebe\"", "Gelir Tahmini finansal karar ekranıdır; Ajans Operasyonu altında değil Muhasebe grubunda bulunmalıdır."],
    ["Finansal sayfalar yetkisiz kullanıcıya kapalı mı?", "canViewAccounting", "Muhasebe grubu admin, owner, finance veya açık muhasebe yetkisi olan kullanıcılarla sınırlanmalıdır."],
    ["Muhasebe sayfaları tek merkezde toplandı mı?", "Muhasebe Merkezi", "Tahsilat, bekleyen ödeme, gelir/gider, gelir tahmini, kârlılık, müşteri finans özeti ve dışa aktarım tek Muhasebe Merkezi altında sekmelerle yönetilmelidir."],
    ["Gelir tahmini Muhasebe Merkezi içinde mi?", "gelir-tahmini", "Gelir Tahmini ayrı ana menü kalemi gibi kalmamalı; Muhasebe Merkezi sekmesi veya eski route yönlendirmesi olarak çalışmalıdır."],
    ["Bekleyen ödemeler sekme olarak çalışıyor mu?", "bekleyen", "Bekleyen Ödemeler ana menü kalabalığı oluşturmadan Muhasebe Merkezi içinde filtreli tahsilat görünümü olarak açılmalıdır."],
    ["Muhasebe rapor çıktıları payload mı?", "PDF-ready HTML", "Muhasebe raporları ekran görüntüsü yerine CSV, PDF-ready HTML veya Word uyumlu metin çıktısı üretmelidir."],
    ["Muhasebede müşteriye gösterilsin toggle’ı var mı?", "visible_to_customer", "Tahsilat veya finans kayıtlarında müşteri paneli görünürlüğü açıkça yönetilmelidir."],
    ["Muhasebe siyah buton kullanıyor mu?", "bg-cyan", "Muhasebe Merkezi aksiyonları siyah primary yerine cyan, mavi, yeşil, sarı veya kırmızı anlam renkleriyle verilmelidir."],
    ["Duplicate menü kaydı var mı?", "QA Merkezi", "QA Merkezi, Sistem Sağlık Merkezi ve Sistem Test Merkezi tek profesyonel kategoride görünmeli; Araçlar altında tekrar etmemelidir."],
    ["Boş/yanlış route var mı?", "getAdminHref", "Navigation slug değerleri mevcut /hk-admin route yapısını bozmadan canonical route üretmelidir."],
    ["Menü açıklamaları Türkçe mi?", "description", "Admin menü açıklamaları kısa, Türkçe ve kullanıcıya yol gösteren metinler olmalıdır."],
    ["Ana kategoriler mantıklı mı?", "Kontrol Merkezi", "Kontrol, Müşteri & Satış, Reklam & Raporlama, Ajans Operasyonu, Muhasebe, İçerik & AI, Entegrasyonlar, Araçlar & Yardım ve Ayarlar kategorileri korunmalıdır."]
  ].forEach(([title, pattern, recommendation]) => {
    const inSource = sourceContains(pattern) || migrations.includes(String(pattern).toLocaleLowerCase("tr"));
    if (!inSource) findings.push(makeFinding({ category: "Ajans Operasyonu QA", severity: "orta", module: "Ajans Operasyon Kalıcılığı", file_path: "src/components/admin/AdminDashboard.tsx", title, description: `${pattern} sinyali statik analizde bulunamadı.`, recommendation }));
  });

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
    const rawIssues = [
      ...checks.filter((item) => !item.ok).map((item) => ({ ...item, priority: classify(item.detail), category: item.check, title: `${item.module}: ${item.check}`, description: item.detail, recommendation: "İlgili route, API veya migration eşleşmesini doğrulayın." })),
      ...staticFindings.map((item) => ({ ...item, check: item.category, ok: false, priority: item.severity, detail: item.description }))
    ];
    const issues = rawIssues.map(enrichIssue);
    const repairPlan = buildRepairPlan(issues);
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
      repairPlan,
      help: {
        title: "Bu ekran ne işe yarar?",
        description: "QA Center, sistemde çalışmayan butonları, eksik migrationları, bozuk API bağlantılarını, güvenlik risklerini, eksik yönlendirmeleri ve teknik borçları kontrol eder. Buradaki uyarılar sistemin hemen çöktüğü anlamına gelmez; hangi alanların güçlendirilmesi gerektiğini gösterir.",
        primaryAction: "Öncelikli onarım planını göster"
      },
      migrationSuggestions: issues.filter((item) => item.check === "Supabase şema" || item.category === "Migration Eksikleri"),
      mode: "Statik kod ve migration analizi"
    });
  } catch (error) {
    await recordActionFailure({ session, entity: "QA Merkezi", action: "QA taraması", error }).catch(() => null);
    return NextResponse.json({ error: error instanceof Error ? error.message : "QA taraması başarısız oldu." }, { status: 500 });
  }
}
