import { requireModuleAccess } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function WebsiteAnalyticsAdminPage() {
  if (!(await requireModuleAccess("website-analytics"))) redirect("/hk-admin");
  redirect("/hk-admin/reklam-performans?tab=website-analytics");
}
