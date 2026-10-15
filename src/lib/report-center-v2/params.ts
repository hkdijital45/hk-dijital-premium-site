// Request-parameter parsing shared by the Rapor Merkezi V2 routes.
import type { ReportVariant } from "./catalog";
import type { ReportOwner } from "./server";

export function ownerFromParams(params: URLSearchParams): ReportOwner {
  const type = params.get("ownerType") === "lead" ? "lead" : params.get("ownerType") === "company" ? "company" : ("" as ReportOwner["type"]);
  return { type, id: params.get("ownerId") || "" };
}

export function variantFromParams(params: URLSearchParams, available: ReportVariant[]): ReportVariant {
  const requested = params.get("variant");
  if (requested === "internal" || requested === "client") {
    if (available.includes(requested)) return requested;
  }
  return available[0] || "client";
}

/** RFC 6266 header with an ASCII fallback and the UTF-8 name. */
export function contentDisposition(inline: boolean, fileName: string): string {
  const ascii = fileName.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
