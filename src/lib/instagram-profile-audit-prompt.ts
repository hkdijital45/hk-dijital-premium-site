// Pure, dependency-free prompt builder — kept separate from
// InstagramProfileAuditPanel.tsx (which pulls in React/lucide-react) so
// it stays trivially unit-testable with a plain node:test run and never
// needs a React runtime just to build a string. Builds the short,
// dynamic Claude Project prompt: real company name/id and Instagram
// username only, no fixed token-wasting boilerplate, and never any
// secret/token.
export function buildInstagramProfileAuditPrompt(company: { id: string; name: string }, instagramUsername: string | null): string {
  const lines = [
    `${company.name} için Instagram profil optimizasyonu çalışması yap.`,
    "",
    `HK Digital Center bağlantılarını kullanarak doğru company ve Instagram hesabını doğrula. company_id: ${company.id}`,
    instagramUsername ? `Instagram kullanıcı adı: @${instagramUsername}` : "Instagram kullanıcı adını get_instagram_profile_audit_context ile doğrula.",
    "",
    "get_instagram_profile_audit_context ile gerekli gerçek verileri al.",
    "Profil fotoğrafı, kullanıcı adı, ad alanı, bio, link/CTA, öne çıkanlar, sabit gönderiler, profil vitrini ve güven/iletişim unsurlarını erişebildiğin gerçek veriler üzerinden değerlendir.",
    "Verisi bulunmayan alanı uydurma; gerekiyorsa hangi ekran görüntüsüne ihtiyaç olduğunu açıkça belirt.",
    "Her öneride ne yapılacağını, neden yapılacağını, nasıl uygulanacağını ve beklenen faydayı açıkla.",
    "Önceki profil optimizasyon raporu varsa (get_instagram_profile_audits) dikkate al ve mevcut durumla karşılaştır.",
    "",
    "Raporu önce sohbet içinde göster. Ben açıkça onaylayıp 'Kaydet' demeden save_instagram_profile_audit kullanma."
  ];
  return lines.join("\n");
}
