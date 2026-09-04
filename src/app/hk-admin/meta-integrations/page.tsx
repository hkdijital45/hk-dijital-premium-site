import { redirect } from "next/navigation";
import { IntegrationCenter } from "@/components/admin/Phase2OperatingSystem";
import { AdminStandaloneShell } from "@/components/admin/shell/AdminStandaloneShell";
import { getAdminPageData } from "@/lib/admin-page-data";
import { getIntegrations, safeIntegrationForClient } from "@/lib/business-flow";
import { requireModuleAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function MetaIntegrationsPage() {
  if (!(await requireModuleAccess("api-ayarlari"))) redirect("/hk-admin");
  const data = await getAdminPageData();
  const integrations = (await getIntegrations("meta")).map(safeIntegrationForClient);
  return (
    <AdminStandaloneShell currentSession={data.currentSession} allowedModules={data.allowedModules} activeLabel="Meta" title="Meta Entegrasyonu">
      <IntegrationCenter provider="meta" content={data.initialContent} integrations={integrations} />
    </AdminStandaloneShell>
  );
}
