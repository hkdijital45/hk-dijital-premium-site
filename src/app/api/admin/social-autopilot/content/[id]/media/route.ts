import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { uploadSocialMedia } from "@/lib/social-autopilot/storage";
import type { SocialContentItem } from "@/lib/social-autopilot/types";

// Human production step (spec section 16 boundary — see storage.ts): the AI
// pipeline writes the full creative brief, but the actual video/image file
// a designer or editor produces from it is attached here before an item can
// be scheduled.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireModuleAccess("social-autopilot");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });
  const { id } = await params;

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 });
  const kind = file.type.startsWith("video/") ? "video" : "image";

  try {
    const url = await uploadSocialMedia(file, kind);
    const existing = await supabaseRest<SocialContentItem[]>(`social_content_items?id=eq.${encodeURIComponent(id)}&select=media_asset_urls,publication_status&limit=1`);
    if (!existing[0]) return NextResponse.json({ error: "İçerik bulunamadı." }, { status: 404 });

    const nextUrls = [...(existing[0].media_asset_urls || []), url];
    const patch: Record<string, unknown> = { media_asset_urls: nextUrls };
    if (existing[0].publication_status === "generated") patch.publication_status = "ready";

    const rows = await supabaseRest<SocialContentItem[]>(`social_content_items?id=eq.${encodeURIComponent(id)}&select=*`, { method: "PATCH", body: JSON.stringify(patch) });
    return NextResponse.json({ item: rows[0], uploadedUrl: url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : getSafeSupabaseError(error).title }, { status: 500 });
  }
}
