import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { hasSupabaseConfig, supabaseRest } from "./supabase";

export const adminCookieName = "hk_admin_session";
export const authCookieName = "hk_auth_session";

export type UserRole = "admin" | "editor" | "sales" | "customer";

export type AppSession = {
  authUserId?: string;
  profileId?: string;
  email: string;
  role: UserRole;
  fullName?: string;
  companyId?: string | null;
  accessToken?: string;
  refreshToken?: string;
};

type UserProfileRow = {
  id: string;
  auth_user_id?: string | null;
  email: string;
  full_name: string | null;
  role: UserRole;
  company_id: string | null;
  is_active: boolean;
};

const adminRoles: UserRole[] = ["admin", "editor", "sales"];

function sessionSecret() {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "local-development-session-secret"
  );
}

function signPayload(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
}

function encodeSession(session: AppSession) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${signPayload(payload)}`;
}

function decodeSession(value?: string): AppSession | null {
  if (!value || !value.includes(".")) return null;
  const [payload, signature] = value.split(".");
  const expected = signPayload(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AppSession;
  } catch {
    return null;
  }
}

export async function createSession(session: AppSession) {
  const cookieStore = await cookies();
  cookieStore.set(authCookieName, encodeSession(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(authCookieName);
  cookieStore.delete(adminCookieName);
}

export async function getSession() {
  const cookieStore = await cookies();
  const session = decodeSession(cookieStore.get(authCookieName)?.value);
  if (!session?.profileId || !hasSupabaseConfig()) return session;

  try {
    const profile = await getProfileById(session.profileId);
    if (!profile?.is_active) return null;
    return {
      ...session,
      authUserId: profile.auth_user_id || session.authUserId,
      email: profile.email,
      role: profile.role,
      fullName: profile.full_name || session.fullName,
      companyId: profile.company_id
    };
  } catch {
    return session;
  }
}

export async function isAdminAuthenticated() {
  const session = await getSession();
  return Boolean(session && adminRoles.includes(session.role));
}

export async function isCustomerAuthenticated() {
  const session = await getSession();
  return session?.role === "customer";
}

function supabaseAuthHeaders(serviceRole = false, accessToken?: string) {
  const key = serviceRole
    ? process.env.SUPABASE_SERVICE_ROLE_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return {
    apikey: key || "",
    Authorization: `Bearer ${accessToken || key || ""}`,
    "Content-Type": "application/json"
  };
}

async function supabaseAuthRequest<T>(
  path: string,
  init: RequestInit = {},
  serviceRole = false,
  accessToken?: string
): Promise<T> {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!baseUrl) throw new Error("Supabase bağlantısı yapılandırılmadı.");

  const response = await fetch(`${baseUrl}/auth/v1/${path}`, {
    ...init,
    headers: {
      ...supabaseAuthHeaders(serviceRole, accessToken),
      ...(init.headers || {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Supabase Auth isteği başarısız oldu.");
  }

  return (await response.json()) as T;
}

export async function signInWithPassword(email: string, password: string) {
  return supabaseAuthRequest<{
    access_token: string;
    refresh_token: string;
    user: { id: string; email?: string };
  }>(
    "token?grant_type=password",
    {
      method: "POST",
      body: JSON.stringify({ email, password })
    },
    false
  );
}

export async function createSupabaseAuthUser({
  email,
  password,
  fullName
}: {
  email: string;
  password: string;
  fullName?: string;
}) {
  return supabaseAuthRequest<{ id: string; email?: string }>(
    "admin/users",
    {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName || "" }
      })
    },
    true
  );
}

export async function getProfileByAuthUserId(authUserId: string) {
  const rows = await supabaseRest<UserProfileRow[]>(
    `users?auth_user_id=eq.${encodeURIComponent(authUserId)}&select=id,auth_user_id,email,full_name,role,company_id,is_active&limit=1`
  );
  return rows[0] || null;
}

export async function getProfileById(id: string) {
  const rows = await supabaseRest<UserProfileRow[]>(
    `users?id=eq.${encodeURIComponent(id)}&select=id,auth_user_id,email,full_name,role,company_id,is_active&limit=1`
  );
  return rows[0] || null;
}

function profileToSession(profile: UserProfileRow, tokens?: { access_token?: string; refresh_token?: string }): AppSession {
  return {
    authUserId: profile.auth_user_id || undefined,
    profileId: profile.id,
    email: profile.email,
    role: profile.role,
    fullName: profile.full_name || "",
    companyId: profile.company_id,
    accessToken: tokens?.access_token,
    refreshToken: tokens?.refresh_token
  };
}

export async function authenticateUser({
  email,
  password,
  userType
}: {
  email: string;
  password: string;
  userType: "admin" | "customer";
}) {
  if (!hasSupabaseConfig()) {
    return { error: "Supabase bağlantısı yapılandırılmadı." as const };
  }

  let auth;
  try {
    auth = await signInWithPassword(email, password);
  } catch {
    return { error: "E-posta veya şifre hatalı." as const };
  }

  const profile = await getProfileByAuthUserId(auth.user.id);
  if (!profile) {
    return { error: "Kullanıcı profiliniz tanımlı değil. Lütfen yöneticiyle iletişime geçin." as const };
  }

  if (!profile.is_active) {
    return { error: "Hesabınız pasif durumda." as const };
  }

  if (userType === "admin" && !adminRoles.includes(profile.role)) {
    return { error: "Bu giriş türü için yetkiniz yok." as const };
  }

  if (userType === "customer" && profile.role !== "customer") {
    return { error: "Bu giriş türü için yetkiniz yok." as const };
  }

  return { session: profileToSession(profile, auth) };
}

export function isAdminRole(role?: string | null) {
  return role === "admin";
}

export function isStaffRole(role?: string | null) {
  return Boolean(role && adminRoles.includes(role as UserRole));
}
