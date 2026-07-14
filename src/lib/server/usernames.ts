import { supabaseRest } from "@/lib/supabase";
import { normalizeUsername, suggestUsername, validateUsername } from "@/lib/usernames";

type UsernameRow = { id: string; email: string; username?: string | null };

export async function resolveLoginEmail(identity: unknown) {
  const raw = String(identity ?? "").trim();
  if (!raw) return "";
  if (raw.includes("@")) return raw.toLowerCase();

  const username = normalizeUsername(raw);
  if (validateUsername(username)) return "";
  const rows = await supabaseRest<UsernameRow[]>(
    `users?username=eq.${encodeURIComponent(username)}&is_active=eq.true&deleted_at=is.null&select=id,email,username&limit=1`
  ).catch(() => []);
  return String(rows[0]?.email || "").trim().toLowerCase();
}

export async function createAvailableUsername(input: {
  requested?: unknown;
  companyName?: unknown;
  fullName?: unknown;
  email?: unknown;
  excludeUserId?: string;
}) {
  const requested = normalizeUsername(input.requested);
  const base = requested || suggestUsername(input);
  const validationError = validateUsername(base);
  if (validationError) throw new Error(validationError);

  const rows = await supabaseRest<UsernameRow[]>(
    `users?username=like.${encodeURIComponent(`${base}*`)}&select=id,username`
  ).catch(() => []);
  const occupied = new Set(
    rows
      .filter((row) => !input.excludeUserId || row.id !== input.excludeUserId)
      .map((row) => normalizeUsername(row.username))
      .filter(Boolean)
  );
  if (!occupied.has(base)) return { username: base, adjusted: false };

  for (let suffix = 2; suffix <= 999; suffix += 1) {
    const suffixText = `-${suffix}`;
    const candidate = `${base.slice(0, 40 - suffixText.length).replace(/-+$/g, "")}${suffixText}`;
    if (!occupied.has(candidate)) return { username: candidate, adjusted: true };
  }
  throw new Error("Bu kullanıcı adı için güvenli bir alternatif üretilemedi.");
}

