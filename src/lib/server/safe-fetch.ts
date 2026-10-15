import "server-only";

import { lookup as dnsLookup } from "node:dns";
import http from "node:http";
import https from "node:https";
import type { LookupFunction } from "node:net";
import { isIP } from "node:net";
import { isPrivateAddress } from "@/lib/business-logos-shared";

// Outbound fetch for public business websites (logo discovery). Guards:
//  - http/https only, default ports only, no credentials in the URL;
//  - every DNS answer is checked AT CONNECT TIME (custom lookup), so a
//    hostname can't resolve to a public IP for a pre-check and a private
//    one for the real connection (DNS rebinding);
//  - redirects are followed manually (max 3) and each hop re-validated;
//  - hard timeout and response size cap; content-type allow-list.

export class SafeFetchError extends Error {}

const USER_AGENT = "HKDijitalLogoBot/1.0 (+https://hkdijital.com.tr)";

const guardedLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 0);
    const list = (Array.isArray(addresses) ? addresses : [addresses]) as Array<{ address: string; family: number }>;
    const blocked = list.find((a) => isPrivateAddress(a.address));
    if (!list.length || blocked) return callback(new SafeFetchError("Özel/iç ağ adresine erişim engellendi."), "", 0);
    if ((options as { all?: boolean }).all) return (callback as unknown as (e: null, a: typeof list) => void)(null, list);
    callback(null, list[0].address, list[0].family);
  });
};

export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new SafeFetchError("Geçersiz adres."); }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new SafeFetchError("Yalnızca http/https adresleri desteklenir.");
  if (url.username || url.password) throw new SafeFetchError("Kimlik bilgisi içeren adresler desteklenmez.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new SafeFetchError("Standart dışı port engellendi.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && isPrivateAddress(host)) throw new SafeFetchError("Özel/iç ağ adresine erişim engellendi.");
  if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) throw new SafeFetchError("Yerel adreslere erişim engellendi.");
  return url;
}

export type SafeResponse = { url: string; status: number; contentType: string; body: Buffer };

function requestOnce(url: URL, maxBytes: number, timeoutMs: number, accept: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const req = client.request(url, {
      method: "GET",
      lookup: guardedLookup,
      headers: { "User-Agent": USER_AGENT, Accept: accept, "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.6" },
      timeout: timeoutMs
    }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) { req.destroy(new SafeFetchError("Yanıt boyut sınırını aştı.")); return; }
        chunks.push(chunk);
      });
      res.on("end", () => resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new SafeFetchError("Bağlantı zaman aşımına uğradı.")));
    req.on("error", reject);
    req.end();
  });
}

export async function safeFetch(raw: string, opts: { maxBytes: number; timeoutMs?: number; accept?: string; allowedTypes?: RegExp }): Promise<SafeResponse> {
  let url = assertPublicHttpUrl(raw);
  for (let hop = 0; hop <= 3; hop += 1) {
    const res = await requestOnce(url, opts.maxBytes, opts.timeoutMs ?? 8000, opts.accept || "*/*");
    if (res.status >= 300 && res.status < 400 && res.headers.location) {
      url = assertPublicHttpUrl(new URL(res.headers.location, url).toString());
      continue;
    }
    const contentType = String(res.headers["content-type"] || "").toLowerCase();
    if (res.status >= 400) throw new SafeFetchError(`Sunucu ${res.status} yanıtı verdi.`);
    if (opts.allowedTypes && contentType && !opts.allowedTypes.test(contentType)) throw new SafeFetchError(`Beklenmeyen içerik türü: ${contentType}`);
    return { url: url.toString(), status: res.status, contentType, body: res.body };
  }
  throw new SafeFetchError("Çok fazla yönlendirme.");
}
