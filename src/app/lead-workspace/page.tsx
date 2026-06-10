import { LeadWorkspace } from "@/components/admin/Phase2OperatingSystem";
import { getAdminPageData } from "@/lib/admin-page-data";

export const dynamic = "force-dynamic";

export default async function LeadWorkspacePage() {
  const data = await getAdminPageData();
  return <LeadWorkspace content={data.initialContent} />;
}
