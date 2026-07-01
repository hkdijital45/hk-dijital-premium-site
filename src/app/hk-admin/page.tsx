import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getAdminPageData } from "@/lib/admin-page-data";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  return <AdminDashboard {...await getAdminPageData()} />;
}
