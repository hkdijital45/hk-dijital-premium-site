import { promises as fs } from "fs";
import path from "path";
import type { SiteContent } from "./types";

const contentPath = path.join(process.cwd(), "src", "data", "site-content.json");

export async function getSiteContent(): Promise<SiteContent> {
  const data = await fs.readFile(contentPath, "utf8");
  return JSON.parse(data) as SiteContent;
}

export async function saveSiteContent(content: SiteContent) {
  await fs.writeFile(contentPath, `${JSON.stringify(content, null, 2)}\n`, "utf8");
  return content;
}

export function getPackageById(content: SiteContent, id: string) {
  return content.packages.find((item) => item.id === id) ?? content.packages[0];
}

export const disclaimerText =
  "Satış garantisi verilmez. Reklam bütçesi hizmet bedeline dahil değildir. Fiyatlara KDV dahil değildir. Sonuçlar sektör, bütçe, hedef kitle, teklif ve rekabet durumuna göre değişebilir.";
