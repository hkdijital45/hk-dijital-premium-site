export const TEMPORARY_CUSTOMER_PASSWORD = "ABC12345";
export const MAX_PASSWORD_LENGTH = 128;

export function validateNewPassword(password: string, confirmation: string) {
  if (!password.trim() || password.length > MAX_PASSWORD_LENGTH) {
    return "Şifre 8-128 karakter arasında olmalıdır.";
  }
  if (password.length < 8) return "Şifre en az 8 karakter olmalıdır.";
  if (!/[A-ZÇĞİÖŞÜ]/.test(password)) return "Şifre en az bir büyük harf içermelidir.";
  if (!/[a-zçğıöşü]/.test(password)) return "Şifre en az bir küçük harf içermelidir.";
  if (!/\d/.test(password)) return "Şifre en az bir rakam içermelidir.";
  if (!/[^\p{L}\p{N}\s]/u.test(password)) return "Şifre en az bir özel karakter içermelidir.";
  if (password === TEMPORARY_CUSTOMER_PASSWORD) return "Yeni şifre geçici şifreyle aynı olamaz.";
  if (password !== confirmation) return "Yeni şifreler eşleşmiyor.";
  return "";
}
