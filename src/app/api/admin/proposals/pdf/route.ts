import { NextResponse } from "next/server";
import { getSession, isStaffRole } from "@/lib/auth";
import { generatePdfBuffer, type DocumentPayload } from "@/lib/server/document-generator";
import { calculateVat, calculateTotalWithVat, formatTRY } from "@/lib/packages";
import { getSiteContent } from "@/lib/content";
import { buildProposalFilename, buildProposalNumber } from "@/lib/proposal-document";

// Real PDF generation for Teklif Motoru — reuses the exact same canonical
// document engine every other export in the app goes through
// (generatePdfBuffer in document-generator.ts: pdf-lib + a Turkish-glyph-
// complete embedded font, already used for monthly reports). No parallel
// PDF implementation, no browser print dialog involved.
//
// There is no dedicated `proposals` table (see the audit that led here —
// only proposal_followups exists, which doesn't carry every field a
// proposal document needs), so there is no database sequence to draw a
// proposal number from. The reference number below is minted at PDF-
// generation time from a real UUID, not fabricated business data — it is
// a document reference, not a claim about persisted state.
type ProposalPdfRequest = {
  companyName?: string;
  sector?: string;
  contactPhone?: string;
  packageType?: string;
  services?: string[];
  excludedServices?: string[];
  monthlyFee?: number;
  setupFee?: number;
  adBudget?: number;
  duration?: string;
  paymentNote?: string;
  nextSteps?: string[];
  notes?: string;
  validityDays?: number;
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!isStaffRole(session?.role)) {
    return NextResponse.json({ error: "Bu işlem için yönetici yetkisi gerekir." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as ProposalPdfRequest;
  const companyName = (body.companyName || "").trim();
  if (!companyName) return NextResponse.json({ error: "Teklif için firma/müşteri adı gerekli." }, { status: 400 });

  const monthlyFee = Number(body.monthlyFee || 0);
  const setupFee = Number(body.setupFee || 0);
  const adBudget = Number(body.adBudget || 0);
  const validityDays = Number(body.validityDays || 14);
  const services = (body.services || []).filter(Boolean);
  const excludedServices = (body.excludedServices || []).filter(Boolean);
  const nextSteps = (body.nextSteps || []).filter(Boolean);

  const now = new Date();
  const proposalNumber = buildProposalNumber(now, crypto.randomUUID());
  const validUntil = new Date(now.getTime() + validityDays * 86400000);
  const dateLabel = now.toLocaleDateString("tr-TR");
  const validUntilLabel = validUntil.toLocaleDateString("tr-TR");

  const monthlyVat = calculateVat(monthlyFee);
  const monthlyTotal = calculateTotalWithVat(monthlyFee);
  const setupVat = calculateVat(setupFee);
  const setupTotal = calculateTotalWithVat(setupFee);

  const site = await getSiteContent().catch(() => null);
  const contactLines = [
    site?.contact?.phone ? `Telefon: ${site.contact.phone}` : "",
    site?.contact?.email ? `E-posta: ${site.contact.email}` : ""
  ].filter(Boolean).join("  ·  ");

  const pricingLines = [
    `Aylık Hizmet Bedeli: ${formatTRY(monthlyFee)} (KDV Hariç)`,
    `KDV (%20): ${formatTRY(monthlyVat)}`,
    `Aylık Toplam (KDV Dahil): ${formatTRY(monthlyTotal)}`,
    "",
    `Kurulum Bedeli: ${formatTRY(setupFee)} (KDV Hariç)`,
    `KDV (%20): ${formatTRY(setupVat)}`,
    `Kurulum Toplam (KDV Dahil): ${formatTRY(setupTotal)}`
  ];
  if (adBudget > 0) pricingLines.push("", `Önerilen Reklam Bütçesi: ${formatTRY(adBudget)} (reklam platformuna doğrudan ödenir, hizmet bedeline dahil değildir)`);

  const payload: DocumentPayload = {
    title: `Teklif — ${companyName}`,
    customerName: companyName,
    period: dateLabel,
    executiveSummary: [body.sector ? `Sektör: ${body.sector}` : "", body.packageType ? `Önerilen Paket: ${body.packageType}` : ""].filter(Boolean).join("  ·  "),
    sections: [
      { title: "Teklif Bilgileri", text: `Teklif No: ${proposalNumber}\nTarih: ${dateLabel}\nGeçerlilik: ${validityDays} gün (${validUntilLabel} tarihine kadar)` },
      { title: "Hizmet Kalemleri", items: services },
      { title: "Kapsam Dışı", items: excludedServices },
      { title: "Ücretlendirme", text: pricingLines.join("\n") },
      body.duration ? { title: "Süre", text: body.duration } : { title: "", items: [] },
      { title: "Aksiyon Planı", items: nextSteps },
      body.paymentNote ? { title: "Ödeme Koşulları", text: body.paymentNote } : { title: "", items: [] },
      body.notes ? { title: "Notlar", text: body.notes } : { title: "", items: [] }
    ].filter((section) => section.title),
    footerNote: [`Bu teklif ${validUntilLabel} tarihine kadar geçerlidir.`, contactLines].filter(Boolean).join("  ·  ")
  };

  try {
    const buffer = await generatePdfBuffer(payload);
    const filename = buildProposalFilename(companyName, proposalNumber);
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Teklif PDF oluşturulamadı." }, { status: 500 });
  }
}
