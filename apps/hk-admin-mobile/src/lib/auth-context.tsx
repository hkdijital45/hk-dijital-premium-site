import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { apiFetch, ApiError } from "./api";

const TOKEN_KEY = "hk_admin_mobile_session_token";

export type MobileSession = {
  email: string;
  role: string;
  fullName?: string;
  allowedModules?: string[];
};

type AuthState = {
  token: string | null;
  session: MobileSession | null;
  loading: boolean;
  error: string | null;
  login: (identity: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<MobileSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore a previously-stored session token on cold start, then verify
  // it against the server (a token can expire/be revoked server-side) —
  // never trust a locally-cached session as still valid.
  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(TOKEN_KEY);
        if (!stored) return;
        const me = await apiFetch<{ session: MobileSession }>("/api/mobile/me", stored);
        setToken(stored);
        setSession(me.session);
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login(identity: string, password: string) {
    setError(null);
    try {
      const result = await apiFetch<{ token: string; session: MobileSession }>("/api/mobile/auth/login", null, {
        method: "POST",
        body: JSON.stringify({ identity, password })
      });
      await SecureStore.setItemAsync(TOKEN_KEY, result.token);
      setToken(result.token);
      setSession(result.session);
      return true;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Giriş yapılamadı. Bağlantınızı kontrol edin.");
      return false;
    }
  }

  async function logout() {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    setToken(null);
    setSession(null);
  }

  const value = useMemo(() => ({ token, session, loading, error, login, logout }), [token, session, loading, error]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
