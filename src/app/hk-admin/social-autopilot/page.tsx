import { redirect } from "next/navigation";
import { SocialAutopilotCenter } from "@/components/admin/SocialAutopilotCenter";
import { AdminStandaloneShell } from "@/components/admin/shell/AdminStandaloneShell";
import { getAllowedModules, requireModuleAccess } from "@/lib/permissions";

export default async function SocialAutopilotAdminPage() {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) redirect("/hk-admin");
  return (
    <AdminStandaloneShell currentSession={session} allowedModules={getAllowedModules(session)} activeLabel="Social Autopilot" title="HK Social Autopilot">
      <SocialAutopilotCenter />
    </AdminStandaloneShell>
  );
}
