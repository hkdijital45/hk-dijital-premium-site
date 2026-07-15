import type { Metadata } from "next";
import { LegalPage } from "@/components/public/LegalPage";

export const metadata: Metadata = {
  title: "HK Dijital | Kullanım Şartları",
  description: "HK Dijital kullanım şartları; hizmet kapsamı, hesap bağlama yetkisi, entegrasyonlar ve reklam performansı hakkında bilgi verir."
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Kullanım Şartları"
      title="HK Dijital Kullanım Şartları"
      description="Bu kullanım şartları, HK Dijital tarafından https://www.hkdijital.com.tr üzerinden sunulan web sitesi, Digital Center, admin panel, müşteri paneli, entegrasyon ve raporlama hizmetlerinin genel kullanım koşullarını açıklar."
      sections={[
        {
          title: "Hizmet Kapsamı",
          items: [
            "HK Dijital; reklam yönetimi, sosyal medya operasyonu, raporlama, analiz, müşteri paneli, görev takibi ve entegrasyon destekleri sunabilir.",
            "Hizmet kapsamı müşteriye özel teklif, sözleşme, paket veya yazılı mutabakat ile değişebilir.",
            "HK Dijital, panel özelliklerini, entegrasyonları ve hizmet içeriklerini teknik gerekliliklere göre güncelleyebilir veya değiştirebilir."
          ]
        },
        {
          title: "Hesap Bağlama ve Yetki",
          items: [
            "Kullanıcı, Meta, Facebook, Instagram, Google, TikTok veya diğer platform hesaplarını bağlarken ilgili hesap üzerinde yetkili olduğunu kabul eder.",
            "Bağlanan hesaplar, müşterinin raporlama, analiz ve operasyon ihtiyaçları için kullanılır. Yetkisiz hesap bağlama, yanıltıcı veri girme veya üçüncü kişilere ait hesapları izinsiz kullanma yasaktır.",
            "Kullanıcı, panel ve entegrasyonları yasal, etik ve platform politikalarına uygun şekilde kullanmakla yükümlüdür."
          ]
        },
        {
          title: "Reklam Performansı ve Sorumluluk",
          items: [
            "Reklam performansı; bütçe, sektör, rekabet, kreatif kalite, hedefleme, web sitesi, satış süreci ve platform algoritmaları gibi birçok değişkene bağlıdır.",
            "HK Dijital reklam sonuçları, satış, potansiyel müşteri sayısı, ROAS veya gelir için kesin garanti vermez.",
            "Platform kesintileri, API değişiklikleri, reklam hesabı kısıtlamaları, ödeme sorunları veya üçüncü taraf sistem arızalarından doğan etkiler hizmetin dışında değerlendirilebilir."
          ]
        },
        {
          title: "Güvenli ve Uygun Kullanım",
          items: [
            "Panelin kötüye kullanılması, yetkisiz erişim denemesi, verileri izinsiz aktarma veya sistem güvenliğini zedeleme girişimleri yasaktır.",
            "Kullanıcı, kendi hesap erişim bilgilerinin güvenliğinden ve bağladığı platform yetkilerinden sorumludur.",
            "Sorular ve resmi bildirimler için hayrikamali@icloud.com adresinden HK Dijital ile iletişime geçilebilir."
          ]
        }
      ]}
    />
  );
}
