import { redirect } from "next/navigation";
import { OrganicGrowthCenter } from "@/components/admin/OrganicGrowthCenter";
import { AdminStandaloneShell } from "@/components/admin/shell/AdminStandaloneShell";
import { getAllowedModules, requireModuleAccess } from "@/lib/permissions";

export default async function OrganicGrowthCenterPage() {
  const session = await requireModuleAccess("blog-seo");
  if (!session) redirect("/hk-admin");
  return (
    <AdminStandaloneShell currentSession={session} allowedModules={getAllowedModules(session)} activeLabel="Organik Büyüme Merkezi" title="Organik Büyüme Merkezi">
      <OrganicGrowthCenter />
    </AdminStandaloneShell>
  );
}
