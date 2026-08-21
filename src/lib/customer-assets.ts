import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

export const CUSTOMER_ASSETS_BUCKET = "customer-assets";
export const CUSTOMER_ASSET_MAX_SIZE = 5 * 1024 * 1024;
export const CUSTOMER_DOCUMENT_MAX_SIZE = 15 * 1024 * 1024;
// Every type the "Yeni Belge" upload flow accepts, plus the ones the
// document-generation service itself produces (docx/pdf/pptx) — kept as
// one map (extension -> MIME) so the client accept="" list, the server
// validation set, and the Supabase Storage bucket's own allowed_mime_types
// (see supabase-storage-bucket-config.md) all stay derived from one place
// instead of three lists that can silently drift apart.
export const CUSTOMER_DOCUMENT_EXTENSION_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};
const CUSTOMER_DOCUMENT_MIME_TYPES = new Set(Object.values(CUSTOMER_DOCUMENT_EXTENSION_MIME));
// text/csv and text/plain are what browsers usually report, but some
// (notably Excel-exported CSVs on Windows) send generic
// application/vnd.ms-excel or application/octet-stream for .csv/.txt —
// validated against the file's own extension as a fallback below, not
// trusted on MIME alone either way.
const LOOSE_MIME_FALLBACKS = new Set(["application/octet-stream", "application/vnd.ms-excel"]);

export type CustomerAssetType =
  | "logo"
  | "logo_light"
  | "logo_dark"
  | "favicon"
  | "social_profile"
  | "social_cover"
  | "instagram_profile"
  | "facebook_cover"
  | "linkedin_cover"
  | "letterhead"
  | "business_card"
  | "brochure"
  | "proposal_document"
  | "brand_document";

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const DOCUMENT_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"]);

const DIRECT_FIELD_BY_ASSET: Partial<Record<CustomerAssetType, string>> = {
  logo: "logo_url",
  logo_light: "logo_light_url",
  logo_dark: "logo_dark_url",
  social_profile: "social_profile_image_url",
  letterhead: "letterhead_url"
};

const JSON_FIELD_BY_ASSET: Partial<Record<CustomerAssetType, string>> = {
  favicon: "favicon_url",
  social_cover: "social_cover_url",
  instagram_profile: "instagram_profile_image_url",
  facebook_cover: "facebook_cover_url",
  linkedin_cover: "linkedin_cover_url",
  business_card: "business_card_url",
  brochure: "brochure_url",
  proposal_document: "proposal_document_url",
  brand_document: "brand_document_url"
};

export function getCustomerAssetField(assetType: CustomerAssetType) {
  return DIRECT_FIELD_BY_ASSET[assetType] || null;
}

export function getCustomerAssetJsonKey(assetType: CustomerAssetType) {
  return JSON_FIELD_BY_ASSET[assetType] || null;
}

export function getCustomerAssetFolder(assetType: CustomerAssetType) {
  if (assetType === "logo" || assetType === "logo_light" || assetType === "logo_dark" || assetType === "favicon") return "logos";
  if (assetType.includes("social") || assetType.includes("instagram") || assetType.includes("facebook") || assetType.includes("linkedin")) return "social";
  if (assetType === "letterhead" || assetType === "business_card" || assetType === "brochure" || assetType === "proposal_document") return "documents";
  return "brand";
}

function extensionFor(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (fromName) return fromName === "jpeg" ? "jpg" : fromName;
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg" || file.type === "image/jpg") return "jpg";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/svg+xml") return "svg";
  if (file.type === "application/pdf") return "pdf";
  return "bin";
}

export async function validateCustomerAssetFile(file: File, assetType: CustomerAssetType) {
  if (!file || file.size <= 0) throw new Error("Dosya okunamadı.");
  if (file.size > CUSTOMER_ASSET_MAX_SIZE) throw new Error("Dosya boyutu 5 MB sınırını aşıyor.");

  const allowedTypes = assetType === "letterhead" || assetType === "business_card" || assetType === "brochure" || assetType === "proposal_document" || assetType === "brand_document"
    ? DOCUMENT_TYPES
    : IMAGE_TYPES;
  if (!allowedTypes.has(file.type)) throw new Error("Dosya formatı desteklenmiyor.");

  if (file.type.startsWith("image/")) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const isPng = file.type === "image/png" && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpeg = (file.type === "image/jpeg" || file.type === "image/jpg") && buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isWebp = file.type === "image/webp" && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
    if (!isPng && !isJpeg && !isWebp) throw new Error("Dosya içeriği seçilen görsel formatıyla eşleşmiyor.");
  }
}

function supabaseStorageHeaders(contentType?: string) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Supabase service role anahtarı eksik.");
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    ...(contentType ? { "Content-Type": contentType } : {}),
    "x-upsert": "true"
  };
}

function storageBaseUrl() {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("Supabase URL yapılandırılmadı.");
  return baseUrl;
}

function publicUrlFor(path: string) {
  return `${storageBaseUrl()}/storage/v1/object/public/${CUSTOMER_ASSETS_BUCKET}/${path}`;
}

export function storagePathFromPublicUrl(url: string) {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${CUSTOMER_ASSETS_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length).split("?")[0] || "");
}

export async function getCustomerBrandAssets(companyId: string) {
  const rows = await supabaseRest<any[]>(`customer_branding?company_id=eq.${encodeURIComponent(companyId)}&limit=1`);
  return rows[0] || null;
}

export async function updateCustomerBrandAssets(companyId: string, patch: Record<string, unknown>) {
  const rows = await supabaseRest<any[]>("customer_branding?on_conflict=company_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({ company_id: companyId, ...patch, updated_at: new Date().toISOString() })
  });
  if (!rows[0]) throw new Error("Marka varlığı kaydı güncellenemedi.");
  return rows[0];
}

export async function uploadCustomerAsset(companyId: string, assetType: CustomerAssetType, file: File, previousUrl?: string) {
  await validateCustomerAssetFile(file, assetType);
  const ext = extensionFor(file);
  const folder = getCustomerAssetFolder(assetType);
  const safeAssetType = assetType.replace(/[^a-z0-9_-]/gi, "-");
  const path = `customers/${companyId}/${folder}/${safeAssetType}-${crypto.randomUUID()}.${ext}`;
  const response = await fetch(`${storageBaseUrl()}/storage/v1/object/${CUSTOMER_ASSETS_BUCKET}/${path}`, {
    method: "POST",
    headers: supabaseStorageHeaders(file.type || "application/octet-stream"),
    body: Buffer.from(await file.arrayBuffer())
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Supabase Storage yükleme başarısız oldu.");
  }

  if (previousUrl) {
    await removeCustomerAssetFile(previousUrl).catch((error) => {
      console.error("Eski müşteri marka dosyası silinemedi:", getSafeSupabaseError(error).detail);
    });
  }

  const url = publicUrlFor(path);
  const existing = await getCustomerBrandAssets(companyId);
  const brandAssets = { ...(existing?.brand_assets || {}) };
  const field = getCustomerAssetField(assetType);
  const jsonKey = getCustomerAssetJsonKey(assetType);
  const patch: Record<string, unknown> = { brand_assets: brandAssets };
  if (field) patch[field] = url;
  if (jsonKey) brandAssets[jsonKey] = url;

  const branding = await updateCustomerBrandAssets(companyId, patch);
  return { url, path, branding };
}

export async function removeCustomerAssetFile(url: string) {
  const path = storagePathFromPublicUrl(url);
  if (!path) return { ok: false, skipped: true };
  const response = await fetch(`${storageBaseUrl()}/storage/v1/object/${CUSTOMER_ASSETS_BUCKET}`, {
    method: "DELETE",
    headers: {
      ...supabaseStorageHeaders("application/json")
    },
    body: JSON.stringify({ prefixes: [path] })
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Supabase Storage silme başarısız oldu.");
  }
  return { ok: true };
}

export async function removeCustomerAsset(companyId: string, assetType: CustomerAssetType, url?: string) {
  if (url) {
    await removeCustomerAssetFile(url).catch((error) => {
      console.error("Müşteri marka dosyası silinemedi:", getSafeSupabaseError(error).detail);
    });
  }
  const existing = await getCustomerBrandAssets(companyId);
  const brandAssets = { ...(existing?.brand_assets || {}) };
  const field = getCustomerAssetField(assetType);
  const jsonKey = getCustomerAssetJsonKey(assetType);
  const patch: Record<string, unknown> = { brand_assets: brandAssets };
  if (field) patch[field] = null;
  if (jsonKey) delete brandAssets[jsonKey];
  return updateCustomerBrandAssets(companyId, patch);
}

// Generic per-customer document upload — used by the Customer Profile
// "Dosyalar" tab. Reuses the same private Supabase Storage bucket, path
// convention, and service-role upload mechanism as the brand-asset uploader
// above, but is not tied to a fixed CustomerAssetType/customer_branding
// column — the resulting url/path is written onto a customer_files row
// instead (see src/app/api/admin/customers/[id]/files/upload/route.ts).
// Real executable signatures rejected regardless of claimed extension/MIME
// — Windows PE ("MZ"), Linux ELF, and macOS Mach-O (both byte orders,
// 32/64-bit fat binaries included).
function looksExecutable(buffer: Buffer) {
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) return true; // MZ
  if (buffer.length >= 4 && buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) return true; // \x7fELF
  const machoMagics = [0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe, 0xbebafeca];
  if (buffer.length >= 4) {
    const magic = buffer.readUInt32BE(0);
    if (machoMagics.includes(magic)) return true;
  }
  return false;
}

export async function validateCustomerDocumentFile(file: File) {
  if (!file || file.size <= 0) throw new Error("Dosya okunamadı.");
  if (file.size > CUSTOMER_DOCUMENT_MAX_SIZE) throw new Error(`Dosya boyutu ${CUSTOMER_DOCUMENT_MAX_SIZE / (1024 * 1024)} MB sınırını aşıyor.`);

  const extFromName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
  const expectedMimeForExt = CUSTOMER_DOCUMENT_EXTENSION_MIME[extFromName];
  const mimeIsKnownGood = CUSTOMER_DOCUMENT_MIME_TYPES.has(file.type);
  const mimeIsLooseButExtKnown = LOOSE_MIME_FALLBACKS.has(file.type) && Boolean(expectedMimeForExt);
  if (!expectedMimeForExt && !mimeIsKnownGood) {
    throw new Error("Dosya formatı desteklenmiyor. PDF, Word, Excel, PowerPoint, TXT, CSV veya görsel (PNG/JPEG/WEBP) yükleyin.");
  }
  if (!mimeIsKnownGood && !mimeIsLooseButExtKnown) {
    throw new Error("Dosya uzantısı ile dosya türü eşleşmiyor.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (looksExecutable(buffer)) throw new Error("Çalıştırılabilir dosyalar yüklenemez.");

  if (file.type.startsWith("image/") || (!file.type && ["png", "jpg", "jpeg", "webp"].includes(extFromName))) {
    const isPng = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isWebp = buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
    if (!isPng && !isJpeg && !isWebp) throw new Error("Dosya içeriği seçilen görsel formatıyla eşleşmiyor.");
  } else if (file.type === "application/pdf" || extFromName === "pdf") {
    if (buffer.subarray(0, 4).toString("ascii") !== "%PDF") throw new Error("Dosya içeriği geçerli bir PDF değil.");
  } else if (["docx", "xlsx", "pptx"].includes(extFromName)) {
    // OOXML formats are real ZIP archives — real magic bytes "PK\x03\x04".
    if (!(buffer[0] === 0x50 && buffer[1] === 0x4b)) throw new Error("Dosya içeriği geçerli bir Office belgesi değil.");
  }
}

export async function uploadCustomerDocument(companyId: string, file: File) {
  await validateCustomerDocumentFile(file);
  const fromName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  const ext = fromName || (file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg");
  const path = `customers/${companyId}/documents/${crypto.randomUUID()}.${ext}`;
  const response = await fetch(`${storageBaseUrl()}/storage/v1/object/${CUSTOMER_ASSETS_BUCKET}/${path}`, {
    method: "POST",
    headers: supabaseStorageHeaders(file.type || "application/octet-stream"),
    body: Buffer.from(await file.arrayBuffer())
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Supabase Storage yükleme başarısız oldu.");
  }
  return { url: publicUrlFor(path), path, mimeType: file.type, size: file.size, fileName: file.name };
}

// Server-side counterpart of uploadCustomerDocument for buffers this app
// generates itself (Word/PDF/PowerPoint exports) rather than a browser
// File upload — same bucket, same customers/{companyId}/documents/ path
// convention, no separate storage integration.
export async function uploadGeneratedDocument(companyId: string, buffer: Buffer, fileName: string, mimeType: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "bin";
  const path = `customers/${companyId}/documents/${crypto.randomUUID()}.${ext}`;
  const response = await fetch(`${storageBaseUrl()}/storage/v1/object/${CUSTOMER_ASSETS_BUCKET}/${path}`, {
    method: "POST",
    headers: supabaseStorageHeaders(mimeType),
    body: Buffer.from(buffer)
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || "Supabase Storage yükleme başarısız oldu.");
  }
  return { url: publicUrlFor(path), path, mimeType, size: buffer.length, fileName };
}
