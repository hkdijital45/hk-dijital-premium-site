const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 40;

export function normalizeUsername(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/[çÇ]/g, "c")
    .replace(/[ğĞ]/g, "g")
    .replace(/[ıİ]/g, "i")
    .replace(/[öÖ]/g, "o")
    .replace(/[şŞ]/g, "s")
    .replace(/[üÜ]/g, "u")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, USERNAME_MAX_LENGTH)
    .replace(/-+$/g, "");
}

export function suggestUsername(input: { companyName?: unknown; fullName?: unknown; email?: unknown }) {
  const emailPrefix = String(input.email ?? "").split("@")[0];
  return normalizeUsername(input.companyName || input.fullName || emailPrefix || "kullanici");
}

export function validateUsername(value: unknown) {
  const username = normalizeUsername(value);
  if (username.length < USERNAME_MIN_LENGTH) return "Kullanıcı adı en az 3 karakter olmalıdır.";
  if (username.length > USERNAME_MAX_LENGTH) return "Kullanıcı adı en fazla 40 karakter olmalıdır.";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(username)) return "Kullanıcı adı harf, rakam ve tek tirelerden oluşmalıdır.";
  return "";
}

