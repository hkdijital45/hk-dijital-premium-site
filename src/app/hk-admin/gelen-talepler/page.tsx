import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getAdminPageData } from "@/lib/admin-page-data";
import { requireModuleAccess } from "@/lib/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function GelenTaleplerPage() {
  if (!(await requireModuleAccess("gelen-talepler"))) redirect("/hk-admin");
  return <AdminDashboard {...await getAdminPageData()} initialActive="Gelen Talepler" />;
}
