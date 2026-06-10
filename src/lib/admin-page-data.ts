/* eslint-disable @typescript-eslint/no-explicit-any */
import { redirect } from "next/navigation";
import { getSiteContent } from "@/lib/content";
import { getSession, isAdminAuthenticated } from "@/lib/auth";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { getAllowedModules } from "@/lib/permissions";

export async function getAdminPageData() {
  const authenticated = await isAdminAuthenticated();
  const session = await getSession();
  const content = await getSiteContent();
  const allowedModules = getAllowedModules(session);

  if (!authenticated) {
    if (session) redirect("/digital-center?error=yetkisiz");
    redirect("/digital-center");
  }

  let relationalContent = {};
  if (hasSupabaseConfig()) {
    try {
      const [companies, users, customers, leads, contactForms, campaigns, campaignMetrics, customerUpdates, customerVisibilitySettings, customerFiles, mediaFiles, activityLogs, reports, reportInterpretations, reportUpdates, preparationNotes, customerBranding, monthlyReports, agencyTasks, customerDocuments, paymentRecords, competitorAnalyses, socialMediaPlans, agencyExpenses, sectorConfigs] =
        await Promise.all([
          supabaseRest("companies?select=*&order=created_at.desc"),
          supabaseRest("users?select=*&order=created_at.desc"),
          supabaseRest("customers?select=*&order=created_at.desc").catch(() => []),
          supabaseRest("leads?select=*&order=created_at.desc"),
          supabaseRest("contact_forms?select=*&order=created_at.desc").catch(() => []),
          supabaseRest("campaigns?select=*&order=created_at.desc"),
          supabaseRest("campaign_metrics?select=*&order=date.desc"),
          supabaseRest("customer_updates?select=*&order=created_at.desc"),
          supabaseRest("customer_visibility_settings?select=*&order=updated_at.desc"),
          supabaseRest("customer_files?select=*&order=uploaded_at.desc"),
          supabaseRest("media_files?select=*&order=uploaded_at.desc"),
          supabaseRest("activity_logs?select=*&order=created_at.desc&limit=500").catch(() => []),
          supabaseRest("reports?select=*&order=created_at.desc").catch(() => []),
          supabaseRest("report_interpretations?select=*&order=created_at.desc").catch(() => []),
          supabaseRest("report_updates?select=*&order=is_pinned.desc,update_date.desc").catch(() => [])
          ,
          supabaseRest("preparation_notes?select=*&order=updated_at.desc").catch(() => []),
          supabaseRest("customer_branding?select=*&order=updated_at.desc").catch(() => []),
          supabaseRest("monthly_reports?select=*&order=updated_at.desc").catch(() => []),
          supabaseRest("agency_tasks?select=*&order=due_date.asc").catch(() => []),
          supabaseRest("customer_documents?select=*&order=document_date.desc").catch(() => []),
          supabaseRest("payment_records?select=*&order=due_date.desc").catch(() => []),
          supabaseRest("competitor_analyses?select=*&order=updated_at.desc").catch(() => []),
          supabaseRest("social_media_plans?select=*&order=updated_at.desc").catch(() => []),
          supabaseRest("agency_expenses?select=*&order=expense_date.desc").catch(() => []),
          supabaseRest("sector_configs?select=*&order=sector_name.asc").catch(() => [])
        ]);
      relationalContent = {
        companies,
        users: allowedModules.includes("kullanicilar") ? users : [],
        customers,
        leads,
        contactForms,
        campaigns,
        campaignMetrics,
        customerUpdates,
        customerVisibilitySettings,
        customerFiles,
        activityLogs: allowedModules.includes("sistem-loglari") ? activityLogs : [],
        reports,
        reportInterpretations,
        reportUpdates,
        preparationNotes,
        customerBranding,
        monthlyReports,
        agencyTasks,
        customerDocuments,
        paymentRecords,
        competitorAnalyses,
        socialMediaPlans,
        agencyExpenses,
        sectorConfigs,
        media: Array.isArray(mediaFiles)
          ? mediaFiles.map((item: any) => ({
              id: item.id,
              url: item.file_url,
              type: item.file_type === "pdf" ? "pdf" : item.file_type === "video" ? "video" : "image",
              name: item.file_name
            }))
          : []
      };
    } catch (error) {
      console.error("[admin-page-data] Supabase verileri yüklenemedi", error);
      relationalContent = {};
    }
  }

  const safeContent = {
    ...content,
    settings: {
      ...content.settings,
      api: {
        ...content.settings.api,
        geminiApiKey: "",
        groqApiKey: "",
        openAiApiKey: ""
      }
    }
  };

  return {
    initialContent: { ...safeContent, ...relationalContent },
    supabaseConfigured: hasSupabaseConfig(),
    systemStatus: {
      supabase: hasSupabaseConfig(),
      openai: Boolean(process.env.OPENAI_API_KEY),
      groq: Boolean(process.env.GROQ_API_KEY),
      gemini: Boolean(process.env.GEMINI_API_KEY),
      googleMaps: Boolean(process.env.GOOGLE_MAPS_API_KEY),
      email: Boolean(process.env.RESEND_API_KEY)
    },
    currentSession: session,
    allowedModules,
    bootstrapWarning: Boolean(process.env.BOOTSTRAP_ADMIN_SECRET || process.env.FORCE_BOOTSTRAP_ADMIN)
  };
}
