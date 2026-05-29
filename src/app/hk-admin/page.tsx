import { redirect } from "next/navigation";
import { getSiteContent } from "@/lib/content";
import { isAdminAuthenticated } from "@/lib/auth";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { AdminLogin } from "@/components/admin/AdminLogin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authenticated = await isAdminAuthenticated();
  const content = await getSiteContent();

  if (content.settings.maintenanceMode && !authenticated) {
    redirect("/");
  }

  return authenticated ? <AdminDashboard initialContent={content} /> : <AdminLogin />;
}
