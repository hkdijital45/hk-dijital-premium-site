import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getAdminPageData } from "@/lib/admin-page-data";
import { getAdminSectionBySlug } from "@/lib/admin-navigation";

export default async function AdminModulePage({
  params
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const section = getAdminSectionBySlug(module);
  if (!section) redirect("/hk-admin");
  return <AdminDashboard {...await getAdminPageData()} initialActive={section.label} />;
}
