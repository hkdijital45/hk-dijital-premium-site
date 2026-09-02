import { redirect } from "next/navigation";
import { GrowthIntelligenceCenter } from "@/components/admin/GrowthIntelligenceCenter";
import { AdminStandaloneShell } from "@/components/admin/shell/AdminStandaloneShell";
import { getAllowedModules, requireModuleAccess } from "@/lib/permissions";

export default async function GrowthIntelligenceAdminPage() {
  const session = await requireModuleAccess("growth-intelligence");
  if (!session) redirect("/hk-admin");
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  return (
    <AdminStandaloneShell currentSession={session} allowedModules={getAllowedModules(session)} activeLabel="HK Growth Intelligence" title="HK Growth Intelligence">
      <GrowthIntelligenceCenter geminiConfigured={geminiConfigured} />
    </AdminStandaloneShell>
  );
}
