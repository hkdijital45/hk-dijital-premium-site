import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { buildCsvExport, buildExcelCompatibleCsv, buildPrintableHtmlReport, buildWordMarkdownReport } from "@/lib/report-export";

type ExportType = "full-backup" | "customers" | "reports" | "payments" | "tasks" | "documents";

const exportMap: Record<ExportType, Array<{ key: string; table: string; select: string }>> = {
  "full-backup": [
    { key: "companies", table: "companies", select: "*" },
    { key: "users", table: "users", select: "id,email,full_name,role,company_id,is_active,created_at,updated_at" },
    { key: "leads", table: "leads", select: "*" },
    { key: "campaigns", table: "campaigns", select: "*" },
    { key: "campaign_metrics", table: "campaign_metrics", select: "*" },
    { key: "reports", table: "reports", select: "*" },
    { key: "report_interpretations", table: "report_interpretations", select: "*" },
    { key: "customer_updates", table: "customer_updates", select: "*" },
    { key: "customer_files", table: "customer_files", select: "*" },
    { key: "payment_records", table: "payment_records", select: "*" },
    { key: "agency_tasks", table: "agency_tasks", select: "*" },
    { key: "customer_documents", table: "customer_documents", select: "*" },
    { key: "agent_runs", table: "agent_runs", select: "id,customer_id,task_type,requested_provider,actual_provider,status,output_summary,estimated_cost,response_ms,created_at,completed_at" },
    { key: "agent_memories", table: "agent_memories", select: "*" },
    { key: "agent_training_rules", table: "agent_training_rules", select: "*" },
    { key: "agent_prompts", table: "agent_prompts", select: "id,provider_key,task_type,title,is_default,is_active,created_at,updated_at" }
  ],
  customers: [{ key: "companies", table: "companies", select: "*" }, { key: "users", table: "users", select: "id,email,full_name,role,company_id,is_active,created_at,updated_at" }],
  reports: [{ key: "reports", table: "reports", select: "*" }, { key: "report_interpretations", table: "report_interpretations", select: "*" }],
  payments: [{ key: "payment_records", table: "payment_records", select: "*" }],
  tasks: [{ key: "agency_tasks", table: "agency_tasks", select: "*" }],
  documents: [{ key: "customer_documents", table: "customer_documents", select: "*" }, { key: "customer_files", table: "customer_files", select: "*" }]
};

const blockedKeyPattern = /(password|secret|token|api[_-]?key|access[_-]?token|refresh[_-]?token|service[_-]?role|smtp[_-]?pass|hash)/i;

function sanitizeRow(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).filter(([key]) => !blockedKeyPattern.test(key)));
}

async function fetchRows(table: string, select: string) {
  if (!hasSupabaseConfig()) return { rows: [] as Record<string, unknown>[], warning: "Supabase bağlantısı yapılandırılmadı." };
  try {
    const rows = await supabaseRest<Record<string, unknown>[]>(`${table}?select=${encodeURIComponent(select)}&limit=5000`);
    return { rows: rows.map(sanitizeRow), warning: "" };
  } catch {
    return { rows: [] as Record<string, unknown>[], warning: `${table} tablosu bulunamadı veya okunamadı.` };
  }
}

function responseForFile(body: string, filename: string, contentType: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    }
  });
}

async function logExport(type: string, format: string, summary: Record<string, unknown>, userId?: string | null) {
  if (!hasSupabaseConfig()) return;
  await supabaseRest("data_export_logs", {
    method: "POST",
    body: JSON.stringify({ export_type: type, format, summary, created_by: userId || null })
  }).catch(() => null);
}

export async function GET(request: Request, context: { params: Promise<{ type: string }> }) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Bu alan yalnızca admin kullanıcılar içindir." }, { status: 403 });
  const { type: rawType } = await context.params;
  const type = rawType as ExportType;
  if (!exportMap[type]) return NextResponse.json({ error: "Desteklenmeyen dışa aktarma türü." }, { status: 400 });
  const format = new URL(request.url).searchParams.get("format") || "json";
  const exportedAt = new Date().toISOString();
  const sections: Record<string, Record<string, unknown>[]> = {};
  const warnings: string[] = [];

  for (const item of exportMap[type]) {
    const result = await fetchRows(item.table, item.select);
    sections[item.key] = result.rows;
    if (result.warning) warnings.push(result.warning);
  }

  const tableCounts = Object.fromEntries(Object.entries(sections).map(([key, rows]) => [key, rows.length]));
  const metadata = { app: "HK Dijital", exportType: type, exportedAt, version: "2026.06", tableCounts, warnings };
  const flatRows = Object.entries(sections).flatMap(([section, rows]) => rows.map((row) => ({ section, ...row })));
  const date = exportedAt.slice(0, 10);
  await logExport(type, format, { tableCounts, warnings }, session.id || session.userId);

  if (format === "csv") return responseForFile(buildCsvExport(flatRows), `hk-dijital-${type}-${date}.csv`, "text/csv; charset=utf-8");
  if (format === "excel") return responseForFile(buildExcelCompatibleCsv(flatRows), `hk-dijital-${type}-${date}.csv`, "text/csv; charset=utf-8");
  if (format === "word") return responseForFile(buildWordMarkdownReport({ title: "HK Dijital Veri Yedeği", summary: `${type} dışa aktarımı hazırlandı.`, table: flatRows.slice(0, 500), sections: [{ title: "Tablo Sayıları", items: Object.entries(tableCounts).map(([key, count]) => `${key}: ${count}`) }, { title: "Uyarılar", items: warnings.length ? warnings : ["Uyarı yok"] }] }), `hk-dijital-${type}-${date}.md`, "text/markdown; charset=utf-8");
  if (format === "pdf") return responseForFile(buildPrintableHtmlReport({ title: "HK Dijital Yedek Özet Raporu", summary: `${type} dışa aktarımı için profesyonel özet rapor.`, table: flatRows.slice(0, 250), sections: [{ title: "Tablo Sayıları", items: Object.entries(tableCounts).map(([key, count]) => `${key}: ${count}`) }, { title: "Güvenlik", items: ["API key, token, secret, şifre ve auth hassas alanları dışa aktarılmaz."] }] }), `hk-dijital-${type}-${date}.html`, "text/html; charset=utf-8");
  return responseForFile(JSON.stringify({ metadata, data: sections }, null, 2), `hk-dijital-${type}-${date}.json`, "application/json; charset=utf-8");
}
