import { OnboardingCenter } from "@/components/admin/Phase2OperatingSystem";
import { AdminStandaloneShell } from "@/components/admin/shell/AdminStandaloneShell";
import { getAdminPageData } from "@/lib/admin-page-data";

export const dynamic = "force-dynamic";

export default async function CustomerOnboardingPage() {
  const data = await getAdminPageData();
  return (
    <AdminStandaloneShell currentSession={data.currentSession} allowedModules={data.allowedModules} activeLabel="Onboarding" title="Onboarding">
      <OnboardingCenter content={data.initialContent} />
    </AdminStandaloneShell>
  );
}
