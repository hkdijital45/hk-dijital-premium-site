import { IntegrationCenter } from "@/components/admin/Phase2OperatingSystem";
import { AdminStandaloneShell } from "@/components/admin/shell/AdminStandaloneShell";
import { getAdminPageData } from "@/lib/admin-page-data";
import { getIntegrations, safeIntegrationForClient } from "@/lib/business-flow";

export const dynamic = "force-dynamic";

export default async function GoogleIntegrationsPage() {
  const data = await getAdminPageData();
  const integrations = (await getIntegrations("google")).map(safeIntegrationForClient);
  return (
    <AdminStandaloneShell currentSession={data.currentSession} allowedModules={data.allowedModules} activeLabel="Google" title="Google Entegrasyonu">
      <IntegrationCenter provider="google" content={data.initialContent} integrations={integrations} />
    </AdminStandaloneShell>
  );
}
