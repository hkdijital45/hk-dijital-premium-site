import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getAdminPageData } from "@/lib/admin-page-data";
import { requireModuleAccess } from "@/lib/permissions";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PreAuditCenterPage() {
  if (!(await requireModuleAccess("on-inceleme"))) redirect("/hk-admin");
  return <AdminDashboard {...await getAdminPageData()} initialActive="Ön İnceleme Merkezi" />;
}
