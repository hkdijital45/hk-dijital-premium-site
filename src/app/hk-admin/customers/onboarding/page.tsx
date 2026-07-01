import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CustomerOnboardingPage() {
  redirect("/hk-admin/musteri-merkezi?tab=onboarding");
}
