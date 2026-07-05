import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export type CustomerAiSettings = {
  id?: string;
  customer_id: string;
  assistant_enabled: boolean;
  real_ai_enabled: boolean;
  provider: string;
  allowed_contexts: string[];
  daily_message_limit: number;
  welcome_message: string;
  admin_note: string;
  created_at?: string;
  updated_at?: string;
};

export const defaultAiContexts = ["general", "reports", "ads", "tasks", "payments", "files"];

export function defaultCustomerAiSettings(customerId: string): CustomerAiSettings {
  return {
    customer_id: customerId,
    assistant_enabled: true,
    real_ai_enabled: false,
    provider: "demo",
    allowed_contexts: ["general"],
    daily_message_limit: 20,
    welcome_message: "Merhaba, HK Asistan size rapor, reklam, görev ve içerik konularında yardımcı olur.",
    admin_note: ""
  };
}

export function sanitizeCustomerAiSettings(row: Partial<CustomerAiSettings> | null | undefined, customerId: string): CustomerAiSettings {
  return {
    ...defaultCustomerAiSettings(customerId),
    ...(row || {}),
    customer_id: customerId,
    assistant_enabled: row?.assistant_enabled !== false,
    real_ai_enabled: Boolean(row?.real_ai_enabled),
    provider: String(row?.provider || "demo"),
    allowed_contexts: Array.isArray(row?.allowed_contexts) && row.allowed_contexts.length ? row.allowed_contexts.map(String) : ["general"],
    daily_message_limit: Math.max(1, Math.min(200, Number(row?.daily_message_limit || 20))),
    welcome_message: String(row?.welcome_message || defaultCustomerAiSettings(customerId).welcome_message),
    admin_note: String(row?.admin_note || "")
  };
}

export async function getCustomerAiSettings(customerId: string) {
  if (!hasSupabaseConfig()) return defaultCustomerAiSettings(customerId);
  const rows = await supabaseRest<CustomerAiSettings[]>(
    `customer_ai_settings?customer_id=eq.${encodeURIComponent(customerId)}&select=*&limit=1`
  ).catch((error) => {
    const message = String(error instanceof Error ? error.message : error).toLowerCase();
    if (message.includes("customer_ai_settings") || message.includes("relation") || message.includes("does not exist")) return [] as CustomerAiSettings[];
    const safe = getSafeSupabaseError(error);
    if (safe.title === "Veritabanı şema hatası") return [] as CustomerAiSettings[];
    throw error;
  });
  return sanitizeCustomerAiSettings(rows[0], customerId);
}

export async function upsertCustomerAiSettings(customerId: string, patch: Partial<CustomerAiSettings>) {
  const payload = sanitizeCustomerAiSettings({ ...patch, customer_id: customerId }, customerId);
  const rows = await supabaseRest<CustomerAiSettings[]>("customer_ai_settings?on_conflict=customer_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(payload)
  });
  return sanitizeCustomerAiSettings(rows[0], customerId);
}

export function providerEnvStatus(provider: string) {
  const key = provider.toLowerCase();
  if (key === "openai") return { ready: Boolean(process.env.OPENAI_API_KEY), missing: process.env.OPENAI_API_KEY ? [] : ["OPENAI_API_KEY"] };
  if (key === "gemini") return { ready: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY), missing: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY ? [] : ["GEMINI_API_KEY"] };
  if (key === "groq") return { ready: Boolean(process.env.GROQ_API_KEY), missing: process.env.GROQ_API_KEY ? [] : ["GROQ_API_KEY"] };
  return { ready: true, missing: [] };
}
