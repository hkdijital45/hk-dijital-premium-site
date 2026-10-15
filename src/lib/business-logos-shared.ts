// Company logo discovery & verification — pure helpers (no I/O), shared by
// the server store (business-logos.ts), API routes, UI and unit tests.
//
// What "automatic discovery" really means here: the server reads the
// business's OWN recorded website (the identity anchor already stored on
// the lead/customer/business record) and looks for the logo the site
// itself publishes. It does not run a web search, does not guess from a
// name, and never treats an Instagram/profile picture or a social banner
// as a verified logo. Claude (via MCP) may additionally SUBMIT a logo URL
// it found during its own research — that always lands as PENDING_REVIEW.

export const BUSINESS_LOGOS_TABLE = "business_logos";

export const LOGO_STATUSES = ["VERIFIED", "PENDING_REVIEW", "NOT_FOUND", "REJECTED"] as const;
export type LogoStatus = (typeof LOGO_STATUSES)[number];

export const LOGO_STATUS_LABELS: Record<LogoStatus, string> = {
  VERIFIED: "Doğrulandı",
  PENDING_REVIEW: "Onay Bekliyor",
  NOT_FOUND: "Bulunamadı",
  REJECTED: "Reddedildi"
};

export const LOGO_SOURCE_TYPES = ["manual_upload", "customer_branding", "website_structured_data", "website_header", "website_icon", "open_graph", "mcp_candidate"] as const;
export type LogoSourceType = (typeof LOGO_SOURCE_TYPES)[number];

export const LOGO_SOURCE_LABELS: Record<LogoSourceType, string> = {
  manual_upload: "Manuel yükleme",
  customer_branding: "Müşteri marka varlıkları",
  website_structured_data: "Resmi web sitesi (yapılandırılmış veri)",
  website_header: "Resmi web sitesi (site başlığı)",
  website_icon: "Resmi web sitesi (uygulama ikonu)",
  open_graph: "Resmi web sitesi (paylaşım görseli)",
  mcp_candidate: "Claude araştırması (öneri)"
};

export type LogoOwnerType = "lead" | "company" | "unit";
export type LogoOwner = { type: LogoOwnerType; id: string };

export type BusinessLogoRecord = {
  id: string;
  company_id: string | null;
  lead_id: string | null;
  business_unit_id: string | null;
  status: LogoStatus;
  source_type: LogoSourceType;
  source_url: string | null;
  source_website: string | null;
  storage_path: string | null;
  width: number | null;
  height: number | null;
  sha256: string | null;
  evidence: Record<string, unknown>;
  is_primary: boolean;
  discovered_at: string;
  verified_at: string | null;
  created_at: string;
};

export function ownerColumn(type: LogoOwnerType): "company_id" | "lead_id" | "business_unit_id" {
  return type === "company" ? "company_id" : type === "lead" ? "lead_id" : "business_unit_id";
}

// --- URL / domain helpers -------------------------------------------------

const MULTI_PART_TLDS = new Set(["com.tr", "org.tr", "net.tr", "gen.tr", "biz.tr", "info.tr", "web.tr", "av.tr", "dr.tr", "bel.tr", "edu.tr", "gov.tr", "k12.tr", "tv.tr", "co.uk", "org.uk", "com.au", "co.de"]);

export function normalizeWebsite(value: string | null | undefined): URL | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url;
  } catch {
    return null;
  }
}

/** "www.shop.example.com.tr" -> "example.com.tr" (approximation good enough for same-site checks). */
export function registrableDomain(hostname: string): string {
  const host = hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  const parts = host.split(".");
  if (parts.length <= 2) return host;
  const lastTwo = parts.slice(-2).join(".");
  if (MULTI_PART_TLDS.has(lastTwo)) return parts.slice(-3).join(".");
  return lastTwo;
}

export function sameSite(a: string, b: string): boolean {
  return registrableDomain(a) === registrableDomain(b);
}

// --- private network guard (SSRF) ----------------------------------------

/** True for any address a server-side fetch must never reach. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ip.match(/^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/i);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 192 && b === 0) return true;
    if (a === 198 && (b === 18 || b === 19)) return true;
    if (a >= 224) return true; // multicast/reserved
    return false;
  }
  const v6 = ip.toLowerCase();
  if (v6 === "::" || v6 === "::1") return true;
  if (/^f[cd][0-9a-f]{2}:/.test(v6)) return true; // unique local fc00::/7
  if (/^fe[89ab][0-9a-f]:/.test(v6)) return true; // link-local fe80::/10
  if (v6.startsWith("ff")) return true; // multicast
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  if (v6.startsWith("64:ff9b:")) return true; // NAT64 — could map to private v4
  return false;
}

// --- robots.txt -----------------------------------------------------------

/** Minimal robots.txt check for one path, honouring "User-agent: *" and our own agent token. */
export function robotsAllows(robotsTxt: string, path: string, agentToken = "hkdijitallogobot"): boolean {
  const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; path: string }> }> = [];
  let current: { agents: string[]; rules: Array<{ allow: boolean; path: string }> } | null = null;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const match = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const value = match[2].trim();
    if (key === "user-agent") {
      if (!current || current.rules.length) { current = { agents: [], rules: [] }; groups.push(current); }
      current.agents.push(value.toLowerCase());
    } else if ((key === "allow" || key === "disallow") && current) {
      current.rules.push({ allow: key === "allow", path: value });
    }
  }
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && agentToken.includes(a)));
  const applicable = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  let best: { allow: boolean; length: number } | null = null;
  for (const group of applicable) {
    for (const rule of group.rules) {
      if (!rule.path) continue; // "Disallow:" (empty) allows everything
      const prefix = rule.path.replace(/\*.*$/, "").replace(/\$$/, "");
      if (path.startsWith(prefix) && (!best || prefix.length > best.length || (prefix.length === best.length && rule.allow))) {
        best = { allow: rule.allow, length: prefix.length };
      }
    }
  }
  return best ? best.allow : true;
}

// --- HTML candidate extraction -------------------------------------------

export type LogoCandidate = {
  url: string;
  sourceType: Exclude<LogoSourceType, "manual_upload" | "customer_branding" | "mcp_candidate">;
  /** Organization name / url declared next to the logo in structured data, when present. */
  declaredName?: string;
  declaredUrl?: string;
  hint?: string;
};

function decodeEntities(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

function attr(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  if (!match) return null;
  return decodeEntities(match[2] ?? match[3] ?? match[4] ?? "");
}

function resolveUrl(raw: string | null | undefined, base: string): string | null {
  if (!raw || raw.startsWith("data:")) return null;
  try {
    const url = new URL(raw, base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const ORG_TYPE = /Organization|LocalBusiness|Corporation|Store|Restaurant|Cafe|Bakery|Hotel|School|EducationalOrganization|MedicalBusiness|Dentist|Clinic|Physician|HealthAndBeautyBusiness|BeautySalon|AutomotiveBusiness|ProfessionalService|LegalService|RealEstateAgent|SportsActivityLocation|FoodEstablishment|Brand/i;

function logoUrlFrom(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return logoUrlFrom(value[0]);
  if (value && typeof value === "object") {
    const v = value as Record<string, unknown>;
    return logoUrlFrom(v.url ?? v.contentUrl ?? v["@id"]);
  }
  return null;
}

function walkJsonLd(node: unknown, out: Array<{ logo: string; name?: string; url?: string }>, depth = 0) {
  if (depth > 6 || !node) return;
  if (Array.isArray(node)) { node.forEach((n) => walkJsonLd(n, out, depth + 1)); return; }
  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  const type = Array.isArray(obj["@type"]) ? (obj["@type"] as unknown[]).join(" ") : String(obj["@type"] || "");
  if (ORG_TYPE.test(type) && obj.logo) {
    const logo = logoUrlFrom(obj.logo);
    if (logo) out.push({ logo, name: typeof obj.name === "string" ? obj.name : undefined, url: typeof obj.url === "string" ? obj.url : undefined });
  }
  for (const key of ["@graph", "publisher", "brand", "parentOrganization", "author", "provider", "mainEntity", "itemListElement"]) {
    if (obj[key]) walkJsonLd(obj[key], out, depth + 1);
  }
}

/** Ordered, de-duplicated logo candidates from a page's HTML. */
export function extractLogoCandidates(html: string, pageUrl: string): LogoCandidate[] {
  const candidates: LogoCandidate[] = [];
  const seen = new Set<string>();
  const push = (candidate: LogoCandidate | null) => {
    if (!candidate || seen.has(candidate.url)) return;
    seen.add(candidate.url);
    candidates.push(candidate);
  };
  const doc = html.slice(0, 2_000_000);

  // 1. Organization / LocalBusiness structured data.
  for (const match of doc.matchAll(/<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const found: Array<{ logo: string; name?: string; url?: string }> = [];
      walkJsonLd(JSON.parse(match[1].trim()), found);
      for (const f of found) {
        const url = resolveUrl(f.logo, pageUrl);
        if (url) push({ url, sourceType: "website_structured_data", declaredName: f.name, declaredUrl: f.url });
      }
    } catch {
      // malformed JSON-LD block — ignore, other signals still apply
    }
  }

  // 2. <img> that is explicitly marked as the logo, preferring the site header.
  const headerHtml = doc.match(/<header[\s\S]*?<\/header>/i)?.[0] || "";
  const imgs = [...headerHtml.matchAll(/<img\b[^>]*>/gi), ...doc.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  for (const tag of imgs) {
    const marker = [attr(tag, "class"), attr(tag, "id"), attr(tag, "alt"), attr(tag, "src")].filter(Boolean).join(" ").toLowerCase();
    if (!/logo/.test(marker)) continue;
    const src = attr(tag, "src") || attr(tag, "data-src") || attr(tag, "data-lazy-src");
    push((() => { const url = resolveUrl(src, pageUrl); return url ? { url, sourceType: "website_header" as const, hint: attr(tag, "alt") || undefined } : null; })());
    if (candidates.filter((c) => c.sourceType === "website_header").length >= 2) break;
  }

  // 3. Apple touch icon (square brand mark the site itself publishes).
  for (const match of doc.matchAll(/<link\b[^>]*>/gi)) {
    const tag = match[0];
    const rel = (attr(tag, "rel") || "").toLowerCase();
    if (!rel.includes("apple-touch-icon")) continue;
    const url = resolveUrl(attr(tag, "href"), pageUrl);
    if (url) push({ url, sourceType: "website_icon" });
  }

  // 4. Open Graph image — frequently a banner/photo, so lowest priority and never auto-verified.
  for (const match of doc.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const prop = (attr(tag, "property") || attr(tag, "name") || "").toLowerCase();
    if (prop !== "og:image" && prop !== "og:logo") continue;
    const url = resolveUrl(attr(tag, "content"), pageUrl);
    if (url) push({ url, sourceType: "open_graph" });
  }

  return candidates;
}

// --- verification decision -------------------------------------------------

export function normalizeName(value: string): string[] {
  return value
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !["ltd", "sti", "as", "a", "san", "tic", "ve", "and", "the", "limited", "sirketi", "anonim", "gida", "ticaret", "sanayi"].includes(t));
}

export function namesMatch(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const ta = normalizeName(a);
  const tb = new Set(normalizeName(b));
  if (!ta.length || !tb.size) return false;
  const overlap = ta.filter((t) => tb.has(t)).length;
  return overlap / Math.min(ta.length, tb.size) >= 0.5;
}

export type LogoDecisionInput = {
  candidate: LogoCandidate;
  businessName: string;
  /** Host of the business's recorded website. */
  recordedHost: string;
  /** Host the homepage actually resolved to after redirects. */
  finalHost: string;
  /** Host the logo image was served from. */
  imageHost: string;
  width: number;
  height: number;
};

/** VERIFIED only for structured-data logos on the business's own recorded
 * website whose declared organisation matches the business (by name or
 * declared URL), with the image served from that same site. Everything
 * else is a plausible candidate that a person must approve. */
export function decideLogoStatus(input: LogoDecisionInput): { status: "VERIFIED" | "PENDING_REVIEW"; reasons: string[] } {
  const reasons: string[] = [];
  const onRecordedSite = sameSite(input.finalHost, input.recordedHost);
  if (!onRecordedSite) reasons.push("Site, kayıtlı web sitesinden farklı bir alan adına yönlendirdi.");
  const imageSameSite = sameSite(input.imageHost, input.recordedHost);
  if (!imageSameSite) reasons.push("Logo görseli başka bir alan adından sunuluyor.");
  const declaredUrlMatches = (() => {
    const url = normalizeWebsite(input.candidate.declaredUrl);
    return url ? sameSite(url.hostname, input.recordedHost) : false;
  })();
  const nameOk = namesMatch(input.candidate.declaredName, input.businessName);
  if (input.candidate.sourceType !== "website_structured_data") reasons.push("Yapılandırılmış veri (Organization logosu) değil; görsel bir kişi tarafından onaylanmalı.");
  else if (!nameOk && !declaredUrlMatches) reasons.push("Yapılandırılmış verideki işletme adı/adresi kayıtla eşleşmedi.");
  const ratio = input.width / input.height;
  if (input.candidate.sourceType === "open_graph" || ratio > 4.5) reasons.push("Görsel bir paylaşım/banner görseli olabilir.");
  const verified = input.candidate.sourceType === "website_structured_data" && onRecordedSite && imageSameSite && (nameOk || declaredUrlMatches) && ratio <= 6;
  return { status: verified ? "VERIFIED" : "PENDING_REVIEW", reasons: verified ? ["Resmi web sitesinin Organization yapılandırılmış verisindeki logo; işletme kimliği eşleşti."] : reasons };
}
