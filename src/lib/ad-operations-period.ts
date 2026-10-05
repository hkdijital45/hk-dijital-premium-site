export const CUSTOM_PERIOD_LABEL_PATTERN = /^(\d{4}-\d{2}-\d{2}) - (\d{4}-\d{2}-\d{2})$/;

export function isValidDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function localDateOnly(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function customPeriodLabel(start: string, end: string): string {
  return `${start} - ${end}`;
}

export function parseCustomPeriodLabel(label: string): { start: string; end: string } | null {
  const match = CUSTOM_PERIOD_LABEL_PATTERN.exec(label);
  if (!match || !isValidDateOnly(match[1]) || !isValidDateOnly(match[2])) return null;
  return { start: match[1], end: match[2] };
}

// A single day is stored as start === end; an empty end is treated as the same day.
export function validateCustomPeriod(startInput: unknown, endInput: unknown, todayIso: string): { ok: true; start: string; end: string } | { ok: false; error: string } {
  if (!isValidDateOnly(startInput)) return { ok: false, error: "Başlangıç tarihi seçin." };
  const start = startInput;
  const end = isValidDateOnly(endInput) ? endInput : start;
  if (end < start) return { ok: false, error: "Bitiş tarihi başlangıç tarihinden önce olamaz." };
  if (end > todayIso) return { ok: false, error: "Gelecek tarihler seçilemez." };
  return { ok: true, start, end };
}

function numericDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}.${month}.${year}`;
}

export function formatCustomPeriodDisplay(start: string, end: string): string {
  return start === end ? numericDate(start) : `${numericDate(start)} – ${numericDate(end)}`;
}

export function periodDisplayLabel(period: string): string {
  const custom = parseCustomPeriodLabel(period);
  return custom ? formatCustomPeriodDisplay(custom.start, custom.end) : period;
}

// Presets keep their existing sync mapping; a custom label carries its own dates.
export function syncRangeForPeriod(period: string): { rangePreset: string; dateFrom?: string; dateTo?: string } {
  const custom = parseCustomPeriodLabel(period);
  if (custom) return { rangePreset: "custom", dateFrom: custom.start, dateTo: custom.end };
  if (period === "Bugün") return { rangePreset: "today" };
  if (period === "Son 7 Gün") return { rangePreset: "last_7d" };
  return { rangePreset: "last_30d" };
}
