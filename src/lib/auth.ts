import { cookies } from "next/headers";

export const adminCookieName = "hk_admin_session";

export function getAdminCredentials() {
  return {
    username: process.env.ADMIN_USERNAME || "admin",
    password: process.env.ADMIN_PASSWORD || "hk-dijital-2026",
    sessionSecret: process.env.ADMIN_SESSION_SECRET || "local-demo-session"
  };
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  const session = cookieStore.get(adminCookieName)?.value;
  return session === getAdminCredentials().sessionSecret;
}
