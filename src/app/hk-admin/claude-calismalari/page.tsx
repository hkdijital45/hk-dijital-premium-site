import { redirect } from "next/navigation";
import { ClaudeCalismalariCenter } from "@/components/admin/ClaudeCalismalariCenter";
import { AdminStandaloneShell } from "@/components/admin/shell/AdminStandaloneShell";
import { getAllowedModules, requireModuleAccess } from "@/lib/permissions";

export default async function ClaudeCalismalariAdminPage() {
  const session = await requireModuleAccess("hk-intelligence-ceo");
  if (!session) redirect("/hk-admin");
  return (
    <AdminStandaloneShell currentSession={session} allowedModules={getAllowedModules(session)} activeLabel="Claude Çalışmaları" title="Claude Çalışmaları">
      <ClaudeCalismalariCenter />
    </AdminStandaloneShell>
  );
}
