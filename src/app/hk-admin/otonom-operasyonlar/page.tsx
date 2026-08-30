import { redirect } from "next/navigation";
import { AutonomousOpsCenter } from "@/components/admin/AutonomousOpsCenter";
import { AdminStandaloneShell } from "@/components/admin/shell/AdminStandaloneShell";
import { getAllowedModules, requireModuleAccess } from "@/lib/permissions";

export default async function AutonomousOpsAdminPage() {
  const session = await requireModuleAccess("customer-risk");
  if (!session) redirect("/hk-admin");
  return (
    <AdminStandaloneShell currentSession={session} allowedModules={getAllowedModules(session)} activeLabel="Otonom Operasyonlar" title="Otonom Operasyonlar">
      <AutonomousOpsCenter />
    </AdminStandaloneShell>
  );
}
