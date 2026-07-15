import { redirect } from "next/navigation";
import { BlogSeoCenter } from "@/components/admin/BlogSeoCenter";
import { requireModuleAccess } from "@/lib/permissions";

export default async function BlogSeoAdminPage() {
  const session = await requireModuleAccess("blog-seo");
  if (!session) redirect("/hk-admin");
  return <BlogSeoCenter />;
}
