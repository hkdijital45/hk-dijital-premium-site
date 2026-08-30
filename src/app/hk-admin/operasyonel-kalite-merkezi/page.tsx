import { redirect } from "next/navigation";
import { OperationalQualityCenter } from "@/components/admin/OperationalQualityCenter";
import { AdminStandaloneShell } from "@/components/admin/shell/AdminStandaloneShell";
import { getAllowedModules, requireModuleAccess } from "@/lib/permissions";

export default async function OperationalQualityAdminPage() {
  const session = await requireModuleAccess("operational-quality");
  if (!session) redirect("/hk-admin");
  return (
    <AdminStandaloneShell currentSession={session} allowedModules={getAllowedModules(session)} activeLabel="Operasyonel Kalite Merkezi" title="Operasyonel Kalite Merkezi">
      <OperationalQualityCenter />
    </AdminStandaloneShell>
  );
}
