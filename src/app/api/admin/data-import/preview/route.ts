import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/permissions";

function parseCsv(text: string) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const headers = (lines.shift() || "").split(",").map((item) => item.trim().replace(/^"|"$/g, ""));
  return lines.map((line) => {
    const values = line.match(/("([^"]|"")*"|[^,]+)/g)?.map((value) => value.trim().replace(/^"|"$/g, "").replace(/""/g, '"')) || [];
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

function summarize(payload: Record<string, unknown>, importType: string) {
  const data = payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : payload;
  const companies = Array.isArray(data.companies) ? data.companies : Array.isArray(data.customers) ? data.customers : [];
  const reports = Array.isArray(data.reports) ? data.reports : [];
  const payments = Array.isArray(data.payment_records) ? data.payment_records : Array.isArray(data.payments) ? data.payments : [];
  const tasks = Array.isArray(data.agency_tasks) ? data.agency_tasks : Array.isArray(data.tasks) ? data.tasks : [];
  const campaigns = Array.isArray(data.campaigns) ? data.campaigns : [];
  const broken = [companies, reports, payments, tasks, campaigns].flat().filter((item) => !item || typeof item !== "object").length;
  return {
    importType,
    counts: {
      companies: companies.length,
      campaigns: campaigns.length,
      reports: reports.length,
      payments: payments.length,
      tasks: tasks.length
    },
    brokenRecords: broken,
    conflictCheck: "Çakışma kontrolü commit aşamasında id, e-posta, telefon ve firma adına göre yapılır.",
    warnings: broken ? ["Bazı kayıtlar eksik veya bozuk görünüyor."] : []
  };
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Bu alan yalnızca admin kullanıcılar içindir." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const fileName = String(body.fileName || "yedek.json");
  const importType = String(body.importType || "full_backup");
  const raw = String(body.content || "");
  if (!raw.trim()) return NextResponse.json({ error: "Önizleme için dosya seçmelisin." }, { status: 400 });
  try {
    const payload = fileName.endsWith(".csv")
      ? { data: { companies: parseCsv(raw) } }
      : JSON.parse(raw);
    const summary = summarize(payload, importType);
    return NextResponse.json({ ok: true, message: "Önizleme hazırlandı. Onaylamadan veri yazılmaz.", summary, previewRequired: true });
  } catch {
    return NextResponse.json({ error: "Dosya okunamadı veya HK Dijital yedeği gibi görünmüyor." }, { status: 400 });
  }
}
