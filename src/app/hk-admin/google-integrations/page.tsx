import { IntegrationCenter } from "@/components/admin/Phase2OperatingSystem";
import { getAdminPageData } from "@/lib/admin-page-data";
import { getIntegrations, safeIntegrationForClient } from "@/lib/business-flow";

export const dynamic = "force-dynamic";

export default async function GoogleIntegrationsPage() {
  const data = await getAdminPageData();
  const integrations = (await getIntegrations("google")).map(safeIntegrationForClient);
  return <IntegrationCenter provider="google" content={data.initialContent} integrations={integrations} />;
}
