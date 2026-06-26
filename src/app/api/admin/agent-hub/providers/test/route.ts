import { NextResponse } from "next/server";
import { getAgentProviders, shouldFallbackProvider, type AgentProviderKey } from "@/lib/agent-hub";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function POST(request: Request) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const providerKey = String(body.providerKey || "") as AgentProviderKey;
  const providers = await getAgentProviders();
  const provider = providers.find((item) => item.provider_key === providerKey);
  if (!provider) return NextResponse.json({ error: "Sağlayıcı bulunamadı." }, { status: 404 });

  const ok = !shouldFallbackProvider(provider);
  const message = ok
    ? `${provider.provider_name} kullanılabilir görünüyor.`
    : `${provider.provider_name} için API anahtarı veya aktif durum eksik. Bu görevlerde sıradaki sağlayıcı ya da Demo fallback kullanılacak.`;

  if (hasSupabaseConfig()) {
    await supabaseRest(`agent_providers?provider_key=eq.${encodeURIComponent(provider.provider_key)}`, {
      method: "PATCH",
      body: JSON.stringify({
        status: ok ? "active" : provider.status === "passive" ? "passive" : "not_configured",
        avg_response_ms: provider.provider_key === "demo" ? 5 : provider.avg_response_ms || 0,
        updated_at: new Date().toISOString()
      })
    }).catch(() => null);
  }

  return NextResponse.json({ ok, provider: provider.provider_key, message });
}
