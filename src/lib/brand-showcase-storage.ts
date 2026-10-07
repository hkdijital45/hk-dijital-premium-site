// Logo storage for "HK Dijital ile Çalışan Markalar", following the same
// direct-REST Supabase Storage pattern as src/lib/customer-assets.ts, scoped
// to its own public bucket (see supabase/migrations/20261007_brand_showcases.sql).
import { extensionForBrandLogo } from "@/lib/brand-showcase";

export const BRAND_SHOWCASE_BUCKET = "brand-showcases";

function storageBaseUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("Supabase URL yapılandırılmadı.");
  return baseUrl;
}

function storageHeaders(contentType?: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Supabase service role anahtarı eksik.");
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...(contentType ? { "Content-Type": contentType } : {}),
    "x-upsert": "true"
  };
}

function publicUrlFor(path: string) {
  return `${storageBaseUrl()}/storage/v1/object/public/${BRAND_SHOWCASE_BUCKET}/${path}`;
}

export function brandLogoPathFromUrl(url: string): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${BRAND_SHOWCASE_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length).split("?")[0] || "");
}

async function verifyImageBytes(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const isPng = file.type === "image/png" && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = (file.type === "image/jpeg" || file.type === "image/jpg") && buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isWebp = file.type === "image/webp" && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (!isPng && !isJpeg && !isWebp) throw new Error("Dosya içeriği seçilen görsel formatıyla eşleşmiyor.");
  return buffer;
}

export async function uploadBrandLogo(file: File, previousUrl?: string | null) {
  const ext = extensionForBrandLogo(file.type);
  if (!ext) throw new Error("Logo PNG, JPG veya WEBP formatında olmalı.");
  const buffer = await verifyImageBytes(file);
  const path = `logos/${crypto.randomUUID()}.${ext}`;
  const response = await fetch(`${storageBaseUrl()}/storage/v1/object/${BRAND_SHOWCASE_BUCKET}/${path}`, {
    method: "POST",
    headers: storageHeaders(file.type || "application/octet-stream"),
    body: buffer
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Logo yüklenemedi.");
  }
  if (previousUrl) {
    await removeBrandLogo(previousUrl).catch(() => {});
  }
  return publicUrlFor(path);
}

export async function removeBrandLogo(url: string) {
  const path = brandLogoPathFromUrl(url);
  if (!path) return;
  const response = await fetch(`${storageBaseUrl()}/storage/v1/object/${BRAND_SHOWCASE_BUCKET}`, {
    method: "DELETE",
    headers: storageHeaders("application/json"),
    body: JSON.stringify({ prefixes: [path] })
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Logo silinemedi.");
  }
}
