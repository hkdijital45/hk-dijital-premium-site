import { redirect } from "next/navigation";
import { HkConnectCenter } from "@/components/admin/HkConnectCenter";
import { AdminStandaloneShell } from "@/components/admin/shell/AdminStandaloneShell";
import { getAllowedModules, requireModuleAccess } from "@/lib/permissions";

export default async function HkConnectAdminPage() {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) redirect("/hk-admin");
  return (
    <AdminStandaloneShell currentSession={session} allowedModules={getAllowedModules(session)} activeLabel="HK Connect" title="HK Connect">
      <HkConnectCenter />
    </AdminStandaloneShell>
  );
}
