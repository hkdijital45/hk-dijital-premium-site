import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { getSafeSupabaseError } from "@/lib/supabase";
import { validateBrandLogoMeta } from "@/lib/brand-showcase";
import { uploadBrandLogo } from "@/lib/brand-showcase-storage";

export async function POST(request: Request) {
  const session = await requireModuleAccess("markalar");
  if (!session) return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("logo");
  if (!file || !(file instanceof File)) return NextResponse.json({ error: "Logo dosyası bulunamadı." }, { status: 400 });

  const check = validateBrandLogoMeta(file);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const previousUrl = String(form?.get("previousUrl") ?? "").trim() || undefined;
  try {
    const url = await uploadBrandLogo(file, previousUrl);
    return NextResponse.json({ url });
  } catch (error) {
    return NextResponse.json({ error: getSafeSupabaseError(error).title || "Logo yüklenemedi." }, { status: 500 });
  }
}
