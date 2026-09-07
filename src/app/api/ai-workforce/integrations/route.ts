import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { AI_WORKFORCE_MODULE } from "@/lib/ai-workforce-schema";
import { getAgentProviders } from "@/lib/agent-hub";

// Reuses the exact same provider-status resolution as Agent Hub / the SWOT
// endpoint (getAgentProviders — env + agent_providers table merge) instead of
// maintaining a second credential/status check. Ad-platform (Meta/Google/GA4)
// connection status already has its own dedicated screen in HK Admin
// (Entegrasyonlar) — not duplicated here.
export async function GET() {
  const session = await requireModuleAccess(AI_WORKFORCE_MODULE);
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  const providers = await getAgentProviders();
  return NextResponse.json({
    providers: providers.map((provider) => ({
      key: provider.provider_key,
      name: provider.provider_name,
      status: provider.status,
      configured: provider.configured,
      roleLabel: provider.role_label
    })),
    supabaseConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    cronConfigured: Boolean(process.env.CRON_SECRET)
  });
}
