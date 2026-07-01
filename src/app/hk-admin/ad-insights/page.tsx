import { requireModuleAccess } from "@/lib/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdInsightsPage() {
  if (!(await requireModuleAccess("ad-insights"))) redirect("/hk-admin");
  redirect("/hk-admin/reklam-performans?tab=reklam-doktoru");
}
