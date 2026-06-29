const emptyLikeValues = new Set(["", "-", "yok", "mevcut değil", "mevcut degil", "none", "null"]);

export function normalizePhoneInput(value: unknown) {
  const raw = String(value ?? "").trim();
  if (emptyLikeValues.has(raw.toLocaleLowerCase("tr"))) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith("5")) digits = `0${digits}`;
  if (digits.length > 11 && digits.startsWith("0")) digits = digits.slice(0, 11);
  return digits;
}

export function formatTurkishPhone(value: unknown) {
  const digits = normalizePhoneInput(value);
  if (!digits) return "";
  const normalized = digits.startsWith("0") ? digits : `0${digits}`;
  const clean = normalized.slice(0, 11);
  if (clean.length <= 1) return clean;
  if (clean.length <= 4) return `${clean.slice(0, 1)} (${clean.slice(1)}`;
  if (clean.length <= 7) return `${clean.slice(0, 1)} (${clean.slice(1, 4)}) ${clean.slice(4)}`;
  if (clean.length <= 9) return `${clean.slice(0, 1)} (${clean.slice(1, 4)}) ${clean.slice(4, 7)} ${clean.slice(7)}`;
  return `${clean.slice(0, 1)} (${clean.slice(1, 4)}) ${clean.slice(4, 7)} ${clean.slice(7, 9)} ${clean.slice(9, 11)}`;
}

export function isValidTurkishPhone(value: unknown) {
  const digits = normalizePhoneInput(value);
  return !digits || /^0?5\d{9}$/.test(digits);
}

export function isEmptyLikeValue(value: unknown) {
  return emptyLikeValues.has(String(value ?? "").trim().toLocaleLowerCase("tr"));
}
