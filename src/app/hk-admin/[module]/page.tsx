import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getAdminPageData } from "@/lib/admin-page-data";
import { getAdminHref, getAdminSectionBySlug, getCanonicalAdminSlug } from "@/lib/admin-navigation";
import { requireModuleAccess } from "@/lib/permissions";

export default async function AdminModulePage({
  params
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const canonicalSlug = getCanonicalAdminSlug(module);
  if (canonicalSlug !== module) redirect(getAdminHref(canonicalSlug));
  const section = getAdminSectionBySlug(module);
  if (!section) redirect("/hk-admin");
  if (!(await requireModuleAccess(section.module))) redirect("/hk-admin");
  return <AdminDashboard {...await getAdminPageData()} initialActive={section.label} />;
}
