import { getSafeSupabaseError, supabaseRest } from "@/lib/supabase";

export const CUSTOMER_ASSETS_BUCKET = "customer-assets";
export const CUSTOMER_ASSET_MAX_SIZE = 5 * 1024 * 1024;

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

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"]);
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

  if (file.type === "image/svg+xml") {
    const svg = await file.text();
    const unsafeSvg = /<script|onload=|onerror=|javascript:/i.test(svg);
    if (unsafeSvg) throw new Error("SVG dosyasında güvenli olmayan içerik algılandı.");
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
  const path = `customers/${companyId}/${folder}/${safeAssetType}-${Date.now()}.${ext}`;
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
