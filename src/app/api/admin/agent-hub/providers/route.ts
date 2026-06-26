import { NextResponse } from "next/server";
import { defaultAgentProviders, getAgentProviders, type AgentProviderKey } from "@/lib/agent-hub";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function GET() {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const providers = await getAgentProviders();
  return NextResponse.json({
    providers: providers.map((provider) => ({
      ...provider,
      secret_value: undefined
    }))
  });
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("agent-hub");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı. Provider ayarları kalıcı kaydedilemez." }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const providerKey = String(body.providerKey || "") as AgentProviderKey;
  const seed = defaultAgentProviders.find((provider) => provider.provider_key === providerKey);
  if (!seed) return NextResponse.json({ error: "Geçersiz sağlayıcı." }, { status: 400 });

  const status = ["active", "passive", "error", "not_configured"].includes(String(body.status)) ? String(body.status) : seed.status;
  const providerPayload = {
    provider_key: providerKey,
    provider_name: seed.provider_name,
    role_label: body.roleLabel || seed.role_label,
    status,
    default_model: body.defaultModel || seed.default_model,
    purpose: body.purpose || seed.purpose,
    daily_limit: Number(body.dailyLimit || 0) || null,
    monthly_limit: Number(body.monthlyLimit || 0) || null,
    estimated_monthly_cost: Number(body.estimatedMonthlyCost || 0) || null,
    notes: body.notes || seed.notes || null,
    updated_at: new Date().toISOString()
  };

  await supabaseRest("agent_providers?on_conflict=provider_key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(providerPayload)
  });

  const apiKey = String(body.apiKey || "").trim();
  if (apiKey) {
    await supabaseRest("agent_provider_secrets?on_conflict=provider_key,secret_name", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        provider_key: providerKey,
        secret_name: `${providerKey.toUpperCase()}_API_KEY`,
        secret_value: apiKey,
        is_active: true,
        updated_at: new Date().toISOString()
      })
    });
  }

  return NextResponse.json({ ok: true, message: "Provider ayarları kaydedildi. API anahtarı frontend'e geri dönmedi." });
}
