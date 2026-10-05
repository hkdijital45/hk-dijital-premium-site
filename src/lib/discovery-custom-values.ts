export const DISCOVERY_OTHER_LABEL = "Diğer";

const RESERVED_VALUES = new Set([DISCOVERY_OTHER_LABEL.toLocaleLowerCase("tr"), "__other__", "other", "custom"]);

export function cleanDiscoveryValue(value: unknown): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed || RESERVED_VALUES.has(trimmed.toLocaleLowerCase("tr"))) return "";
  return trimmed;
}

export function discoveryFieldState(value: unknown, options: readonly string[], otherMode: boolean): { selectValue: string; isCustom: boolean } {
  const raw = String(value ?? "");
  if (raw.trim()) {
    const isCustom = !options.includes(raw);
    return { selectValue: isCustom ? DISCOVERY_OTHER_LABEL : raw, isCustom };
  }
  return { selectValue: otherMode ? DISCOVERY_OTHER_LABEL : "", isCustom: otherMode };
}

export function discoveryEffectiveSearch<T extends { district?: unknown; businessType?: unknown }>(search: T): T {
  return { ...search, district: cleanDiscoveryValue(search.district), businessType: cleanDiscoveryValue(search.businessType) };
}
