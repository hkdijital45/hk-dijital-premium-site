import { redirect } from "next/navigation";
import { AgencyIntelligenceCenter } from "@/components/admin/AgencyIntelligenceCenter";
import { AdminStandaloneShell } from "@/components/admin/shell/AdminStandaloneShell";
import { getAllowedModules, requireModuleAccess } from "@/lib/permissions";

export default async function AgencyIntelligenceAdminPage() {
  const session = await requireModuleAccess("karlilik");
  if (!session) redirect("/hk-admin");
  return (
    <AdminStandaloneShell currentSession={session} allowedModules={getAllowedModules(session)} activeLabel="HK Ajans Zekası" title="HK Ajans Zekası">
      <AgencyIntelligenceCenter />
    </AdminStandaloneShell>
  );
}
