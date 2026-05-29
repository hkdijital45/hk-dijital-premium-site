import { redirect } from "next/navigation";
import { getSiteContent } from "@/lib/content";
import { isAdminAuthenticated } from "@/lib/auth";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { hasSupabaseConfig } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authenticated = await isAdminAuthenticated();
  const content = await getSiteContent();

  if (!authenticated) redirect("/giris");

  return <AdminDashboard initialContent={content} supabaseConfigured={hasSupabaseConfig()} />;
}
