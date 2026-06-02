import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { recordActivity } from "@/lib/activity-log";
import { getSafeSupabaseError, hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { requireModuleAccess } from "@/lib/permissions";

const columnMap: Record<string, string> = {
  "campaign name": "campaignName",
  "kampanya adı": "campaignName",
  "ad set name": "adSetName",
  "reklam seti adı": "adSetName",
  "ad name": "adName",
  "reklam adı": "adName",
  "amount spent": "spent",
  "harcanan tutar": "spent",
  impressions: "impressions",
  "gösterimler": "impressions",
  reach: "reach",
  "erişim": "reach",
  "link clicks": "linkClicks",
  "bağlantı tıklamaları": "linkClicks",
  clicks: "clicks",
  "tıklamalar": "clicks",
  results: "results",
  "sonuçlar": "results",
  "messaging conversations started": "messages",
  "başlatılan mesajlaşmalar": "messages",
  leads: "leads",
  "potansiyel müşteriler": "leads",
  ctr: "ctr",
  cpc: "cpc",
  cpm: "cpm",
  date: "date",
  day: "date",
  "tarih": "date",
  "gün": "date"
};

function normalizeHeader(value: string) {
  return value.trim().toLocaleLowerCase("tr").replace(/\s+/g, " ");
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let cell = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if ((char === "," || char === ";") && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      if (row.some((item) => item.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((item) => item.trim())) rows.push(row);
  return rows;
}

function toNumber(value: unknown) {
  const normalized = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDate(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return new Date().toISOString().slice(0, 10);
  const direct = new Date(raw);
  if (!Number.isNaN(direct.getTime())) return direct.toISOString().slice(0, 10);
  const match = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!match) return new Date().toISOString().slice(0, 10);
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

function buildRecords(rows: string[][], companyId: string, campaignId: string) {
  const headers = rows[0] || [];
  const mapped = headers.map((header) => columnMap[normalizeHeader(header)] || "");
  const records = [];
  let skipped = 0;

  for (const row of rows.slice(1)) {
    const data: Record<string, string> = {};
    row.forEach((cell, index) => {
      if (mapped[index]) data[mapped[index]] = cell;
    });

    if (!Object.keys(data).length) {
      skipped += 1;
      continue;
    }

    const clicks = toNumber(data.clicks || data.linkClicks);
    const leads = toNumber(data.leads || data.results);
    const spent = toNumber(data.spent);
    records.push({
      campaign_id: campaignId,
      company_id: companyId,
      date: toDate(data.date),
      impressions: Math.round(toNumber(data.impressions)),
      reach: Math.round(toNumber(data.reach)),
      clicks: Math.round(clicks),
      messages: Math.round(toNumber(data.messages)),
      leads: Math.round(leads),
      conversions: 0,
      ctr: toNumber(data.ctr),
      cpc: toNumber(data.cpc),
      cpm: toNumber(data.cpm),
      cost_per_lead: leads > 0 ? Number((spent / leads).toFixed(2)) : 0,
      spent,
      visible_to_customer: true,
      notes: [data.campaignName, data.adSetName, data.adName].filter(Boolean).join(" / ") || "Meta rapor içe aktarımı"
    });
  }

  return { records, skipped };
}

export async function POST(request: Request) {
  const session = await requireModuleAccess("raporlar");
  if (!session) {
    return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  }

  if (!hasSupabaseConfig()) {
    return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  }

  try {
    const form = await request.formData();
    const companyId = String(form.get("companyId") || "");
    const campaignId = String(form.get("campaignId") || "");
    const file = form.get("file");

    if (!companyId || !campaignId) {
      return NextResponse.json({ error: "Zorunlu alan eksik", supabaseError: "Firma ve kampanya seçimi zorunludur." }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Zorunlu alan eksik", supabaseError: "CSV dosyası yüklenmelidir." }, { status: 400 });
    }

    if (file.name.toLocaleLowerCase("tr").endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "Beklenmeyen hata", supabaseError: "XLSX okuma için ek paket gerekir. Lütfen Meta raporunu CSV olarak dışa aktarın." },
        { status: 400 }
      );
    }

    const rows = parseCsv(await file.text());
    const { records, skipped } = buildRecords(rows, companyId, campaignId);
    if (!records.length) {
      return NextResponse.json({ error: "Zorunlu alan eksik", supabaseError: "İçe aktarılacak geçerli satır bulunamadı." }, { status: 400 });
    }

    let inserted;
    try {
      inserted = await supabaseRest<any[]>("campaign_metrics", {
        method: "POST",
        body: JSON.stringify(records)
      });
    } catch (error) {
      const safeError = getSafeSupabaseError(error);
      if (!safeError.detail.includes("messages") && !safeError.detail.includes("visible_to_customer")) throw error;
      const fallbackRecords = records.map(({ messages, visible_to_customer, ...record }) => record);
      inserted = await supabaseRest<any[]>("campaign_metrics", {
        method: "POST",
        body: JSON.stringify(fallbackRecords)
      });
    }

    await recordActivity({
      session,
      action: "İçe Aktarma",
      entity: "Meta Raporu",
      entityId: campaignId,
      companyId,
      details: { message: "Meta raporu içe aktarıldı", inserted: inserted.length, skipped, file_name: file.name }
    });

    return NextResponse.json({
      ok: true,
      inserted: inserted.length,
      skipped,
      preview: inserted.slice(0, 10),
      message: `${inserted.length} satır içe aktarıldı. ${skipped} satır atlandı.`
    });
  } catch (error) {
    const safeError = getSafeSupabaseError(error);
    console.error("Meta rapor içe aktarma Supabase hatası:", safeError.detail);
    return NextResponse.json({ error: safeError.title, supabaseError: safeError.detail }, { status: 500 });
  }
}
