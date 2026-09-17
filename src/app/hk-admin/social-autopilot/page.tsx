import { redirect } from "next/navigation";
import { ContentPlanningCenter } from "@/components/admin/ContentPlanningCenter";
import { AdminStandaloneShell } from "@/components/admin/shell/AdminStandaloneShell";
import { getAllowedModules, requireModuleAccess } from "@/lib/permissions";

export default async function SocialAutopilotAdminPage() {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) redirect("/hk-admin");
  return (
    <AdminStandaloneShell currentSession={session} allowedModules={getAllowedModules(session)} activeLabel="İçerik Planlama" title="İçerik Planlama">
      <ContentPlanningCenter />
    </AdminStandaloneShell>
  );
}
