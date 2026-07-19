import { redirect } from "next/navigation";
import { BlogSeoCenter } from "@/components/admin/BlogSeoCenter";
import { AdminStandaloneShell } from "@/components/admin/shell/AdminStandaloneShell";
import { getAllowedModules, requireModuleAccess } from "@/lib/permissions";

export default async function BlogSeoAdminPage() {
  const session = await requireModuleAccess("blog-seo");
  if (!session) redirect("/hk-admin");
  return (
    <AdminStandaloneShell currentSession={session} allowedModules={getAllowedModules(session)} activeLabel="Blog & SEO Merkezi" title="Blog & SEO Merkezi">
      <BlogSeoCenter />
    </AdminStandaloneShell>
  );
}
