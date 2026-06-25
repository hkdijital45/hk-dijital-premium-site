import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getAdminPageData } from "@/lib/admin-page-data";
import { requireModuleAccess } from "@/lib/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdInsightsPage() {
  if (!(await requireModuleAccess("ad-insights"))) redirect("/hk-admin");
  return <AdminDashboard {...await getAdminPageData()} initialActive="Reklam Doktoru Pro" />;
}
