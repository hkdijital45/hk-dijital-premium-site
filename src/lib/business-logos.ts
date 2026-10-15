import "server-only";

import { supabaseRest } from "@/lib/supabase";
import { CUSTOMER_ASSETS_BUCKET } from "@/lib/customer-assets";
import { LogoImageError, normalizeLogoImage, pngDimensions, type NormalizedLogo } from "@/lib/server/logo-image";
import { SafeFetchError, assertPublicHttpUrl, safeFetch } from "@/lib/server/safe-fetch";
import {
  BUSINESS_LOGOS_TABLE, LOGO_SOURCE_LABELS, LOGO_STATUS_LABELS, decideLogoStatus, extractLogoCandidates, normalizeWebsite, ownerColumn, robotsAllows,
  type BusinessLogoRecord, type LogoOwner, type LogoSourceType, type LogoStatus
} from "@/lib/business-logos-shared";
import type { DocumentLogo } from "@/lib/document-model";

// Company logo store. Storage: the existing `customer-assets` bucket (same
// one customer brand logos already use), under business-logos/<type>/<id>/.
// Every stored file is a normalized PNG produced by logo-image.ts.
//
// Safety rules enforced here, not in the UI:
//  - a VERIFIED primary logo is never replaced by discovery or by an MCP
//    candidate — new finds land as PENDING_REVIEW next to it;
//  - only an explicit admin action (manual upload or "Onayla") changes the
//    primary logo;
//  - PDFs only ever use a VERIFIED primary logo (resolveReportClientLogo).

export class BusinessLogoError extends Error {}

const enc = encodeURIComponent;

type Identity = { name: string; website: string | null; companyId: string | null };

async function loadIdentity(owner: LogoOwner): Promise<Identity> {
  if (owner.type === "lead") {
    const [row] = await supabaseRest<Array<{ company: string | null; name: string | null; website: string | null; company_id: string | null }>>(`leads?select=company,name,website,company_id&id=eq.${enc(owner.id)}&deleted_at=is.null&limit=1`);
    if (!row) throw new BusinessLogoError("Lead bulunamadı.");
    return { name: row.company || row.name || "", website: row.website, companyId: row.company_id };
  }
  if (owner.type === "company") {
    const [row] = await supabaseRest<Array<{ name: string | null; website: string | null }>>(`companies?select=name,website&id=eq.${enc(owner.id)}&limit=1`);
    if (!row) throw new BusinessLogoError("Müşteri bulunamadı.");
    return { name: row.name || "", website: row.website, companyId: owner.id };
  }
  const [row] = await supabaseRest<Array<{ name: string; website: string | null }>>(`business_units?select=name,website&id=eq.${enc(owner.id)}&archived_at=is.null&limit=1`);
  if (!row) throw new BusinessLogoError("İşletme bulunamadı.");
  return { name: row.name, website: row.website, companyId: null };
}

function storageConfig() {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) throw new BusinessLogoError("Supabase Storage yapılandırılmadı.");
  return { baseUrl, key };
}

export function publicLogoUrl(path: string | null): string | null {
  if (!path) return null;
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  return baseUrl ? `${baseUrl}/storage/v1/object/public/${CUSTOMER_ASSETS_BUCKET}/${path}` : null;
}

async function uploadLogoFile(owner: LogoOwner, logo: NormalizedLogo): Promise<string> {
  const { baseUrl, key } = storageConfig();
  const path = `business-logos/${owner.type}/${owner.id}/${logo.sha256}.png`;
  const res = await fetch(`${baseUrl}/storage/v1/object/${CUSTOMER_ASSETS_BUCKET}/${path}`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "image/png", "x-upsert": "true" },
    body: logo.png as unknown as BodyInit
  });
  if (!res.ok) throw new BusinessLogoError("Logo depolama alanına yüklenemedi.");
  return path;
}

/** Downloads a stored file by its bucket path (service role) — never an arbitrary URL. */
async function downloadStoredFile(path: string): Promise<Buffer | null> {
  const { baseUrl, key } = storageConfig();
  const res = await fetch(`${baseUrl}/storage/v1/object/${CUSTOMER_ASSETS_BUCKET}/${path.split("/").map(enc).join("/")}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) return null;
  const bytes = Buffer.from(await res.arrayBuffer());
  return bytes.length ? bytes : null;
}

export async function listLogos(owner: LogoOwner): Promise<BusinessLogoRecord[]> {
  return supabaseRest<BusinessLogoRecord[]>(`${BUSINESS_LOGOS_TABLE}?select=*&${ownerColumn(owner.type)}=eq.${enc(owner.id)}&order=created_at.desc&limit=30`);
}

async function getLogo(id: string): Promise<BusinessLogoRecord> {
  const [row] = await supabaseRest<BusinessLogoRecord[]>(`${BUSINESS_LOGOS_TABLE}?select=*&id=eq.${enc(id)}&limit=1`);
  if (!row) throw new BusinessLogoError("Logo kaydı bulunamadı.");
  return row;
}

function ownerOf(row: BusinessLogoRecord): LogoOwner {
  if (row.company_id) return { type: "company", id: row.company_id };
  if (row.lead_id) return { type: "lead", id: row.lead_id };
  return { type: "unit", id: row.business_unit_id as string };
}

async function clearPrimary(owner: LogoOwner) {
  await supabaseRest(`${BUSINESS_LOGOS_TABLE}?${ownerColumn(owner.type)}=eq.${enc(owner.id)}&is_primary=eq.true`, { method: "PATCH", body: JSON.stringify({ is_primary: false }) });
}

async function insertLogo(owner: LogoOwner, row: Partial<BusinessLogoRecord> & { status: LogoStatus; source_type: LogoSourceType }, createdBy: string | null): Promise<BusinessLogoRecord> {
  const [saved] = await supabaseRest<BusinessLogoRecord[]>(BUSINESS_LOGOS_TABLE, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ [ownerColumn(owner.type)]: owner.id, created_by: createdBy, ...row })
  });
  return saved;
}

export type LogoStatusSummary = {
  status: LogoStatus | "NONE";
  label: string;
  primary: (BusinessLogoRecord & { publicUrl: string | null; sourceLabel: string }) | null;
  candidates: Array<BusinessLogoRecord & { publicUrl: string | null; sourceLabel: string }>;
  legacyBrandingLogoUrl: string | null;
  website: string | null;
};

export async function getLogoStatus(owner: LogoOwner): Promise<LogoStatusSummary> {
  const identity = await loadIdentity(owner);
  const rows = await listLogos(owner);
  const decorate = (r: BusinessLogoRecord) => ({ ...r, publicUrl: publicLogoUrl(r.storage_path), sourceLabel: LOGO_SOURCE_LABELS[r.source_type] || r.source_type });
  const primary = rows.find((r) => r.is_primary && r.status === "VERIFIED") || null;
  let legacy: string | null = null;
  if (owner.type === "company") {
    const [branding] = await supabaseRest<Array<{ logo_light_url: string | null; logo_url: string | null }>>(`customer_branding?select=logo_light_url,logo_url&company_id=eq.${enc(owner.id)}&limit=1`).catch(() => []);
    legacy = branding?.logo_light_url || branding?.logo_url || null;
  }
  const pending = rows.filter((r) => r.status === "PENDING_REVIEW");
  const status: LogoStatusSummary["status"] = primary || legacy ? "VERIFIED" : pending.length ? "PENDING_REVIEW" : rows.some((r) => r.status === "NOT_FOUND") ? "NOT_FOUND" : "NONE";
  return {
    status,
    label: status === "NONE" ? "Logo yok" : LOGO_STATUS_LABELS[status],
    primary: primary ? decorate(primary) : null,
    candidates: rows.filter((r) => r.status === "PENDING_REVIEW" || r.status === "REJECTED").map(decorate),
    legacyBrandingLogoUrl: legacy,
    website: identity.website
  };
}

/** Manual upload by an authorized admin = explicit, verified replacement. */
export async function uploadManualLogo(owner: LogoOwner, bytes: Buffer, createdBy: string | null): Promise<BusinessLogoRecord> {
  await loadIdentity(owner);
  const logo = await normalizeLogoImage(bytes);
  const path = await uploadLogoFile(owner, logo);
  await clearPrimary(owner);
  return insertLogo(owner, {
    status: "VERIFIED", source_type: "manual_upload", storage_path: path, width: logo.width, height: logo.height, sha256: logo.sha256,
    is_primary: true, verified_at: new Date().toISOString(), verified_by: createdBy, evidence: { uploadedMime: logo.sourceMime }
  } as Partial<BusinessLogoRecord> & { status: LogoStatus; source_type: LogoSourceType; verified_by: string | null }, createdBy);
}

async function storeCandidate(owner: LogoOwner, logo: NormalizedLogo, meta: { status: LogoStatus; sourceType: LogoSourceType; sourceUrl: string; sourceWebsite: string | null; evidence: Record<string, unknown> }, createdBy: string | null) {
  const existing = await listLogos(owner);
  const duplicate = existing.find((r) => r.sha256 === logo.sha256);
  if (duplicate) return { record: duplicate, duplicate: true };
  const hasVerifiedPrimary = existing.some((r) => r.is_primary && r.status === "VERIFIED");
  // Never displace an approved logo automatically: downgrade to review.
  const status: LogoStatus = meta.status === "VERIFIED" && hasVerifiedPrimary ? "PENDING_REVIEW" : meta.status;
  const path = await uploadLogoFile(owner, logo);
  const record = await insertLogo(owner, {
    status, source_type: meta.sourceType, source_url: meta.sourceUrl, source_website: meta.sourceWebsite, storage_path: path,
    width: logo.width, height: logo.height, sha256: logo.sha256, is_primary: status === "VERIFIED",
    verified_at: status === "VERIFIED" ? new Date().toISOString() : null,
    evidence: { ...meta.evidence, ...(meta.status === "VERIFIED" && status !== "VERIFIED" ? { note: "Mevcut onaylı logo korunduğu için onaya bırakıldı." } : {}) }
  } as Partial<BusinessLogoRecord> & { status: LogoStatus; source_type: LogoSourceType }, createdBy);
  return { record, duplicate: false };
}

async function recordNotFound(owner: LogoOwner, website: string | null, reasons: string[], createdBy: string | null) {
  const existing = await listLogos(owner);
  const prior = existing.find((r) => r.status === "NOT_FOUND");
  const evidence = { reasons, checkedAt: new Date().toISOString() };
  if (prior) {
    await supabaseRest(`${BUSINESS_LOGOS_TABLE}?id=eq.${prior.id}`, { method: "PATCH", body: JSON.stringify({ evidence, source_website: website, discovered_at: new Date().toISOString() }) });
    return;
  }
  await insertLogo(owner, { status: "NOT_FOUND", source_type: "website_structured_data", source_website: website, evidence } as Partial<BusinessLogoRecord> & { status: LogoStatus; source_type: LogoSourceType }, createdBy);
}

export type DiscoveryResult = { status: LogoStatus; message: string; logoId?: string; reasons: string[] };

/** Reads the business's own recorded website and stores the best logo it publishes. */
export async function discoverLogoFromWebsite(owner: LogoOwner, createdBy: string | null): Promise<DiscoveryResult> {
  const identity = await loadIdentity(owner);
  const site = normalizeWebsite(identity.website);
  if (!site) {
    await recordNotFound(owner, null, ["Kayıtlı web sitesi yok — otomatik arama yalnızca işletmenin resmi web sitesinden yapılır."], createdBy);
    return { status: "NOT_FOUND", message: "Kayıtlı web sitesi olmadığı için logo aranamadı. Logoyu manuel yükleyebilirsiniz.", reasons: [] };
  }
  const reasons: string[] = [];
  try {
    assertPublicHttpUrl(site.toString());
    const robots = await safeFetch(new URL("/robots.txt", site).toString(), { maxBytes: 200_000, timeoutMs: 5000, allowedTypes: /text\/plain|text\/html|application\/octet-stream/ }).catch(() => null);
    const robotsText = robots && robots.status < 300 && robots.contentType.includes("text/plain") ? robots.body.toString("utf8") : "";
    if (robotsText && !robotsAllows(robotsText, site.pathname || "/")) {
      await recordNotFound(owner, site.toString(), ["Web sitesinin robots.txt kuralları otomatik erişime izin vermiyor."], createdBy);
      return { status: "NOT_FOUND", message: "Web sitesi otomatik erişime izin vermiyor (robots.txt). Logoyu manuel yükleyin.", reasons: [] };
    }
    const page = await safeFetch(site.toString(), { maxBytes: 2_500_000, accept: "text/html,application/xhtml+xml", allowedTypes: /text\/html|application\/xhtml\+xml/ });
    const finalUrl = new URL(page.url);
    const candidates = extractLogoCandidates(page.body.toString("utf8"), page.url);
    if (!candidates.length) reasons.push("Sayfada logo olarak işaretlenmiş görsel bulunamadı.");
    for (const candidate of candidates.slice(0, 5)) {
      if (/\.svg(\?|$)/i.test(candidate.url)) { reasons.push("SVG logo bulundu; PDF için PNG/JPEG/WebP gerekli."); continue; }
      const imageUrl = new URL(candidate.url);
      if (robotsText && !robotsAllows(robotsText, imageUrl.pathname) && imageUrl.hostname === finalUrl.hostname) { reasons.push("Logo dosyasına robots.txt erişim izni vermiyor."); continue; }
      let image;
      try {
        image = await safeFetch(candidate.url, { maxBytes: 5_000_000, accept: "image/png,image/jpeg,image/webp,image/*;q=0.8", allowedTypes: /image\/(png|jpe?g|webp)|application\/octet-stream/ });
      } catch (error) { reasons.push(error instanceof Error ? error.message : "Görsel indirilemedi."); continue; }
      let logo: NormalizedLogo;
      try { logo = await normalizeLogoImage(image.body); } catch (error) { reasons.push(error instanceof Error ? error.message : "Görsel doğrulanamadı."); continue; }
      if (Math.max(logo.width, logo.height) < 64) { reasons.push("Bulunan görsel logo için çok küçük."); continue; }
      const decision = decideLogoStatus({ candidate, businessName: identity.name, recordedHost: site.hostname, finalHost: finalUrl.hostname, imageHost: new URL(image.url).hostname, width: logo.width, height: logo.height });
      if (candidate.sourceType === "open_graph" && logo.width / logo.height > 2.2) { reasons.push("Paylaşım görseli bir banner olduğu için logo sayılmadı."); continue; }
      const { record, duplicate } = await storeCandidate(owner, logo, {
        status: decision.status, sourceType: candidate.sourceType, sourceUrl: image.url, sourceWebsite: page.url,
        evidence: { reasons: decision.reasons, declaredName: candidate.declaredName || null, declaredUrl: candidate.declaredUrl || null, pageUrl: page.url, checkedAt: new Date().toISOString() }
      }, createdBy);
      return {
        status: record.status, logoId: record.id, reasons: decision.reasons,
        message: duplicate ? "Bu logo zaten kayıtlı." : record.status === "VERIFIED" ? "Resmi web sitesinden logo bulundu ve doğrulandı." : "Olası bir logo bulundu; raporlarda kullanılmadan önce onaylanmalı."
      };
    }
  } catch (error) {
    reasons.push(error instanceof SafeFetchError || error instanceof LogoImageError ? error.message : "Web sitesine erişilemedi.");
  }
  await recordNotFound(owner, site.toString(), reasons, createdBy);
  return { status: "NOT_FOUND", message: "Web sitesinde güvenilir bir logo bulunamadı. Logoyu manuel yükleyebilirsiniz.", reasons };
}

/** A logo URL found by Claude's own research (MCP) — always PENDING_REVIEW. */
export async function submitLogoCandidateFromUrl(owner: LogoOwner, logoUrl: string, sourcePageUrl: string | null, createdBy: string | null): Promise<DiscoveryResult> {
  const identity = await loadIdentity(owner);
  if (/\.svg(\?|$)/i.test(logoUrl)) throw new BusinessLogoError("SVG logolar desteklenmiyor; PNG/JPEG/WebP adresi verin.");
  const image = await safeFetch(logoUrl, { maxBytes: 5_000_000, accept: "image/png,image/jpeg,image/webp", allowedTypes: /image\/(png|jpe?g|webp)|application\/octet-stream/ });
  const logo = await normalizeLogoImage(image.body);
  const { record, duplicate } = await storeCandidate(owner, logo, {
    status: "PENDING_REVIEW", sourceType: "mcp_candidate", sourceUrl: image.url, sourceWebsite: sourcePageUrl || identity.website || null,
    evidence: { submittedBy: "Claude (MCP)", sourcePageUrl, recordedWebsite: identity.website, checkedAt: new Date().toISOString() }
  }, createdBy);
  return { status: record.status, logoId: record.id, reasons: [], message: duplicate ? "Bu logo zaten kayıtlı." : "Logo adayı kaydedildi; HK Admin'de onaylanana kadar raporlarda kullanılmaz." };
}

export async function approveLogo(id: string, userId: string | null): Promise<BusinessLogoRecord> {
  const row = await getLogo(id);
  if (!row.storage_path) throw new BusinessLogoError("Bu kayıtta onaylanacak bir görsel yok.");
  if (row.status !== "PENDING_REVIEW" && row.status !== "REJECTED") throw new BusinessLogoError("Yalnızca onay bekleyen logolar onaylanabilir.");
  await clearPrimary(ownerOf(row));
  const [saved] = await supabaseRest<BusinessLogoRecord[]>(`${BUSINESS_LOGOS_TABLE}?id=eq.${enc(id)}`, {
    method: "PATCH", headers: { Prefer: "return=representation" },
    body: JSON.stringify({ status: "VERIFIED", is_primary: true, verified_by: userId, verified_at: new Date().toISOString() })
  });
  return saved;
}

export async function rejectLogo(id: string): Promise<BusinessLogoRecord> {
  const row = await getLogo(id);
  const [saved] = await supabaseRest<BusinessLogoRecord[]>(`${BUSINESS_LOGOS_TABLE}?id=eq.${enc(row.id)}`, {
    method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "REJECTED", is_primary: false })
  });
  return saved;
}

// --- report resolution ----------------------------------------------------

async function verifiedLogoBytes(owner: LogoOwner): Promise<Buffer | null> {
  const [row] = await supabaseRest<BusinessLogoRecord[]>(`${BUSINESS_LOGOS_TABLE}?select=storage_path&${ownerColumn(owner.type)}=eq.${enc(owner.id)}&is_primary=eq.true&status=eq.VERIFIED&limit=1`).catch(() => []);
  return row?.storage_path ? downloadStoredFile(row.storage_path) : null;
}

async function brandingLogoBytes(companyId: string): Promise<Buffer | null> {
  const [branding] = await supabaseRest<Array<{ logo_light_url: string | null; logo_url: string | null }>>(`customer_branding?select=logo_light_url,logo_url&company_id=eq.${enc(companyId)}&limit=1`).catch(() => []);
  const url = branding?.logo_light_url || branding?.logo_url;
  const marker = `/storage/v1/object/public/${CUSTOMER_ASSETS_BUCKET}/`;
  if (!url || !url.includes(marker)) return null; // only our own storage, never an arbitrary URL
  return downloadStoredFile(decodeURIComponent(url.slice(url.indexOf(marker) + marker.length).split("?")[0]));
}

/** The client logo a PDF may show: VERIFIED only, most specific owner first
 * (business unit -> lead -> customer, including the customer's existing
 * manually uploaded brand logo). Any failure -> null: a missing logo must
 * never block or break report generation. */
export async function resolveReportClientLogo(scope: { companyId?: string | null; leadId?: string | null; businessUnitId?: string | null }): Promise<DocumentLogo | null> {
  try {
    // `normalized`: files under business-logos/ were already re-encoded by
    // normalizeLogoImage; legacy brand uploads (any PNG/JPEG/WebP) are
    // normalized now so pdf-lib can always embed them.
    const attempts: Array<{ load: () => Promise<Buffer | null>; normalized: boolean }> = [];
    if (scope.businessUnitId) attempts.push({ load: () => verifiedLogoBytes({ type: "unit", id: scope.businessUnitId as string }), normalized: true });
    else {
      if (scope.leadId) attempts.push({ load: () => verifiedLogoBytes({ type: "lead", id: scope.leadId as string }), normalized: true });
      if (scope.companyId) {
        attempts.push({ load: () => verifiedLogoBytes({ type: "company", id: scope.companyId as string }), normalized: true });
        attempts.push({ load: () => brandingLogoBytes(scope.companyId as string), normalized: false });
      }
    }
    for (const attempt of attempts) {
      const bytes = await attempt.load().catch(() => null);
      if (!bytes) continue;
      const dims = attempt.normalized ? pngDimensions(bytes) : null;
      if (dims) return { png: new Uint8Array(bytes), width: dims.width, height: dims.height };
      const normalized = await normalizeLogoImage(bytes).catch(() => null);
      if (normalized) return { png: new Uint8Array(normalized.png), width: normalized.width, height: normalized.height };
    }
  } catch {
    // fall through — HK Dijital logo alone
  }
  return null;
}
