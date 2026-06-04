export const metricLabels: Record<string, { label: string; explanation: string }> = {
  impressions: { label: "Gösterim", explanation: "Reklamınızın veya içeriğinizin ekranda toplam kaç kez gösterildiğini anlatır." },
  reach: { label: "Erişim", explanation: "İçeriğinizin kaç farklı kişiye ulaştığını gösterir." },
  clicks: { label: "Tıklama", explanation: "Reklamı veya bağlantıyı tıklayan toplam kullanıcı etkileşimini gösterir." },
  link_clicks: { label: "Bağlantı tıklaması", explanation: "Web sitesi, WhatsApp veya hedef bağlantıya yapılan tıklamaları gösterir." },
  landing_page_views: { label: "Sayfa görüntüleme", explanation: "Bağlantıya tıkladıktan sonra açılış sayfanızı gerçekten görüntüleyen kişileri gösterir." },
  spent: { label: "Harcama", explanation: "Seçilen dönemde reklam platformunda kullanılan toplam bütçedir." },
  cost: { label: "Harcama", explanation: "Seçilen dönemde Google Ads üzerinde kullanılan toplam bütçedir." },
  conversions: { label: "Dönüşüm", explanation: "Form, arama veya satın alma gibi hedeflenen işlemleri tamamlayan kişi sayısını gösterir." },
  leads: { label: "Potansiyel müşteri", explanation: "Form, mesaj veya arama yoluyla işletmenizle iletişime geçen kişileri ifade eder." },
  messages: { label: "Mesaj başlatma", explanation: "Reklam veya içerik sonrasında sizinle mesaj üzerinden iletişime geçen kişi sayısıdır." },
  calls: { label: "Arama", explanation: "İşletmenize yönlendirilen telefon aramalarını gösterir." },
  cpc: { label: "Tıklama başı maliyet", explanation: "Her bir reklam tıklaması için oluşan ortalama maliyettir." },
  average_cpc: { label: "Ortalama tıklama maliyeti", explanation: "Google Ads üzerinde her tıklama için oluşan ortalama maliyettir." },
  cost_per_conversion: { label: "Dönüşüm maliyeti", explanation: "Bir dönüşüm veya müşteri aksiyonu için oluşan ortalama maliyettir." },
  cpm: { label: "Bin gösterim maliyeti", explanation: "Reklamın bin kez gösterilmesi için oluşan ortalama maliyettir." },
  ctr: { label: "Tıklanma oranı", explanation: "Reklamı gören kişilerin ne kadarının tıkladığını yüzde olarak gösterir." },
  frequency: { label: "Frekans", explanation: "Bir kişinin reklamınızı ortalama kaç kez gördüğünü gösterir." },
  followers_growth: { label: "Takipçi artışı", explanation: "Seçilen dönemde hesabınıza eklenen yeni takipçi sayısını gösterir." },
  engagement: { label: "Etkileşim", explanation: "Beğeni, yorum, kaydetme ve paylaşım gibi kullanıcı hareketlerinin toplamıdır." },
  profile_visits: { label: "Profil ziyareti", explanation: "Sosyal medya profilinizi ziyaret eden kişi sayısını gösterir." },
  saves: { label: "Kaydetme", explanation: "İçeriğin daha sonra tekrar bakılmak üzere kaç kez kaydedildiğini gösterir." },
  shares: { label: "Paylaşım", explanation: "İçeriğinizin başka kişilere kaç kez gönderildiğini veya paylaşıldığını gösterir." },
  comments: { label: "Yorum", explanation: "İçeriklerinize yapılan toplam yorum sayısını gösterir." },
  likes: { label: "Beğeni", explanation: "İçeriklerinizin aldığı toplam beğeni sayısını gösterir." }
};

export function reportHighlights(report: any) {
  const metrics = report.metrics || {};
  const keys = report.report_type === "Sosyal Medya Yönetimi Raporu"
    ? ["posts", "reach", "profile_visits", "followers_growth", "messages", "engagement"]
    : report.report_type === "Google Ads Raporu"
      ? ["impressions", "clicks", "ctr", "average_cpc", "cost", "conversions"]
      : ["impressions", "reach", "clicks", "messages", "leads", "spent"];
  return keys.filter((key) => metrics[key] !== undefined && metrics[key] !== "").map((key) => ({
    key,
    label: metricLabels[key]?.label || key.replaceAll("_", " "),
    explanation: metricLabels[key]?.explanation || "Seçilen dönem için kaydedilen performans değeridir.",
    value: metrics[key]
  }));
}
