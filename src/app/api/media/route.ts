import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getSiteContent, saveSiteContent } from "@/lib/content";
import { isAdminAuthenticated } from "@/lib/auth";
import { hasSupabaseConfig, supabaseRest, uploadToSupabaseStorage } from "@/lib/supabase";

const allowedTypes = ["image/png", "image/svg+xml", "image/jpeg", "image/webp", "video/mp4", "video/webm", "application/pdf"];
const maxFileSize = 10 * 1024 * 1024;
const logoTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const logoMaxFileSize = 5 * 1024 * 1024;

function hasValidLogoSignature(type: string, buffer: Buffer) {
  if (type === "image/png") {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (type === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (type === "image/webp") {
    return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Yetkisiz erişim" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const purpose = String(form.get("purpose") || "media");
  const logoUpload = purpose === "logo";
  if (!(file instanceof File) || !allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: "PNG, SVG, JPG, WebP veya video dosyası yükleyin." }, { status: 400 });
  }
  if (logoUpload && !logoTypes.has(file.type)) {
    return NextResponse.json({ error: "Logo için PNG, JPG, JPEG veya WEBP dosyası seçin." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > maxFileSize) {
    return NextResponse.json({ error: "Dosya boyutu 10 MB sınırını aşamaz." }, { status: 400 });
  }
  if (logoUpload && file.size > logoMaxFileSize) {
    return NextResponse.json({ error: "Logo dosyası 5 MB sınırını aşamaz." }, { status: 400 });
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  if (logoUpload && !hasValidLogoSignature(file.type, fileBuffer)) {
    return NextResponse.json({ error: "Dosya içeriği seçilen logo formatıyla eşleşmiyor." }, { status: 400 });
  }
  if (file.type === "image/svg+xml") {
    const svg = fileBuffer.toString("utf8");
    if (/<script|on\w+\s*=|javascript:|<foreignObject/i.test(svg)) {
      return NextResponse.json({ error: "SVG dosyası güvenli olmayan içerik barındırıyor." }, { status: 400 });
    }
  }

  const extension = logoUpload
    ? ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as Record<string, string>)[file.type] || "img"
    : file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "asset";
  const safeName = logoUpload
    ? `${crypto.randomUUID()}.${extension}`
    : `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const storedFile = new File([fileBuffer], safeName, { type: file.type });
  let url = `/uploads/${safeName}`;

  if (hasSupabaseConfig()) {
    url = await uploadToSupabaseStorage(storedFile, logoUpload ? "logos" : "media");
  } else if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Supabase Storage yapılandırılmadı. Canlı ortamda dosya yükleme çalışmaz." }, { status: 500 });
  } else {
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, safeName), fileBuffer);
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
