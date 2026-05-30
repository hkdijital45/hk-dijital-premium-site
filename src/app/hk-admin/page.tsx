import { redirect } from "next/navigation";
import { getSiteContent } from "@/lib/content";
import { getSession, isAdminAuthenticated } from "@/lib/auth";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authenticated = await isAdminAuthenticated();
  const session = await getSession();
  const content = await getSiteContent();

  if (!authenticated) redirect("/giris");

  let relationalContent = {};
  if (hasSupabaseConfig()) {
    try {
      const [companies, users, leads, contactForms, campaigns, campaignMetrics, customerUpdates, customerVisibilitySettings, customerFiles, mediaFiles] =
        await Promise.all([
          supabaseRest("companies?select=*&order=created_at.desc"),
          supabaseRest("users?select=*&order=created_at.desc"),
          supabaseRest("leads?select=*&order=created_at.desc"),
          supabaseRest("contact_forms?select=*&order=created_at.desc").catch(() => []),
          supabaseRest("campaigns?select=*&order=created_at.desc"),
          supabaseRest("campaign_metrics?select=*&order=date.desc"),
          supabaseRest("customer_updates?select=*&order=created_at.desc"),
          supabaseRest("customer_visibility_settings?select=*&order=updated_at.desc"),
          supabaseRest("customer_files?select=*&order=uploaded_at.desc"),
          supabaseRest("media_files?select=*&order=uploaded_at.desc")
        ]);
      relationalContent = {
        companies,
        users,
        leads,
        contactForms,
        campaigns,
        campaignMetrics,
        customerUpdates,
        customerVisibilitySettings,
        customerFiles,
        media: Array.isArray(mediaFiles)
          ? mediaFiles.map((item: any) => ({
              id: item.id,
              url: item.file_url,
              type: item.file_type === "pdf" ? "pdf" : item.file_type === "video" ? "video" : "image",
              name: item.file_name
            }))
          : []
      };
    } catch {
      relationalContent = {};
    }
  }

  return (
    <AdminDashboard
      initialContent={{ ...content, ...relationalContent }}
      supabaseConfigured={hasSupabaseConfig()}
      currentSession={session}
      bootstrapWarning={Boolean(process.env.BOOTSTRAP_ADMIN_SECRET || process.env.FORCE_BOOTSTRAP_ADMIN)}
    />
  );
}
