import "server-only";
import type { AppSession } from "@/lib/session-token";
import { getAllowedModules } from "@/lib/permissions";
import { adminNavigationItems } from "@/lib/admin-navigation";

export function allowedFavoriteSlugs(session: AppSession | null) {
  const allowedModules = getAllowedModules(session);
  return new Set(adminNavigationItems.filter((item) => allowedModules.includes(item.module)).map((item) => item.slug || "dashboard"));
}

export function normalizeFavorites(value: unknown, allowed: Set<string>) {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item || "").trim()).filter((item) => item && allowed.has(item)))).slice(0, 12);
}

export function moduleDetails(slugs: string[]) {
  const bySlug = new Map(adminNavigationItems.map((item) => [item.slug || "dashboard", item]));
  return slugs.map((slug) => {
    const item = bySlug.get(slug);
    return { slug, label: item?.label || slug, description: item?.description || "" };
  });
}
