import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const assetTypes = ["image", "video", "copy", "other"];

async function requireStaff() {
  const session = await getSession();
  return session && isStaffRole(session.role) ? session : null;
}

export async function GET(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ assets: [] });

  const companyId = new URL(request.url).searchParams.get("companyId");
  const filters = ["select=*", "order=created_at.desc", "limit=200"];
  if (companyId) filters.push(`company_id=eq.${encodeURIComponent(companyId)}`);

  try {
    const assets = await supabaseRest<Array<Record<string, unknown>>>(`creative_assets?${filters.join("&")}`);
    return NextResponse.json({ assets });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}

// Metadata layer only — the actual file must already be uploaded via the
// existing customer document/media upload routes (Supabase Storage,
// tenant-scoped paths). This just registers it as a versioned, approvable
// creative asset rather than reimplementing file upload.
export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase yapılandırılmadı." }, { status: 503 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const companyId = String(body.companyId || "");
  const storagePath = String(body.storagePath || "");
  const assetType = assetTypes.includes(String(body.assetType)) ? String(body.assetType) : "image";
  if (!companyId || !storagePath) return NextResponse.json({ error: "companyId ve storagePath zorunludur." }, { status: 400 });

  try {
    let version = 1;
    if (body.parentAssetId) {
      const parentVersions = await supabaseRest<Array<{ version: number }>>(
        `creative_assets?parent_asset_id=eq.${encodeURIComponent(String(body.parentAssetId))}&select=version&order=version.desc&limit=1`
      );
      version = (parentVersions[0]?.version || 1) + 1;
    }

    const inserted = await supabaseRest<Array<Record<string, unknown>>>("creative_assets", {
      method: "POST",
      body: JSON.stringify({
        company_id: companyId,
        campaign_id: body.campaignId || null,
        asset_type: assetType,
        storage_path: storagePath,
        version,
        parent_asset_id: body.parentAssetId || null,
        status: "draft",
        metadata: body.metadata || {},
        created_by: session.profileId || null
      })
    });
    return NextResponse.json({ asset: inserted[0] });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).detail }, { status: 500 });
  }
}
