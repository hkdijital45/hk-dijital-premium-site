import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getSiteContent, saveSiteContent } from "@/lib/content";
import { isAdminAuthenticated } from "@/lib/auth";

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

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.name.split(".").pop() || "asset";
  const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, safeName), buffer);

  const content = await getSiteContent();
  const media = {
    id: safeName,
    url: `/uploads/${safeName}`,
    type: file.type === "application/pdf" ? ("pdf" as const) : file.type.startsWith("video") ? ("video" as const) : ("image" as const),
    name: file.name || `media.${extension}`
  };
  content.media.unshift(media);
  await saveSiteContent(content);

  return NextResponse.json({ ok: true, media });
}
