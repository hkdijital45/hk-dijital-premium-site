import { getSession, type AppSession } from "./auth";

export type CanonicalRole = "admin" | "yonetici" | "editor" | "musteri";

export const adminModules = [
  "dashboard", "genel-arama", "kullanim-kilavuzu", "crm", "leads", "musteriler",
  "takip-gorevleri", "notlar", "musteri-bulucu", "haritalar", "bolgesel-analiz",
  "rakip-listesi", "kaydedilen-adaylar", "meta-analiz", "google-analiz",
  "sosyal-medya-denetimi", "funnel-analizi", "reklam-firsatlari", "hazirlik", "ai-studio", "icerik-onerileri",
  "prompt-kutuphanesi", "kampanya-hazirligi", "teklifler", "teklif-listesi", "raporlar",
  "rapor-yorumlari", "disa-aktarimlar", "kullanicilar", "roller-yetkiler",
  "site-ayarlari", "api-ayarlari", "tema-ayarlari", "medya", "sistem-loglari"
] as const;

export type AdminModule = (typeof adminModules)[number];

const moduleAliases: Record<string, AdminModule> = {
  maps: "haritalar",
  business_discovery: "musteri-bulucu"
};

export function normalizeModule(module?: string | null): AdminModule | null {
  if (!module) return null;
  const normalized = moduleAliases[module] || module;
  return adminModules.includes(normalized as AdminModule) ? normalized as AdminModule : null;
}

export const roleTemplates: Record<CanonicalRole, AdminModule[]> = {
  admin: [...adminModules],
  yonetici: [
    "dashboard", "genel-arama", "kullanim-kilavuzu", "crm", "leads", "musteriler",
    "takip-gorevleri", "notlar", "musteri-bulucu", "haritalar", "bolgesel-analiz",
    "kaydedilen-adaylar", "meta-analiz", "google-analiz", "sosyal-medya-denetimi", "hazirlik", "ai-studio", "teklifler", "teklif-listesi",
    "raporlar", "rapor-yorumlari", "disa-aktarimlar"
  ],
  editor: [
    "dashboard", "genel-arama", "kullanim-kilavuzu", "crm", "leads", "hazirlik",
    "ai-studio", "icerik-onerileri", "prompt-kutuphanesi", "kampanya-hazirligi",
    "teklifler", "teklif-listesi", "raporlar", "rapor-yorumlari", "disa-aktarimlar", "medya"
  ],
  musteri: []
};

export function normalizeRole(role?: string | null): CanonicalRole {
  if (role === "sales") return "yonetici";
  if (role === "customer") return "musteri";
  if (role === "yonetici" || role === "editor" || role === "musteri") return role;
  return "admin";
}

export function getAllowedModules(session?: AppSession | null): AdminModule[] {
  if (!session) return [];
  const configured = Array.isArray(session.allowedModules)
    ? session.allowedModules.map(normalizeModule).filter((module): module is AdminModule => Boolean(module))
    : [];
  return configured.length ? [...new Set(configured)] : roleTemplates[normalizeRole(session.role)];
}

export function canAccessModule(session: AppSession | null | undefined, module: string) {
  const normalized = normalizeModule(module);
  return normalized ? getAllowedModules(session).includes(normalized) : false;
}

export async function getCurrentUser() {
  return getSession();
}

export async function getCurrentUserRole() {
  return normalizeRole((await getSession())?.role);
}

export async function requireModuleAccess(module: string) {
  const session = await getSession();
  return canAccessModule(session, module) ? session : null;
}

export async function requireAdmin() {
  const session = await getSession();
  return normalizeRole(session?.role) === "admin" ? session : null;
}
