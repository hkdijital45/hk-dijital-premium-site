import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { adminNavigationItems, getCanonicalAdminSlug, getAdminSectionBySlug } from "@/lib/admin-navigation";
import { adminModules } from "@/lib/permissions";

// Test Merkezi's live diagnostic run — read-only, no writes to any business
// table. The only write this route performs is appending its own summary
// row to public.system_test_runs (existing table, existing schema — see
// supabase/migrations/20260619_system_test_center.sql — previously never
// written to by anything in this repo).
//
// Every check is independently wrapped so one slow/failing provider never
// takes the whole run down; each has its own short timeout.

type CheckResult = { name: string; status: "pass" | "warning" | "fail" | "not_verified"; detail: string };
type Category = { key: string; label: string; checks: CheckResult[] };

const TIMEOUT_MS = 4000;

async function withTimeout<T>(promise: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))
  ]);
}

async function tableReachable(table: string): Promise<CheckResult> {
  try {
    await withTimeout(supabaseRest(`${table}?select=id&limit=1`));
    return { name: table, status: "pass", detail: "Tablo erişilebilir." };
  } catch (error) {
    return { name: table, status: "fail", detail: error instanceof Error ? error.message.slice(0, 160) : "Erişilemedi." };
  }
}

export async function POST() {
  const session = await requireModuleAccess("operational-quality");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  const categories: Category[] = [];

  // --- System Health ---
  const supabaseConfigured = hasSupabaseConfig();
  const criticalEnv = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "INSTAGRAM_MCP_AUTH_SECRET"];
  categories.push({
    key: "system-health",
    label: "Sistem Sağlığı",
    checks: [
      { name: "Supabase yapılandırması", status: supabaseConfigured ? "pass" : "fail", detail: supabaseConfigured ? "URL ve service-role anahtarı tanımlı." : "Supabase env değişkenleri eksik." },
      ...criticalEnv.map((key): CheckResult => ({
        name: `ENV: ${key}`,
        status: process.env[key] ? "pass" : "fail",
        detail: process.env[key] ? "Tanımlı (değer gösterilmiyor)." : "Tanımlı değil."
      }))
    ]
  });

  // --- Database ---
  const canonicalTables = ["companies", "leads", "social_content_plan_items", "pre_audit_reports", "system_test_runs"];
  const dbChecks = supabaseConfigured
    ? await Promise.all(canonicalTables.map(tableReachable))
    : canonicalTables.map((t): CheckResult => ({ name: t, status: "not_verified", detail: "Supabase yapılandırılmadı." }));
  categories.push({ key: "database", label: "Veritabanı", checks: dbChecks });

  // --- Auth & Security ---
  categories.push({
    key: "auth-security",
    label: "Auth & Güvenlik",
    checks: [
      { name: "Bu istek zaten oturum doğrulaması gerektirdi", status: "pass", detail: `Oturum: ${session.email || "doğrulandı"}.` },
      { name: "Permission modül kayıt defteri", status: adminModules.length > 0 ? "pass" : "fail", detail: `${adminModules.length} modül tanımlı.` },
      { name: "RLS (canlı doğrulama)", status: "not_verified", detail: "Bu rota service-role ile çalışır; anon-key RLS testi bu uçtan güvenle yapılamaz." }
    ]
  });

  // --- Navigation ---
  const slugs = adminNavigationItems.map((i) => i.slug);
  const duplicateSlugs = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  const sampleLegacySlugs = ["tahsilat", "gelir-tahmini", "karlilik", "rapor-ciktilari", "rapor-disa-aktar", "meta-raporlari", "google-ads-raporlari"];
  const redirectChecks = sampleLegacySlugs.map((slug): CheckResult => {
    const canonical = getCanonicalAdminSlug(slug);
    const resolved = canonical.split("?")[0] === slug ? null : getAdminSectionBySlug(canonical.split("?")[0]);
    const ok = canonical !== slug && (resolved || canonical.includes("muhasebe?tab="));
    return { name: `redirect: ${slug}`, status: ok ? "pass" : "fail", detail: ok ? `→ ${canonical}` : "Legacy slug çözümlenemedi." };
  });
  categories.push({
    key: "navigation",
    label: "Navigasyon",
    checks: [
      { name: "Duplicate slug taraması", status: duplicateSlugs.length ? "fail" : "pass", detail: duplicateSlugs.length ? `Tekrarlanan slug: ${[...new Set(duplicateSlugs)].join(", ")}` : `${slugs.length} navigasyon girişi, tekrar yok.` },
      ...redirectChecks
    ]
  });

  // --- Core Modules (route file presence) ---
  const criticalPages = [
    ["Dashboard", "src/app/hk-admin/page.tsx"],
    ["Ön İnceleme Merkezi", "src/app/hk-admin/on-inceleme/page.tsx"],
    ["Muhasebe", "src/app/hk-admin/[module]/page.tsx"],
    ["Reklam Doktoru Pro", "src/app/hk-admin/ad-insights/page.tsx"],
    ["Test Merkezi", "src/app/hk-admin/operasyonel-kalite-merkezi/page.tsx"]
  ] as const;
  categories.push({
    key: "core-modules",
    label: "Kritik Modüller",
    checks: criticalPages.map(([name, file]): CheckResult => ({
      name,
      status: existsSync(path.join(process.cwd(), file)) ? "pass" : "fail",
      detail: existsSync(path.join(process.cwd(), file)) ? "Rota dosyası mevcut." : "Rota dosyası bulunamadı."
    }))
  });

  // --- MCP ---
  let mcpChecks: CheckResult[];
  try {
    const protocolPath = path.join(process.cwd(), "src/lib/instagram-intelligence/mcp/protocol.ts");
    const protocolSource = readFileSync(protocolPath, "utf8");
    const toolNames = [...protocolSource.matchAll(/name: "([a-z_]+)"/g)].map((m) => m[1]);
    const duplicateTools = toolNames.filter((n, i) => toolNames.indexOf(n) !== i);
    const expectedCritical = ["get_pre_audit_context", "save_pre_audit_report", "get_latest_pre_audit_report", "create_content_plan", "get_ads_strategy_context"];
    const missing = expectedCritical.filter((n) => !toolNames.includes(n));
    mcpChecks = [
      { name: "Tool registry (statik)", status: "not_verified", detail: `${toolNames.length} tool bulundu (${toolNames.length} statik dosya taraması — canlı MCP client bağlı değil).` },
      { name: "Duplicate tool adı", status: duplicateTools.length ? "fail" : "pass", detail: duplicateTools.length ? duplicateTools.join(", ") : "Tekrar yok." },
      { name: "Kritik tool'lar kayıtlı mı", status: missing.length ? "fail" : "pass", detail: missing.length ? `Eksik: ${missing.join(", ")}` : "Pre-Audit + content-plan + ads-strategy tool'ları mevcut." }
    ];
  } catch {
    mcpChecks = [{ name: "Tool registry", status: "not_verified", detail: "protocol.ts okunamadı." }];
  }
  categories.push({ key: "mcp", label: "MCP", checks: mcpChecks });

  // --- Integrations ---
  categories.push({
    key: "integrations",
    label: "Entegrasyonlar",
    checks: [
      { name: "Instagram MCP secret", status: process.env.INSTAGRAM_MCP_AUTH_SECRET ? "pass" : "fail", detail: process.env.INSTAGRAM_MCP_AUTH_SECRET ? "Tanımlı." : "Tanımlı değil." },
      { name: "Müşteri bazlı Meta/Google/Instagram bağlantıları", status: "not_verified", detail: "Sistem geneli değil, müşteriye özeldir — bağlantı durumu için ilgili müşteri profilini kullanın." }
    ]
  });

  // --- Summary + persistence ---
  const allChecks = categories.flatMap((c) => c.checks);
  const successCount = allChecks.filter((c) => c.status === "pass").length;
  const warningCount = allChecks.filter((c) => c.status === "warning").length;
  const errorCount = allChecks.filter((c) => c.status === "fail").length;
  const notVerifiedCount = allChecks.filter((c) => c.status === "not_verified").length;
  const total = allChecks.length;
  const score = Math.max(0, Math.round(100 - (errorCount / total) * 100 - (warningCount / total) * 30));
  const status = errorCount > 0 ? "CRITICAL" : warningCount > 0 ? "WARNING" : "HEALTHY";

  const run = {
    score,
    status,
    total_tests: total,
    success_count: successCount,
    warning_count: warningCount,
    error_count: errorCount,
    tester_id: session.profileId || null,
    tester_name: session.fullName || session.email || "Test Merkezi",
    summary: `${status} — ${successCount}/${total} başarılı, ${warningCount} uyarı, ${errorCount} hata, ${notVerifiedCount} doğrulanamadı.`,
    results: categories,
    issues: allChecks.filter((c) => c.status === "fail" || c.status === "warning"),
    recommendations: []
  };

  if (supabaseConfigured) {
    await supabaseRest("system_test_runs", { method: "POST", body: JSON.stringify(run) }).catch(() => null);
  }

  return NextResponse.json({ status, score, total, successCount, warningCount, errorCount, notVerifiedCount, categories });
}
