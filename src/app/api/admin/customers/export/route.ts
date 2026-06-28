import { NextResponse } from "next/server";
import { requireModuleAccess } from "@/lib/permissions";
import { hasSupabaseConfig, supabaseRest } from "@/lib/supabase";
import { buildCsvExport, buildExcelCompatibleCsv, buildPrintableHtmlReport, buildWordMarkdownReport } from "@/lib/report-export";

type CompanyRow = Record<string, unknown> & {
  name?: string;
  sector?: string;
  city?: string;
  website?: string;
  instagram?: string;
  phone?: string;
  email?: string;
  status?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  archived_at?: string;
  deleted_at?: string;
};

function companyStatus(company: CompanyRow) {
  if (company.deleted_at) return "Silinen";
  if (company.archived_at || String(company.status || "").toLocaleLowerCase("tr").includes("arşiv")) return "Arşivli";
  if (String(company.status || "").toLocaleLowerCase("tr").includes("pasif") || company.is_active === false) return "Pasif";
  return "Aktif";
}

function responseForFile(body: string, filename: string, contentType: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
    }
  });
}

export async function GET(request: Request) {
  const session = await requireModuleAccess("musteriler");
  if (!session) return NextResponse.json({ error: "Bu işlem için müşteri yönetimi yetkisi gerekir." }, { status: 403 });
  if (!hasSupabaseConfig()) return NextResponse.json({ error: "Supabase bağlantısı yapılandırılmadı." }, { status: 500 });
  const searchParams = new URL(request.url).searchParams;
  const format = searchParams.get("format") || "csv";
  const status = searchParams.get("status") || "active";
  const query = (searchParams.get("q") || "").toLocaleLowerCase("tr");
  const rows = await supabaseRest<CompanyRow[]>("companies?select=*&order=created_at.desc&limit=5000").catch(() => []);
  const filtered = rows.filter((company) => {
    const state = companyStatus(company).toLocaleLowerCase("tr");
    const matchesStatus = status === "all" || (status === "active" ? ["aktif", "pasif"].includes(state) : state.includes(status === "deleted" ? "silinen" : status === "archived" ? "arşiv" : "pasif"));
    const searchable = `${company.name || ""} ${company.email || ""} ${company.phone || ""} ${company.city || ""} ${company.sector || ""}`.toLocaleLowerCase("tr");
    return matchesStatus && (!query || searchable.includes(query));
  });
  const exportRows = filtered.map((company) => ({
    "Müşteri / Firma adı": company.name || "",
    "Yetkili adı": company.contact_name || company.authorized_person || "",
    "E-posta": company.email || "",
    "Telefon": company.phone || "",
    "Şehir": company.city || "",
    "Sektör": company.sector || "",
    "Website": company.website || "",
    "Instagram": company.instagram || "",
    "Durum": companyStatus(company),
    "Müşteri panel girişi var mı?": company.customer_user_id ? "Var" : "Kontrol edilmeli",
    "Oluşturulma tarihi": company.created_at || "",
    "Son güncelleme tarihi": company.updated_at || "",
    "Notlar": company.notes || ""
  }));
  const date = new Date().toISOString().slice(0, 10);
  if (format === "excel") return responseForFile(buildExcelCompatibleCsv(exportRows), `hk-dijital-musteriler-${date}.csv`, "text/csv; charset=utf-8");
  if (format === "word") return responseForFile(buildWordMarkdownReport({ title: "HK Dijital Müşteri Bilgileri", summary: `${exportRows.length} müşteri kaydı dışa aktarıldı.`, table: exportRows, sections: [{ title: "Kapsam", items: [`Filtre: ${status}`, `Arama: ${query || "Yok"}`] }] }), `hk-dijital-musteriler-${date}.md`, "text/markdown; charset=utf-8");
  if (format === "pdf") return responseForFile(buildPrintableHtmlReport({ title: "HK Dijital Müşteri Bilgileri", summary: `${exportRows.length} müşteri kaydı profesyonel rapor şablonuyla hazırlandı.`, table: exportRows }), `hk-dijital-musteriler-${date}.html`, "text/html; charset=utf-8");
  return responseForFile(buildCsvExport(exportRows), `hk-dijital-musteriler-${date}.csv`, "text/csv; charset=utf-8");
}
