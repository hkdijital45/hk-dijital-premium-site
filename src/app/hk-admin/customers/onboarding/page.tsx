import { redirect } from "next/navigation";
import { OnboardingCenter } from "@/components/admin/Phase2OperatingSystem";
import { AdminStandaloneShell } from "@/components/admin/shell/AdminStandaloneShell";
import { getAdminPageData } from "@/lib/admin-page-data";
import { requireModuleAccess } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function CustomerOnboardingPage() {
  if (!(await requireModuleAccess("musteriler"))) redirect("/hk-admin");
  const data = await getAdminPageData();
  return (
    <AdminStandaloneShell currentSession={data.currentSession} allowedModules={data.allowedModules} activeLabel="Onboarding" title="Onboarding">
      <OnboardingCenter content={data.initialContent} />
    </AdminStandaloneShell>
  );
}
