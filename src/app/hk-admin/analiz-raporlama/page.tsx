import { redirect } from "next/navigation";
import { AnalyticsReportingCenter } from "@/components/admin/AnalyticsReportingCenter";
import { AdminStandaloneShell } from "@/components/admin/shell/AdminStandaloneShell";
import { getAllowedModules, requireModuleAccess } from "@/lib/permissions";

export default async function AnalyticsReportingCenterPage() {
  const session = await requireModuleAccess("analiz-raporlama");
  if (!session) redirect("/hk-admin");
  return (
    <AdminStandaloneShell currentSession={session} allowedModules={getAllowedModules(session)} activeLabel="Analiz & Raporlama Merkezi" title="Analiz & Raporlama Merkezi">
      <AnalyticsReportingCenter />
    </AdminStandaloneShell>
  );
}
