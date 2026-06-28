import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";

const safeCompanyFields = ["id", "name", "sector", "city", "website", "instagram", "phone", "email", "status", "notes"];
const blockedKeyPattern = /(password|secret|token|api[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|smtp[_-]?pass|hash)/i;

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = (lines.shift() || "").split(",").map((item) => item.trim().replace(/^"|"$/g, ""));
  return lines.map((line) => {
    const values = line.match(/("([^"]|"")*"|[^,]+)/g)?.map((value) => value.trim().replace(/^"|"$/g, "").replace(/""/g, '"')) || [];
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function normalizeCompany(row: Record<string, unknown>, conflictBehavior: string) {
  const source: Record<string, unknown> = {
    id: row.id,
    name: row.name || row.company_name || row.companyName,
    sector: row.sector,
    city: row.city,
    website: row.website,
    instagram: row.instagram,
    phone: row.phone,
    email: row.email,
    status: row.status || "Aktif",
    notes: row.notes,
    updated_at: new Date().toISOString()
  };
  if (conflictBehavior === "new") delete source.id;
  return Object.fromEntries(Object.entries(source).filter(([key]) => safeCompanyFields.includes(key) || key === "updated_at").filter(([, value]) => value !== undefined));
}

function extractCompanies(payload: Record<string, unknown>, fileName: string) {
  if (fileName.endsWith(".csv")) return parseCsv(String(payload.content || ""));
  const data = payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : payload;
  return Array.isArray(data.companies) ? data.companies as Record<string, unknown>[] : Array.isArray(data.customers) ? data.customers as Record<string, unknown>[] : [];
}

async function logImport(summary: Record<string, unknown>, sessionId?: string | null, errorMessage?: string) {
  if (!hasSupabaseConfig()) return;
  await supabaseRest("data_import_logs", {
    method: "POST",
    body: JSON.stringify({ import_type: summary.importType, file_name: summary.fileName, status: errorMessage ? "failed" : "completed", summary, error_message: errorMessage || null, created_by: sessionId || null })
  }).catch(() => null);
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Bu alan yalnızca admin kullanıcılar içindir." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  if (!body.confirmedPreview) return NextResponse.json({ error: "İçe aktarma için önce önizleme yapılmalı ve onay verilmelidir." }, { status: 400 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yok. İçe aktarma çalıştırılamaz." }, { status: 500 });
  const fileName = String(body.fileName || "yedek.json");
  const conflictBehavior = String(body.conflictBehavior || "skip");
  try {
    const payload = fileName.endsWith(".csv") ? { content: String(body.content || "") } : JSON.parse(String(body.content || "{}"));
    const companies = extractCompanies(payload, fileName)
      .filter((row) => row && typeof row === "object")
      .map((row) => normalizeCompany(Object.fromEntries(Object.entries(row).filter(([key]) => !blockedKeyPattern.test(key))), conflictBehavior))
      .filter((row) => row.name || row.email || row.phone);
    let inserted = 0;
    let skipped = 0;
    for (const row of companies) {
      if (conflictBehavior === "skip" && (row.email || row.phone || row.name)) {
        const query = row.email ? `email=eq.${encodeURIComponent(String(row.email))}` : row.phone ? `phone=eq.${encodeURIComponent(String(row.phone))}` : `name=eq.${encodeURIComponent(String(row.name))}`;
        const existing = await supabaseRest<Record<string, unknown>[]>(`companies?${query}&select=id&limit=1`).catch(() => []);
        if (existing.length) {
          skipped += 1;
          continue;
        }
      }
      const method = conflictBehavior === "update" && row.id ? "PATCH" : "POST";
      const path = method === "PATCH" ? `companies?id=eq.${encodeURIComponent(String(row.id))}` : "companies";
      await supabaseRest(path, { method, body: JSON.stringify(row) }).catch(() => null);
      inserted += 1;
    }
    const summary = { importType: body.importType || "customers", fileName, inserted, skipped, sourceRecords: companies.length };
    await logImport(summary, session.id || session.userId);
    return NextResponse.json({ ok: true, message: "İçe aktarma tamamlandı. Desteklenmeyen veya hassas alanlar atlandı.", summary });
  } catch (error) {
    const summary = { importType: body.importType || "customers", fileName };
    await logImport(summary, session.id || session.userId, error instanceof Error ? error.message : "Dosya işlenemedi.");
    return NextResponse.json({ error: "Dosya formatı desteklenmiyor veya içe aktarma sırasında hata oluştu." }, { status: 400 });
  }
}
