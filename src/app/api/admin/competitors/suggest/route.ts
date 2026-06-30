import { NextResponse } from "next/server";
import { buildActionResult } from "@/lib/action-result";
import { buildCompetitorSuggestions } from "@/lib/competitor-intelligence";
import { requireModuleAccess } from "@/lib/permissions";

export async function POST(request: Request) {
  const session = await requireModuleAccess("rakip-analizi");
  if (!session) return NextResponse.json({ success: false, message: "Rakip önerisi için yetki gerekir." }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const sector = body.sector || body.company?.sector;
  const city = body.city || body.company?.city;
  const district = body.district || body.branch?.district || body.company?.district;
  if (!sector || !city || !district) {
    return NextResponse.json(buildActionResult({
      title: "Rakip önerisi üretilemedi",
      summary: "Rakip bulmak için sektör, il ve ilçe gerekli. Eksik bilgileri müşteri profilinde tamamlayabilirsin.",
      status: "warning",
      nextActions: ["Müşteri profilinde sektör bilgisini kontrol et.", "Şehir ve ilçe bilgisini tamamla.", "Tekrar AI ile rakip bulmayı dene."],
      checkLinks: [{ label: "Müşterilere Git", href: "/hk-admin/musteriler" }]
    }), { status: 400 });
  }
  const suggestions = buildCompetitorSuggestions({ companyName: body.companyName, sector, city, district, branchName: body.branchName });
  return NextResponse.json({
    success: true,
    message: "Rakip önerileri hazırlandı.",
    suggestions,
    actionResult: {
      title: "Rakip önerileri hazırlandı",
      summary: `${city}/${district} bölgesinde ${sector} için ${suggestions.length} rakip önerisi üretildi.`,
      entityType: "Rakip Önerisi",
      companyId: body.companyId,
      branchId: body.branchId,
      status: "prepared",
      createdRecords: [{ label: "Rakip önerisi", count: suggestions.length, status: "Hazırlandı" }],
      nextActions: ["Önerileri gözden geçir.", "Uygun olanları rakip listesine kaydet.", "Müşteriye gösterilecek özeti daha sonra aç."],
      checkLinks: [{ label: "Rakip Analizine Dön", href: "/hk-admin/rakip-analizi" }],
      customerVisibility: { showToCustomer: false, label: "Öneriler müşteri paneline otomatik açılmaz." },
      technicalDetails: { source: "local-fallback" }
    }
  });
}
