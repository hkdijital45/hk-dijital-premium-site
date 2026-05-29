import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getSiteContent, saveSiteContent } from "@/lib/content";
import { isAdminAuthenticated } from "@/lib/auth";
import { hasSupabaseConfig, supabaseRest, uploadToSupabaseStorage } from "@/lib/supabase";

const allowedTypes = ["image/png", "image/svg+xml", "image/jpeg", "image/webp", "video/mp4", "video/webm", "application/pdf"];

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || !allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "PNG, SVG, JPG, WebP veya video dosyası yükleyin." }, { status: 400 });
  }

  const extension = file.name.split(".").pop() || "asset";
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  let url = `/uploads/${safeName}`;

  if (hasSupabaseConfig()) {
    url = await uploadToSupabaseStorage(file);
  } else if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Supabase Storage yapılandırılmadı. Canlı ortamda dosya yükleme çalışmaz." }, { status: 500 });
  } else {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, safeName), buffer);
  }

  const content = await getSiteContent();
  const media = {
    id: safeName,
    url,
    type: file.type === "application/pdf" ? ("pdf" as const) : file.type.startsWith("video") ? ("video" as const) : ("image" as const),
    name: file.name || `media.${extension}`
  };
  content.media.unshift(media);
  await saveSiteContent(content);
  if (hasSupabaseConfig()) {
    await supabaseRest("media_files", {
      method: "POST",
      body: JSON.stringify({
        file_name: file.name,
        file_url: url,
        file_type: media.type,
        file_size: file.size
      })
    }).catch(() => null);
  }

  return NextResponse.json({ ok: true, media });
}
