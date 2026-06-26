import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getAdminPageData } from "@/lib/admin-page-data";
import { requireModuleAccess } from "@/lib/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AgentHubPage() {
  if (!(await requireModuleAccess("agent-hub"))) redirect("/hk-admin");
  const pageData = await getAdminPageData() as Parameters<typeof AdminDashboard>[0];
  return <AdminDashboard {...pageData} initialActive="HK Agent Hub" />;
}
