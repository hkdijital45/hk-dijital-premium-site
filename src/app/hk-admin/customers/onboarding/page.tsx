import { OnboardingCenter } from "@/components/admin/Phase2OperatingSystem";
import { getAdminPageData } from "@/lib/admin-page-data";

export const dynamic = "force-dynamic";

export default async function CustomerOnboardingPage() {
  const data = await getAdminPageData();
  return <OnboardingCenter content={data.initialContent} />;
}
