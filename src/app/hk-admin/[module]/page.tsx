import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getAdminPageData } from "@/lib/admin-page-data";
import { getAdminHref, getAdminSectionBySlug, getCanonicalAdminSlug } from "@/lib/admin-navigation";
import { requireModuleAccess } from "@/lib/permissions";

export default async function AdminModulePage({
  params,
  searchParams
}: {
  params: Promise<{ module: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { module } = await params;
  const query = await searchParams;
  const canonicalSlug = getCanonicalAdminSlug(module);
  if (canonicalSlug !== module) {
    const forwardedParams = new URLSearchParams();
    for (const [key, value] of Object.entries(query || {})) {
      if (typeof value === "string") forwardedParams.set(key, value);
      else if (Array.isArray(value)) value.forEach((item) => forwardedParams.append(key, item));
    }
    const queryString = forwardedParams.toString();
    redirect(queryString ? `${getAdminHref(canonicalSlug)}?${queryString}` : getAdminHref(canonicalSlug));
  }
  const section = getAdminSectionBySlug(module);
  if (!section) redirect("/hk-admin");
  if (!(await requireModuleAccess(section.module))) redirect("/hk-admin");
  const tabParam = query?.tab;
  return <AdminDashboard {...await getAdminPageData()} initialActive={section.label} initialAccountingTab={typeof tabParam === "string" ? tabParam : undefined} />;
}
