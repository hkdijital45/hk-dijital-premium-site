// FULL AUTO readiness engine. The single source of truth for "is subsystem
// X actually capable of running completely unattended right now" — every
// check is a live, real query against actual configuration/connectivity/
// data, never a hardcoded true. Each of the 16 named subsystems reports
// READY / WARNING / NOT_READY (never a bare boolean) so partial
// degradation is visible instead of a binary works/doesn't-work signal.
//
// AI provider checks (ai_strategy_provider, ai_content_provider) and the
// Reel/voice/image/video provider checks are informational, not
// overall-gating — see the `optional` set below. Runtime AI is never
// required for FULL AUTO carousel/static execution: when
// ai_operating_mode isn't "optional_api_ai", those checks are marked
// optional and the quality engine reports itself READY on local
// deterministic checks alone, exactly like the standalone build this
// module was ported from.
import { supabaseRest, hasSupabaseConfig, getSupabaseWarning } from "@/lib/supabase";
import { instagramAppCredentials, INSTAGRAM_SCOPES } from "./instagram-graph-client";
import { isAutoMediaAvailableFor, resolveMediaProviderFor } from "./media/registry.ts";
import { notConfiguredImageProvider } from "./media/providers/not-configured-image-provider";
import { notConfiguredVoiceProvider } from "./media/providers/not-configured-voice-provider";
import { notConfiguredVideoProvider } from "./media/providers/not-configured-video-provider";
import { SOCIAL_WORKSPACE_ID } from "./types";
import type { ContentType, SocialAutopilotSettings, SocialIntegration, ReadinessCheck, ReadinessReport, ReadinessStatus } from "./types";

const ALL_CONTENT_TYPES: ContentType[] = ["reel", "carousel", "static", "story"];
const STORAGE_BUCKET = "hk-dijital-media"; // matches src/lib/supabase.ts's uploadToSupabaseStorage — not env-configurable in this codebase

function overallFrom(checks: ReadinessCheck[]): ReadinessStatus {
  if (checks.some((check) => check.status === "NOT_READY")) return "NOT_READY";
  if (checks.some((check) => check.status === "WARNING")) return "WARNING";
  return "READY";
}

function isAnyAiProviderConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
}

async function getSettingsRow(): Promise<SocialAutopilotSettings | null> {
  const rows = await supabaseRest<SocialAutopilotSettings[]>(`social_autopilot_settings?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&limit=1`);
  return rows[0] || null;
}

async function getInstagramIntegrationRow(): Promise<SocialIntegration | null> {
  const rows = await supabaseRest<SocialIntegration[]>(`social_integrations?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=*&limit=1`);
  return rows[0] || null;
}

function checkDatabaseConfig(): ReadinessCheck | null {
  if (hasSupabaseConfig()) return null;
  return { key: "database", label: "Veritabanı", status: "NOT_READY", message: getSupabaseWarning() };
}

async function checkDatabase(): Promise<ReadinessCheck> {
  const configError = checkDatabaseConfig();
  if (configError) return configError;
  try {
    await supabaseRest(`social_autopilot_settings?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=id&limit=1`);
    return { key: "database", label: "Veritabanı", status: "READY", message: "HK Admin Supabase bağlantısı canlı ve sorgulanabiliyor." };
  } catch (error) {
    return { key: "database", label: "Veritabanı", status: "NOT_READY", message: `Veritabanı yapılandırılmış ama sorgu başarısız oldu (Social Autopilot migration'ı uygulanmamış olabilir): ${error instanceof Error ? error.message : String(error)}` };
  }
}

function checkAiRole(key: string, label: string): ReadinessCheck {
  if (isAnyAiProviderConfigured()) {
    return { key, label, status: "READY", message: "HK AI Smart Router üzerinden en az bir gerçek sağlayıcı (Claude veya Gemini) yapılandırıldı." };
  }
  return { key, label, status: "NOT_READY", message: "Hiçbir AI sağlayıcısı yapılandırılmadı (ANTHROPIC_API_KEY / GEMINI_API_KEY eksik)." };
}

function checkQualityEngine(): ReadinessCheck {
  if (isAnyAiProviderConfigured()) {
    return { key: "quality_engine", label: "Kalite Motoru", status: "READY", message: "Yerel deterministik kontroller (gizlilik, klişe, yineleme, platform uygunluğu, SEO) ve AI editoryal denetimi birlikte çalışıyor." };
  }
  return { key: "quality_engine", label: "Kalite Motoru", status: "WARNING", message: "Yerel deterministik kontroller çalışıyor, ancak AI editoryal denetimi için hiçbir sağlayıcı yapılandırılmadı — marka uyumu/doğallık/dilbilgisi boyutları varsayılan geçer puanla atlanıyor." };
}

async function checkInstagramOAuth(account: SocialIntegration | null, accountError: string | null): Promise<ReadinessCheck> {
  const { configured } = instagramAppCredentials();
  if (!configured) return { key: "instagram_oauth", label: "Instagram OAuth", status: "NOT_READY", message: "INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET ortam değişkenleri yapılandırılmadı." };
  if (accountError) return { key: "instagram_oauth", label: "Instagram OAuth", status: "WARNING", message: `Uygulama kimlik bilgileri yapılandırıldı ama hesap durumu okunamadı: ${accountError}` };
  if (account?.status === "connected") return { key: "instagram_oauth", label: "Instagram OAuth", status: "READY", message: `@${account.username || "?"} hesabı bağlı ve token geçerli.` };
  if (account?.status === "token_expired") return { key: "instagram_oauth", label: "Instagram OAuth", status: "WARNING", message: "Hesap daha önce bağlanmış ama token süresi dolmuş — Entegrasyonlar'dan yeniden bağlanması gerekiyor." };
  if (account?.status === "error") return { key: "instagram_oauth", label: "Instagram OAuth", status: "WARNING", message: `Son bağlantı denemesi hata verdi: ${account.last_error || "bilinmeyen hata"}` };
  return { key: "instagram_oauth", label: "Instagram OAuth", status: "WARNING", message: "Uygulama kimlik bilgileri yapılandırıldı ama henüz bir Instagram hesabı bağlanmadı." };
}

function checkInstagramPermissions(account: SocialIntegration | null, accountError: string | null): ReadinessCheck {
  if (accountError) return { key: "instagram_permissions", label: "Instagram İzinleri", status: "WARNING", message: `Hesap durumu okunamadı: ${accountError}` };
  if (!account || account.status !== "connected") return { key: "instagram_permissions", label: "Instagram İzinleri", status: "NOT_READY", message: "Hesap bağlı değil — izin durumu değerlendirilemiyor." };
  const missing = INSTAGRAM_SCOPES.filter((scope) => !account.scopes.includes(scope));
  if (!missing.length) return { key: "instagram_permissions", label: "Instagram İzinleri", status: "READY", message: "Gerekli tüm izinler (içerik yayınlama, insights, yorum yönetimi) verilmiş." };
  return { key: "instagram_permissions", label: "Instagram İzinleri", status: "WARNING", message: `Eksik izin(ler): ${missing.join(", ")} — hesabı yeniden bağlayarak izinleri güncelleyin.` };
}

async function checkStorage(): Promise<ReadinessCheck> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) return { key: "storage", label: "Depolama", status: "NOT_READY", message: "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY tanımlı değil." };
  try {
    const response = await fetch(`${baseUrl}/storage/v1/bucket/${STORAGE_BUCKET}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (response.ok) return { key: "storage", label: "Depolama", status: "READY", message: `"${STORAGE_BUCKET}" bucket'ı mevcut ve erişilebilir.` };
    if (response.status === 404) return { key: "storage", label: "Depolama", status: "WARNING", message: `"${STORAGE_BUCKET}" bucket'ı Supabase Storage'da henüz oluşturulmamış.` };
    return { key: "storage", label: "Depolama", status: "WARNING", message: `Bucket kontrolü beklenmeyen bir durum döndürdü (HTTP ${response.status}).` };
  } catch (error) {
    return { key: "storage", label: "Depolama", status: "NOT_READY", message: `Depolama erişimi doğrulanamadı: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function checkCarouselRenderer(): ReadinessCheck {
  if (isAutoMediaAvailableFor("carousel")) {
    return { key: "carousel_renderer", label: "Carousel Renderer", status: "READY", message: `"${resolveMediaProviderFor("carousel").label}" hazır — fontlar yüklendi, 1080x1350 JPEG carousel/static slaytları programatik olarak üretilebiliyor.` };
  }
  return { key: "carousel_renderer", label: "Carousel Renderer", status: "NOT_READY", message: "Deterministik carousel/static renderer hazır değil (font kaydı başarısız olmuş olabilir)." };
}

function checkReelRenderer(): ReadinessCheck {
  if (isAutoMediaAvailableFor("reel")) {
    return { key: "reel_renderer", label: "Reel Renderer", status: "READY", message: `"${resolveMediaProviderFor("reel").label}" gerçek bir Reel videosunu uçtan uca üretebiliyor.` };
  }
  return { key: "reel_renderer", label: "Reel Renderer", status: "NOT_READY", message: "Bu ortamda gerçek bir video render/kompozisyon motoru (ffmpeg, Remotion vb.) yoktur ve hiçbir AI video sağlayıcısı yapılandırılmadı. Reel içerikleri her zaman NEEDS_MEDIA olarak işaretlenir — asla FULL AUTO olarak etiketlenmez." };
}

async function checkVoiceProvider(): Promise<ReadinessCheck> {
  const health = await notConfiguredVoiceProvider.healthCheck();
  return { key: "voice_provider", label: "Seslendirme Sağlayıcısı", status: health.status, message: health.message };
}

async function checkImageProvider(): Promise<ReadinessCheck> {
  const health = await notConfiguredImageProvider.healthCheck();
  return { key: "image_provider", label: "Görsel Üretim Sağlayıcısı", status: health.status, message: health.message };
}

async function checkVideoProvider(): Promise<ReadinessCheck> {
  const health = await notConfiguredVideoProvider.healthCheck();
  return { key: "video_provider", label: "Video Üretim Sağlayıcısı", status: health.status, message: health.message };
}

async function checkScheduler(): Promise<ReadinessCheck> {
  if (!process.env.CRON_SECRET) return { key: "scheduler", label: "Zamanlayıcı", status: "NOT_READY", message: "CRON_SECRET tanımlı değil — Vercel cron (veya harici bir cron) bu uygulamanın API rotalarını çağıramaz." };
  try {
    const rows = await supabaseRest<Array<{ run_type: string; started_at: string }>>(`social_autopilot_runs?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&select=run_type,started_at&order=started_at.desc&limit=1`);
    if (!rows.length) return { key: "scheduler", label: "Zamanlayıcı", status: "WARNING", message: "CRON_SECRET tanımlı ama henüz hiçbir otomasyon çalıştırması kaydedilmedi." };
    const hoursSince = (Date.now() - new Date(rows[0].started_at).getTime()) / (1000 * 60 * 60);
    if (hoursSince > 26) return { key: "scheduler", label: "Zamanlayıcı", status: "WARNING", message: `Son otomasyon çalıştırması ${Math.round(hoursSince)} saat önce — Vercel cron aktif çalışmıyor olabilir.` };
    return { key: "scheduler", label: "Zamanlayıcı", status: "READY", message: `CRON_SECRET yapılandırıldı ve son otomasyon çalıştırması ${Math.round(hoursSince)} saat önce kaydedildi.` };
  } catch {
    return { key: "scheduler", label: "Zamanlayıcı", status: "WARNING", message: "CRON_SECRET tanımlı ama otomasyon geçmişi okunamadı." };
  }
}

function checkPublishQueue(account: SocialIntegration | null): ReadinessCheck {
  if (!hasSupabaseConfig()) return { key: "publish_queue", label: "Yayın Kuyruğu", status: "NOT_READY", message: "Veritabanı yapılandırılmadan kuyruk çalışamaz." };
  if (account?.status !== "connected") return { key: "publish_queue", label: "Yayın Kuyruğu", status: "WARNING", message: "Kuyruk mekaniği çalışır durumda, ama Instagram bağlı olmadığından zamanlanan hiçbir öğe fiilen yayınlanamaz." };
  return { key: "publish_queue", label: "Yayın Kuyruğu", status: "READY", message: "Kuyruk mekaniği çalışıyor ve bağlı Instagram hesabı üzerinden gerçek yayın yapılabiliyor." };
}

function checkAnalytics(account: SocialIntegration | null): ReadinessCheck {
  if (!hasSupabaseConfig()) return { key: "analytics", label: "Analitik", status: "NOT_READY", message: "Veritabanı yapılandırılmadı." };
  if (account?.status !== "connected") return { key: "analytics", label: "Analitik", status: "WARNING", message: "Analitik senkronizasyon altyapısı hazır, ama Instagram bağlı olmadığından gerçek performans verisi çekilemiyor." };
  return { key: "analytics", label: "Analitik", status: "READY", message: "Instagram Insights senkronizasyonu için gerekli bağlantı ve izinler mevcut." };
}

async function checkLearningEngine(): Promise<ReadinessCheck> {
  if (!hasSupabaseConfig()) return { key: "learning_engine", label: "Öğrenme Motoru", status: "NOT_READY", message: "Veritabanı yapılandırılmadı." };
  try {
    const rows = await supabaseRest<Array<{ id: string }>>(`social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&publication_status=eq.published&select=id&limit=5`);
    if (rows.length < 5) return { key: "learning_engine", label: "Öğrenme Motoru", status: "WARNING", message: `Deterministik motor hazır, ama anlamlı öğrenme üretmek için yeterli yayınlanmış içerik geçmişi henüz yok (şu an ${rows.length}).` };
    return { key: "learning_engine", label: "Öğrenme Motoru", status: "READY", message: "Deterministik öğrenme için yeterli yayın geçmişi var (AI gerektirmez)." };
  } catch (error) {
    return { key: "learning_engine", label: "Öğrenme Motoru", status: "WARNING", message: `Yayın geçmişi okunamadı: ${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function computeReadinessReport(): Promise<ReadinessReport> {
  const settings = await getSettingsRow().catch(() => null);

  let account: SocialIntegration | null = null;
  let accountError: string | null = null;
  try {
    account = await getInstagramIntegrationRow();
  } catch (error) {
    accountError = error instanceof Error ? error.message : String(error);
  }

  const checks: ReadinessCheck[] = await Promise.all([
    checkDatabase(),
    Promise.resolve(checkAiRole("ai_strategy_provider", "AI Strateji Sağlayıcısı")),
    Promise.resolve(checkAiRole("ai_content_provider", "AI İçerik Sağlayıcısı")),
    Promise.resolve(checkQualityEngine()),
    checkInstagramOAuth(account, accountError),
    Promise.resolve(checkInstagramPermissions(account, accountError)),
    checkStorage(),
    Promise.resolve(checkCarouselRenderer()),
    Promise.resolve(checkReelRenderer()),
    checkVoiceProvider(),
    checkImageProvider(),
    checkVideoProvider(),
    checkScheduler(),
    Promise.resolve(checkPublishQueue(account)),
    Promise.resolve(checkAnalytics(account)),
    checkLearningEngine()
  ]);

  const fullAutoCapableFormats = ALL_CONTENT_TYPES.filter((type) => isAutoMediaAvailableFor(type));

  const runtimeAi = settings?.ai_operating_mode === "optional_api_ai";
  const optional = new Set(["voice_provider", "image_provider", "video_provider"]);
  if (!settings?.full_auto_supported_formats?.includes("reel")) optional.add("reel_renderer");
  if (!runtimeAi) {
    optional.add("ai_strategy_provider");
    optional.add("ai_content_provider");
    const quality = checks.find((c) => c.key === "quality_engine");
    if (quality) { quality.status = "READY"; quality.message = "Deterministik kalite kontrolü hazır; AI editoryal değerlendirmesi isteğe bağlı ve devre dışı."; }
    const today = new Date().toISOString().slice(0, 10);
    const supply = await supabaseRest<Array<{ id: string }>>(`social_content_items?workspace_id=eq.${SOCIAL_WORKSPACE_ID}&publication_status=in.(generated,ready,scheduled)&content_date=gte.${today}&select=id&limit=1`).catch(() => []);
    checks.push({
      key: "strategy_supply", label: "İçerik Tedariki",
      status: supply.length ? "READY" : "NOT_READY",
      message: supply.length ? "Önceden hazırlanmış içerik mevcut." : "Claude MCP ile içerik hazırlayın (strategy_import / content_generate_carousel) veya AI modunu optional_api_ai'a çevirin."
    });
  }
  // Insufficient statistical samples are reported but do not stop rendering.
  optional.add("learning_engine");

  return {
    overall: overallFrom(checks.filter((c) => !optional.has(c.key))),
    checks,
    fullAutoCapableFormats,
    fullAutoGateKeys: checks.filter((c) => !optional.has(c.key)).map((c) => c.key),
    aiOperatingMode: settings?.ai_operating_mode || "claude_code_assisted"
  };
}
