import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getAdminPageData } from "@/lib/admin-page-data";
import { requireModuleAccess } from "@/lib/permissions";
import { redirect } from "next/navigation";

export default async function WebsiteAnalyticsAdminPage() {
  if (!(await requireModuleAccess("website-analytics"))) redirect("/hk-admin");

  return <AdminDashboard {...await getAdminPageData()} initialActive="Web Site Analitiği" />;
}
