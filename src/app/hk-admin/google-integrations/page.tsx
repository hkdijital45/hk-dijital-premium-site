import { redirect } from "next/navigation";
import { IntegrationCenter } from "@/components/admin/Phase2OperatingSystem";
import { AdminStandaloneShell } from "@/components/admin/shell/AdminStandaloneShell";
import { getAdminPageData } from "@/lib/admin-page-data";
import { getIntegrations, safeIntegrationForClient } from "@/lib/business-flow";
import { requireModuleAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function GoogleIntegrationsPage() {
  if (!(await requireModuleAccess("api-ayarlari"))) redirect("/hk-admin");
  const data = await getAdminPageData();
  const integrations = (await getIntegrations("google")).map(safeIntegrationForClient);
  return (
    <AdminStandaloneShell currentSession={data.currentSession} allowedModules={data.allowedModules} activeLabel="Google" title="Google Entegrasyonu">
      <IntegrationCenter provider="google" content={data.initialContent} integrations={integrations} />
    </AdminStandaloneShell>
  );
}
