// Pure, framework-free prompt builders for a Müşteri Keşfi/manual lead —
// extracted out of PreAuditCenter.tsx (a "use client" component) so they
// are unit-testable under the plain node test runner without pulling in
// React/lucide-react (a component file can't be `import()`-ed outside an
// actual React render environment — confirmed: it throws on
// `react.createContext is not a function` under node:test).
//
// Two DELIBERATELY SEPARATE prompts, never merged:
//  - buildClaudePrompt: Ön İnceleme — a deep pre-sales digital audit.
//  - buildCandidateEvaluationPrompt: Adayı Değerlendir — "is this prospect
//    worth pursuing?" qualification. Lighter, different MCP tools
//    (get_candidate_evaluation_context/save_candidate_evaluation), never
//    calls save_pre_audit_report or vice versa.
export type PromptLead = {
  id: string;
  company?: string | null;
  name?: string | null;
  sector?: string | null;
  business_type?: string | null;
  city?: string | null;
  district?: string | null;
  website?: string | null;
  phone?: string | null;
  instagram?: string | null;
  source?: string | null;
  notes?: string | null;
};

export function leadDisplayName(lead: PromptLead): string {
  return lead.company || lead.name || "İsimsiz aday";
}

/** A linked branch/related brand selected in İşletme ve Şube Yönetimi.
 * When passed, the prompt researches THAT business (its own Instagram/
 * website/phone) and saves with businessUnitId — never the main lead's. */
export type PromptBusiness = {
  businessUnitId: string;
  name: string;
  instagram?: string | null;
  website?: string | null;
  phone?: string | null;
  address?: string | null;
};

function identityBlock(lead: PromptLead, business?: PromptBusiness | null) {
  if (!business) return { name: leadDisplayName(lead), website: lead.website, phone: lead.phone, instagram: lead.instagram, ids: `leadId="${lead.id}"`, scopeNote: "" };
  return {
    name: business.name,
    website: business.website,
    phone: business.phone,
    instagram: business.instagram,
    ids: `leadId="${lead.id}", businessUnitId="${business.businessUnitId}"`,
    scopeNote: `\n\nÖNEMLİ: Bu çalışma ana işletme ${leadDisplayName(lead)} için DEĞİL, ona bağlı ayrı işletme ${business.name} içindir. Yalnızca ${business.name} verilerini kullan; ${leadDisplayName(lead)} verilerini bu rapora karıştırma. Bağlam ve kayıt araçlarında businessUnitId'yi mutlaka gönder.`
  };
}

export function buildClaudePrompt(lead: PromptLead, business?: PromptBusiness | null): string {
  const location = [lead.district, lead.city].filter(Boolean).join(", ") || "-";
  const who = identityBlock(lead, business);
  return `HK Dijital Ön İnceleme görevi.

Aşağıdaki işletmeyi HK Dijital MCP bağlantısı üzerinden (get_pre_audit_context, ${who.ids}) kesin olarak doğrula — aynı isimli başka bir işletmeyle karıştırma.${who.scopeNote}

Firma: ${who.name}
Sektör: ${lead.sector || lead.business_type || "-"}
Konum: ${location}
Website: ${who.website || "-"}
Telefon: ${who.phone || "-"}
Instagram: ${who.instagram || "-"}

Doğruladıktan sonra: Google, Google Maps/Local SEO, web sitesi, SEO, sosyal medya (Instagram/Facebook) ve halka açık reklam sinyallerini (Meta/Google Ads) araştır. Yalnızca gerçekten bulduğun/doğrulayabildiğin bilgileri kullan; olmayan metrik uydurma.

Kısa ve profesyonel bir ön inceleme hazırla: yönetici özeti, dijital varlıklar, SWOT (güçlü/zayıf yönler, fırsatlar, tehditler), dijital boşluklar, fırsatlar, önerilen HK Dijital hizmetleri ve paket, başlangıç reklam stratejisi ve bütçe planı.

Raporu teslim etmeden önce Türkçe yazım, imla, noktalama, anlatım bozukluğu, tekrar, başlık tutarlılığı ve profesyonel terminoloji açısından sessiz bir son kontrol yap; hataları düzelterek yalnızca düzeltilmiş nihai raporu üret. Bu kontrol firma adı, fiyat, tarih, telefon, URL, kullanıcı adı, rakip adı, puan, yorum sayısı gibi somut verileri değiştirmez — yalnızca dili düzeltir.

Kullanıcı açıkça "HK Dijital'e kaydet" derse, save_pre_audit_report aracını ${who.ids} ve report_type="INTERNAL_REPORT" ile çağırarak sonucu kaydet. Kullanıcı açıkça istemeden asla kaydetme.`;
}

export function buildCandidateEvaluationPrompt(lead: PromptLead, business?: PromptBusiness | null): string {
  const location = [lead.district, lead.city].filter(Boolean).join(", ") || "-";
  const who = identityBlock(lead, business);
  return `HK DİJİTAL — MÜŞTERİ ADAYI DEĞERLENDİRME görevi.

Bu bir Ön İnceleme (derin dijital denetim) DEĞİLDİR — yalnızca "bu işletmenin peşinden gitmeye değer mi?" sorusuna hızlı, profesyonel bir yanıt.

Aşağıdaki işletmeyi HK Dijital MCP bağlantısı üzerinden (get_candidate_evaluation_context, ${who.ids}) doğrula — aynı isimli başka bir işletmeyle karıştırma.${who.scopeNote}

Firma: ${who.name}
Sektör: ${lead.sector || lead.business_type || "-"}
Konum: ${location}
Website: ${who.website || "-"}
Telefon: ${who.phone || "-"}
Instagram: ${who.instagram || "-"}
Kaynak: ${lead.source || "-"}
Notlar: ${lead.notes || "-"}

Doğruladıktan sonra, yalnızca gerçekten bulduğun/doğrulayabildiğin bilgilere dayanarak kısa bir değerlendirme hazırla: genel tavsiye (takip edilmeli mi/edilmemeli mi/belirsiz), öncelik seviyesi, varsa 0-100 arası bir uygunluk puanı (emin değilsen puan verme), güçlü yönler, zayıf yönler, dijital fırsatlar ve önerilen sonraki adım. Bulamadığın bilgiyi uydurma, satış garantisi verme.

Kullanıcı açıkça "HK Dijital'e kaydet" derse, save_candidate_evaluation aracını ${who.ids} ile çağırarak sonucu kaydet — bu ASLA save_pre_audit_report'u çağırmaz ve hiçbir müşteri kaydı oluşturmaz. Kullanıcı açıkça istemeden asla kaydetme.`;
}
