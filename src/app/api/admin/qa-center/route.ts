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
    "src/components/admin/AgentHubCenter.tsx",
    "src/components/admin/AdInsightsCenter.tsx",
    "src/components/admin/Phase2OperatingSystem.tsx",
    "src/lib/admin-navigation.ts",
    "src/lib/agent-hub.ts",
    "src/lib/system-guide-content.ts",
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
    ["Manus kısa analizlerde varsayılan mı?", "Manus günlük kısa cevaplar için değil", "Manus yalnız derin araştırma, rakip/pazar analizi ve kapsamlı raporlarda önerilmeli."]
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
