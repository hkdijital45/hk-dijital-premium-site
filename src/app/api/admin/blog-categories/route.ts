import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { blogCategories } from "@/lib/blog-seo-shared";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

export async function GET() {
  const session = await getSession();
  if (!session || !isStaffRole(session.role)) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ categories: blogCategories, source: "seed" });
  try {
    const categories = await supabaseRest("blog_categories?is_active=eq.true&select=*&order=sort_order.asc");
    return NextResponse.json({ categories, source: "database" });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
