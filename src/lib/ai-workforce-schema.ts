// Pure, dependency-free logic for HK AI Workforce — no Supabase/server-only
// imports, so it stays directly unit-testable (see tests/unit/ai-workforce-schema.test.ts).

import type { AgentProviderKey, AgentTaskType } from "./agent-hub";

export const AI_WORKFORCE_MODULE = "ai-workforce";

export type ApprovalActionType = "read" | "suggest" | "draft" | "internal_write" | "external_write" | "destructive";
export type ApprovalRiskLevel = "low" | "medium" | "high" | "critical";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";
export type ApprovalExecutionStatus = "not_applicable" | "pending" | "executed" | "execution_unavailable";

// The 9 hk_virtual_agents seed rows (supabase/migrations/20260629_hk_intelligence_autonomous_os.sql)
// don't carry a task_type — this maps each named agent's role to the closest
// existing AgentTaskType the router already understands, so "Run" can call
// the real runAgentTask() instead of the previous no-op stub.
const agentKeyTaskType: Record<string, AgentTaskType> = {
  ceo: "workflow_task",
  sales_manager: "proposal_generation",
  crm_specialist: "crm_summary",
  google_ads_specialist: "ad_analysis",
  meta_ads_specialist: "ad_analysis",
  seo_specialist: "seo_analysis",
  creative_director: "content_generation",
  finance_manager: "fast_answer",
  reporting_manager: "customer_report"
};

export function mapAgentKeyToTaskType(agentKey: string): AgentTaskType {
  return agentKeyTaskType[agentKey] || "workflow_task";
}

// hk_virtual_agents.preferred_provider was seeded with "claude" for two rows
// even though AgentProviderKey uses "anthropic" — normalize so those agents'
// preference is actually honored instead of silently falling through to auto.
const providerAliases: Record<string, AgentProviderKey> = { claude: "anthropic" };
const knownProviders: AgentProviderKey[] = ["openai", "anthropic", "gemini", "groq", "manus", "openrouter", "ollama", "demo"];

export function normalizePreferredProvider(value?: string | null): AgentProviderKey | "auto" {
  if (!value || value === "auto") return "auto";
  const aliased = providerAliases[value] || value;
  return (knownProviders as string[]).includes(aliased) ? (aliased as AgentProviderKey) : "auto";
}

export function buildDirectorPrompt(options: { agentName: string; roleLabel: string; companyId?: string | null; customPrompt?: string | null }): string {
  const custom = (options.customPrompt || "").trim();
  if (custom) return custom;
  const scope = options.companyId ? "bu müşteri için öncelikli bulguları, riskleri ve önerilen aksiyonları" : "ajans genelinde öncelikli bulguları, riskleri ve önerilen aksiyonları";
  return `${options.agentName} (${options.roleLabel}) rolünde ${scope} üret. Somut, ölçülü ve uygulanabilir öneriler ver; elde olmayan veriyi uydurma.`;
}

// An approval decision doesn't automatically mean the underlying action ran:
// read/suggest/draft never needed execution, internal_write can genuinely
// execute in-app (e.g. creating a task), and external_write/destructive have
// no real external-system execution wired yet — never fake that they ran.
export function classifyExecutionStatus(actionType: ApprovalActionType, decision: "approved" | "rejected"): ApprovalExecutionStatus {
  if (decision === "rejected") return "not_applicable";
  if (actionType === "read" || actionType === "suggest" || actionType === "draft") return "not_applicable";
  if (actionType === "internal_write") return "executed";
  return "execution_unavailable";
}

export type CostRow = { key: string; estimated_cost?: number | null; tokens_used?: number | null; created_at?: string | null };

export function aggregateCostByKey(rows: CostRow[]) {
  const totals = new Map<string, { key: string; estimatedCost: number; tokensUsed: number; runCount: number }>();
  for (const row of rows) {
    const key = row.key || "diğer";
    const entry = totals.get(key) || { key, estimatedCost: 0, tokensUsed: 0, runCount: 0 };
    entry.estimatedCost += Number(row.estimated_cost || 0);
    entry.tokensUsed += Number(row.tokens_used || 0);
    entry.runCount += 1;
    totals.set(key, entry);
  }
  return [...totals.values()].sort((a, b) => b.estimatedCost - a.estimatedCost);
}

export function sumEstimatedCost(rows: Array<{ estimated_cost?: number | null }>) {
  return Number(rows.reduce((sum, row) => sum + Number(row.estimated_cost || 0), 0).toFixed(4));
}

export type SendToTeamActionKey = "performance_30d" | "ads_analysis" | "seo_geo_analysis" | "content_opportunity" | "full_health_review";

export const sendToTeamActionPresets: Record<SendToTeamActionKey, { label: string; taskType: AgentTaskType; prompt: string; multiAgent?: boolean }> = {
  performance_30d: {
    label: "30 Günlük Performans Analizi (30-Day Performance Analysis)",
    taskType: "customer_report",
    prompt: "Bu müşterinin son 30 günlük performansını incele. Güçlü ve zayıf noktaları, ölçülebilir sonuçları ve önerilen aksiyonları özetle."
  },
  ads_analysis: {
    label: "Reklam Analizi (Ads Analysis)",
    taskType: "ad_analysis",
    prompt: "Bu müşterinin reklam hesaplarını (Meta/Google) analiz et. Bütçe verimliliği, kreatif yorgunluğu ve optimizasyon fırsatlarını belirt."
  },
  seo_geo_analysis: {
    label: "SEO/GEO Analizi (SEO/GEO Analysis)",
    taskType: "seo_analysis",
    prompt: "Bu müşteri için SEO ve GEO (üretken motor görünürlüğü) fırsatlarını analiz et. Teknik ve içerik bazlı önerileri ayrı listele."
  },
  content_opportunity: {
    label: "İçerik Fırsatı Analizi (Content Opportunity Analysis)",
    taskType: "content_generation",
    prompt: "Bu müşteri için içerik fırsatlarını belirle: eksik konu başlıkları, formatlar ve öncelikli içerik önerileri."
  },
  full_health_review: {
    label: "Tam Müşteri Sağlık Taraması (Full Customer Health Review)",
    taskType: "workflow_task",
    prompt: "Bu müşteri için kapsamlı bir sağlık taraması yap: reklam, SEO, CRM/takip ve tahsilat açısından riskleri ve fırsatları özetle.",
    multiAgent: true
  }
};

// Her hazır iş akışı çıktısını aynı, karşılaştırılabilir yapıya zorlar —
// yönetici özeti, gerçek veriye dayanan bulgular, önceliklendirilmiş
// aksiyonlar, gerekçe/etki/efor, sorumlu+tarih+başarı ölçütü ve son olarak
// eksik veri/takip adımı. Genel tavsiye listesiyle sonuçlanmasını önlemek
// için bu yapı serbest metin talimatına gömülür (ayrı bir zorunlu şema
// eklemek AgentFinalReport'u kırar; bunun yerine model bu yapıyı
// executiveSummary/findings/recommendedActions alanlarına yansıtır).
const PLAYBOOK_OUTPUT_STRUCTURE = [
  "Çıktını şu sırayla yapılandır:",
  "1) Kısa yönetici özeti (3-4 cümle).",
  "2) Bulgular ve dayandığı veriler — her bulgu için 'Gerçek veri', 'Hesaplanan metrik', 'Varsayım' veya 'Öneri' etiketlerinden uygun olanını belirt.",
  "3) Öncelikli aksiyonlar (en fazla 5, önem sırasına göre).",
  "4) Her aksiyon için kısa gerekçe, beklenen etki ve gereken efor (düşük/orta/yüksek).",
  "5) Her aksiyon için önerilen sorumlu rol, önerilen teslim tarihi (gün sayısı olarak, örn. '3 iş günü içinde') ve başarı ölçütü.",
  "6) Eksik veri ve bu eksikliği kapatmak için somut takip adımı.",
  "Beklenen etkiyi asla garanti edilmiş bir sonuç gibi sunma; 'beklenen', 'tahmini' gibi ifadeler kullan."
].join(" ");

export type AiWorkforcePlaybookKey =
  | "daily_agency_summary"
  | "customer_30d_review"
  | "social_media_strategy"
  | "monthly_content_plan"
  | "ad_performance_test_plan"
  | "seo_content_opportunities"
  | "customer_meeting_prep"
  | "weekly_ops_risk_review";

export type AiWorkforcePlaybookContext = { customerName?: string | null; periodLabel?: string | null };

export type AiWorkforcePlaybook = {
  label: string;
  description: string;
  perspective: "Dijital Pazarlama Uzmanı" | "Sosyal Medya Stratejisti" | "Ajans Sahibi";
  taskType: AgentTaskType;
  requiresCustomer: boolean;
  requiresPeriod: boolean;
  multiAgent?: boolean;
  buildPrompt: (context: AiWorkforcePlaybookContext) => string;
};

// 8 hazır iş akışı — her biri agency günlük operasyonunda gerçekten
// tekrarlanan bir işe karşılık gelir ve üç perspektiften birine (dijital
// pazarlama uzmanı / sosyal medya stratejisti / ajans sahibi) açıkça
// yaslanır. Hepsini birden çalıştırmak yerine göreve uygun taskType tek bir
// uzman zincirini (bkz. agent-hub.ts provider chain) tetikler.
export const aiWorkforcePlaybooks: Record<AiWorkforcePlaybookKey, AiWorkforcePlaybook> = {
  daily_agency_summary: {
    label: "Günlük Ajans Özeti",
    description: "Ajans genelinde bugünün öncelikleri, riskleri ve karar bekleyen konuları özetler.",
    perspective: "Ajans Sahibi",
    taskType: "workflow_task",
    requiresCustomer: false,
    requiresPeriod: false,
    multiAgent: true,
    buildPrompt: () =>
      `Bir ajans sahibi perspektifiyle bugünün günlük ajans özetini hazırla: öncelikli işler, müdahale gerektiren müşteriler, onay bekleyen konular, devam eden/başarısız görevler ve dikkat edilmesi gereken riskler. ${PLAYBOOK_OUTPUT_STRUCTURE}`
  },
  customer_30d_review: {
    label: "Müşteri 30 Günlük Performans Değerlendirmesi",
    description: "Seçili müşterinin son dönem reklam ve genel performansını gerçek verilerle değerlendirir.",
    perspective: "Dijital Pazarlama Uzmanı",
    taskType: "customer_report",
    requiresCustomer: true,
    requiresPeriod: true,
    buildPrompt: ({ customerName, periodLabel }) =>
      `Bir dijital pazarlama uzmanı perspektifiyle ${customerName || "seçili müşteri"} için ${periodLabel || "son 30 gün"} performans değerlendirmesi hazırla: hedef/dönüşüm ölçümü, funnel ve kanal dağılımı, reklam performansı ve bütçe verimliliği açısından güçlü/zayıf noktaları, ölçülebilir sonuçları ve bütçe önerisini özetle. ${PLAYBOOK_OUTPUT_STRUCTURE}`
  },
  social_media_strategy: {
    label: "Sosyal Medya Stratejisi",
    description: "Hedef kitle, marka dili, içerik sütunları ve kanal yaklaşımını içeren strateji taslağı üretir.",
    perspective: "Sosyal Medya Stratejisti",
    taskType: "content_generation",
    requiresCustomer: true,
    requiresPeriod: false,
    buildPrompt: ({ customerName }) =>
      `Bir sosyal medya stratejisti perspektifiyle ${customerName || "seçili müşteri"} için sosyal medya stratejisi taslağı hazırla: hedef kitle, marka dili, içerik sütunları (pillar) ve kanal bazlı yaklaşım öner. Müşteri hazırlık notunda marka/hedef kitle bilgisi yoksa bunu varsayım yerine eksik veri olarak belirt. ${PLAYBOOK_OUTPUT_STRUCTURE}`
  },
  monthly_content_plan: {
    label: "Aylık İçerik Planı",
    description: "Format, açılış fikri, metin ve CTA önerileriyle bir aylık içerik takvimi taslağı oluşturur.",
    perspective: "Sosyal Medya Stratejisti",
    taskType: "content_generation",
    requiresCustomer: true,
    requiresPeriod: true,
    buildPrompt: ({ customerName, periodLabel }) =>
      `Bir sosyal medya stratejisti perspektifiyle ${customerName || "seçili müşteri"} için ${periodLabel || "önümüzdeki ay"} kapsayan içerik planı taslağı hazırla: her içerik için format, açılış fikri, kısa metin yönü ve CTA öner; bunun bir taslak olduğunu ve yayın onayı gerektirdiğini belirt. ${PLAYBOOK_OUTPUT_STRUCTURE}`
  },
  ad_performance_test_plan: {
    label: "Reklam Performansı ve Test Planı",
    description: "Mevcut reklam verisini değerlendirir ve kreatif/hedefleme test planı önerir.",
    perspective: "Dijital Pazarlama Uzmanı",
    taskType: "ad_analysis",
    requiresCustomer: true,
    requiresPeriod: true,
    buildPrompt: ({ customerName, periodLabel }) =>
      `Bir dijital pazarlama uzmanı perspektifiyle ${customerName || "seçili müşteri"} için ${periodLabel || "son 30 gün"} reklam performansını değerlendir ve kreatif testi, hedefleme testi ve landing page iyileştirmesi içeren bir test planı öner. Reklam hesabı bağlı değilse veya veri yoksa bunu açıkça belirt, tahmini rakam üretme. ${PLAYBOOK_OUTPUT_STRUCTURE}`
  },
  seo_content_opportunities: {
    label: "SEO ve İçerik Fırsatları",
    description: "Teknik SEO ve içerik/organik büyüme fırsatlarını ayrı listeler.",
    perspective: "Dijital Pazarlama Uzmanı",
    taskType: "seo_analysis",
    requiresCustomer: true,
    requiresPeriod: false,
    buildPrompt: ({ customerName }) =>
      `Bir dijital pazarlama uzmanı perspektifiyle ${customerName || "seçili müşteri"} için SEO ve içerik/organik büyüme fırsatlarını belirle; teknik SEO önerileri ile içerik önerilerini ayrı başlıklar altında listele. ${PLAYBOOK_OUTPUT_STRUCTURE}`
  },
  customer_meeting_prep: {
    label: "Müşteri Toplantısı Hazırlığı",
    description: "Müşteriyle yapılacak toplantı için özet, gündem ve konuşulacak konuları hazırlar.",
    perspective: "Ajans Sahibi",
    taskType: "workflow_task",
    requiresCustomer: true,
    requiresPeriod: false,
    multiAgent: true,
    buildPrompt: ({ customerName }) =>
      `Bir ajans sahibi perspektifiyle ${customerName || "seçili müşteri"} ile yapılacak toplantı için hazırlık özeti oluştur: son dönem performans özeti, açık konular/riskler, önerilecek yeni aksiyonlar ve toplantı gündemi maddeleri. ${PLAYBOOK_OUTPUT_STRUCTURE}`
  },
  weekly_ops_risk_review: {
    label: "Haftalık Operasyon ve Risk Değerlendirmesi",
    description: "Ajans genelinde operasyonel riskleri, kapsam sorunlarını ve hizmet fırsatlarını değerlendirir.",
    perspective: "Ajans Sahibi",
    taskType: "workflow_task",
    requiresCustomer: false,
    requiresPeriod: false,
    multiAgent: true,
    buildPrompt: () =>
      `Bir ajans sahibi perspektifiyle bu haftaki operasyonel riskleri, iş yükü dağılımını, müşteri sağlığı ve kapsam/hizmet fırsatlarını değerlendir; kaynak planlaması açısından dikkat edilmesi gerekenleri belirt. ${PLAYBOOK_OUTPUT_STRUCTURE}`
  }
};

// Host-based routing for ai.hkdijital.com.tr — kept pure/exported so the
// exact-match rule (not a startsWith, to avoid e.g. "aiden.hkdijital.com.tr"
// false-positives) is unit-testable without spinning up middleware/Next.
export const AI_WORKFORCE_HOST = "ai.hkdijital.com.tr";

export function isAiWorkforceHost(host?: string | null): boolean {
  if (!host) return false;
  const bare = host.split(":")[0].toLowerCase();
  return bare === AI_WORKFORCE_HOST;
}

// Only product sections receive clean-URL aliases. Rewriting every path
// swallowed /hk-admin (including the module-denied fallback), the private
// login entry, password recovery, customer pages and public assets.
const AI_WORKFORCE_SECTIONS = new Set([
  "agents", "director", "tasks", "approvals", "automations", "memory",
  "reports", "integrations", "cost", "activity"
]);

export function rewriteAiWorkforcePath(pathname: string): string {
  if (pathname === "/") return "/ai-workforce";
  if (AI_WORKFORCE_SECTIONS.has(pathname.split("/")[1])) return `/ai-workforce${pathname}`;
  return pathname;
}

// PRODUCTION BUG FIX (ERR_TOO_MANY_REDIRECTS on ai.hkdijital.com.tr):
// the Secret Access Control Center's gate-failure redirect target is the
// bare root "/" (see src/proxy.ts) — the site-wide "safe, ungated landing
// page" escape hatch. rewriteAiWorkforcePath() used to map "/" straight to
// "/ai-workforce" unconditionally, which is itself a gated prefix — so an
// unauthenticated visitor hitting "/" would get redirected to "/", which
// would immediately re-resolve to "/ai-workforce", fail the gate again, and
// redirect to "/" again, forever.
//
// Fix: on the ai-workforce host, "/" only becomes "/ai-workforce" once the
// visitor is *already* authorized for it. Anyone not yet authorized keeps
// seeing the real, ungated homepage at "/" (exactly like www.hkdijital.com.tr/
// after a failed /hk-admin gate check) — breaking the loop — while an
// authorized admin lands directly on the Control Center at the root, per the
// product's intended behavior. Every other path (e.g. "/ai-workforce" itself,
// "/agents") is unaffected: it is still always rewritten and still always
// gated normally, since a direct deep-link redirects to "/" on failure
// exactly once, and "/" is never gated for an unauthorized visitor.
export function resolveAiWorkforceHostPathname(pathname: string, rootAuthorized: boolean, privatePath?: string): string {
  if (privatePath && pathname === `/${privatePath.replace(/^\/+/, "")}`) return pathname;
  if (pathname === "/" && !rootAuthorized) return "/";
  return rewriteAiWorkforcePath(pathname);
}

const turkishWeekdays: Record<string, number> = {
  Pazar: 0, Pazartesi: 1, Salı: 2, Çarşamba: 3, Perşembe: 4, Cuma: 5, Cumartesi: 6
};

// agent_scheduled_tasks/run-due previously only stamped last_run_at, never
// advanced next_run_at — so once the cron actually started calling it, a
// task configured as "weekly" would fire again on every following daily
// cron tick instead of waiting a week. This computes a real next occurrence
// from schedule_frequency/schedule_day/schedule_time so the cron activation
// doesn't turn every automation into a daily one.
export function computeNextRunAt(options: { frequency?: string | null; day?: string | null; time?: string | null; from?: Date }): string {
  const from = options.from || new Date();
  const [hours, minutes] = (options.time || "09:00").split(":").map((part) => Number.parseInt(part, 10) || 0);
  const frequency = (options.frequency || "weekly").toLowerCase();

  if (frequency === "daily" || frequency === "gunluk" || frequency === "günlük") {
    const next = new Date(from);
    next.setDate(next.getDate() + 1);
    next.setHours(hours, minutes, 0, 0);
    return next.toISOString();
  }

  if (frequency === "monthly" || frequency === "aylik" || frequency === "aylık") {
    const next = new Date(from);
    next.setMonth(next.getMonth() + 1);
    next.setHours(hours, minutes, 0, 0);
    return next.toISOString();
  }

  // weekly (default). This is only ever called right after a task just ran
  // (to schedule its next occurrence), so "today" is never a valid answer —
  // if today already is the target weekday, the next one is a full 7 days
  // out, not later today.
  const targetWeekday = options.day && options.day in turkishWeekdays ? turkishWeekdays[options.day] : from.getDay();
  const daysToAdd = ((targetWeekday - from.getDay() + 7) % 7) || 7;
  const next = new Date(from);
  next.setDate(next.getDate() + daysToAdd);
  next.setHours(hours, minutes, 0, 0);
  return next.toISOString();
}
