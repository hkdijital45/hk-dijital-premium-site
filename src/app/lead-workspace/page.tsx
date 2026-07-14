import { LeadWorkspace } from "@/components/admin/Phase2OperatingSystem";
import { getAdminPageData } from "@/lib/admin-page-data";
import { isAdminRole } from "@/lib/auth";
import { requireModuleAccess } from "@/lib/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LeadWorkspacePage() {
  const session = await requireModuleAccess("leads");
  if (!session) redirect("/digital-center?error=yetkisiz");
  const data = await getAdminPageData();
  return <LeadWorkspace content={data.initialContent} canManageTestRecords={isAdminRole(session.role)} />;
}
