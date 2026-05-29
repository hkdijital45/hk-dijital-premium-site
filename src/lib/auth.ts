import { cookies } from "next/headers";
import { hasSupabaseConfig, supabaseRest } from "./supabase";

export const adminCookieName = "hk_admin_session";
export const authCookieName = "hk_auth_session";

export type AppSession = {
  email: string;
  role: "admin" | "editor" | "sales" | "customer";
  fullName?: string;
  companyId?: string;
};

export function getAdminCredentials() {
  return {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "hk-dijital-2026",
    sessionSecret: process.env.ADMIN_SESSION_SECRET || "local-demo-session"
  };
}

function encodeSession(session: AppSession) {
  return Buffer.from(JSON.stringify(session)).toString("base64url");
}

function decodeSession(value?: string): AppSession | null {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as AppSession;
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
  const modern = decodeSession(cookieStore.get(authCookieName)?.value);
  if (modern) return modern;

  const legacy = cookieStore.get(adminCookieName)?.value;
  if (legacy === getAdminCredentials().sessionSecret) {
    return { email: getAdminCredentials().username, role: "admin" as const, fullName: "HK Dijital Yönetici" };
  }
  return null;
}

export async function isAdminAuthenticated() {
  const session = await getSession();
  return Boolean(session && ["admin", "editor", "sales"].includes(session.role));
}

export async function isCustomerAuthenticated() {
  const session = await getSession();
  return session?.role === "customer";
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
  if (hasSupabaseConfig()) {
    const rows = await supabaseRest<Array<AppSession & { is_active: boolean }>>(
      `users?email=eq.${encodeURIComponent(email)}&is_active=eq.true&select=email,full_name,role,company_id,is_active&limit=1`
    );
    const user = rows[0];
    if (!user) return null;

    const adminRoles = ["admin", "editor", "sales"];
    if (userType === "admin" && !adminRoles.includes(user.role)) return null;
    if (userType === "customer" && user.role !== "customer") return null;

    // Production note: connect this to Supabase Auth signInWithPassword.
    // This fallback checks the password against environment variables only.
    const fallbackPassword =
      userType === "admin" ? process.env.ADMIN_PASSWORD : process.env.CUSTOMER_PASSWORD;
    if (fallbackPassword && password !== fallbackPassword) return null;

    return {
      email: user.email,
      role: user.role,
      fullName: user.full_name,
      companyId: user.company_id
    } as AppSession;
  }

  const admin = getAdminCredentials();
  if (userType === "admin" && email === admin.username && password === admin.password) {
    return { email, role: "admin" as const, fullName: "HK Dijital Yönetici" };
  }

  if (
    userType === "customer" &&
    process.env.CUSTOMER_EMAIL &&
    process.env.CUSTOMER_PASSWORD &&
    email === process.env.CUSTOMER_EMAIL &&
    password === process.env.CUSTOMER_PASSWORD
  ) {
    return {
      email,
      role: "customer" as const,
      fullName: process.env.CUSTOMER_NAME || "Müşteri",
      companyId: process.env.CUSTOMER_COMPANY_ID || "demo-company"
    };
  }

  return null;
}
