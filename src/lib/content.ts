import { promises as fs } from "fs";
import path from "path";
import type { SiteContent } from "./types";
import { hasSupabaseConfig, supabaseRest } from "./supabase";

const contentPath = path.join(process.cwd(), "src", "data", "site-content.json");
const siteContentKey = "site_content";

export async function getSeedContent(): Promise<SiteContent> {
  const data = await fs.readFile(contentPath, "utf8");
  return JSON.parse(data) as SiteContent;
}

export async function getSiteContent(): Promise<SiteContent> {
  const seed = await getSeedContent();
  if (!hasSupabaseConfig()) return seed;

  try {
    const rows = await supabaseRest<Array<{ value: SiteContent }>>(
      `site_settings?key=eq.${siteContentKey}&select=value&limit=1`
    );
    return rows[0]?.value ? { ...seed, ...rows[0].value } : seed;
  } catch {
    return seed;
  }
}

export async function saveSiteContent(content: SiteContent) {
  if (hasSupabaseConfig()) {
    await supabaseRest("site_settings?key=eq.site_content", {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ value: content, updated_at: new Date().toISOString() })
    }).catch(async () => {
      await supabaseRest("site_settings", {
        method: "POST",
        body: JSON.stringify({ key: siteContentKey, value: content })
      });
    });
    return content;
  }

  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    throw new Error("Supabase bağlantısı yapılandırılmadı. Canlı ortamda kaydetme çalışmaz.");
  }

  await fs.writeFile(contentPath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  return content;
}

export function getPackageById(content: SiteContent, id: string) {
  return content.packages.find((item) => item.id === id) ?? content.packages[0];
}

export const disclaimerText =
  "Satış garantisi verilmez. Reklam bütçesi hizmet bedeline dahil değildir. Fiyatlara KDV dahil değildir. Sonuçlar sektör, bütçe, hedef kitle, teklif ve rekabet durumuna göre değişebilir.";
