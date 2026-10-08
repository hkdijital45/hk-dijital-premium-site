import Constants from "expo-constants";

export const API_BASE_URL: string = (Constants.expoConfig?.extra?.apiBaseUrl as string) || "https://www.hkdijital.com.tr";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/**
 * All requests go to the existing HK Admin Next.js app's own API routes —
 * no second backend, no direct Supabase access from the device (no
 * service-role key, no anon key, ever shipped to mobile code). Auth is a
 * Bearer token (the exact same signed, stateless session string the web
 * app's auth cookie already carries — see /api/mobile/auth/login) instead
 * of a cookie, since React Native has no browser cookie jar shared with
 * the server.
 */
export async function apiFetch<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(body.error || "Sunucu hatası oluştu.", response.status);
  }
  return body as T;
}
