import type { Metadata } from "next";
import { LegalPage } from "@/components/public/LegalPage";

export const metadata: Metadata = {
  title: "HK Dijital | Gizlilik Politikası",
  description: "HK Dijital gizlilik politikası; Meta/Facebook Login, reklam hesabı verileri, raporlama ve veri silme hakları hakkında bilgi verir."
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      eyebrow="Gizlilik Politikası"
      title="HK Dijital Gizlilik Politikası"
      description="HK Dijital, https://www.hkdijital.com.tr üzerinde sunduğu dijital pazarlama, reklam yönetimi, raporlama ve müşteri paneli hizmetlerinde kişisel verilerin güvenli ve şeffaf şekilde işlenmesini önemser."
      sections={[
        {
          title: "İşlenebilecek Veriler",
          items: [
            "Ad, soyad, firma adı, e-posta, telefon, kullanıcı rolü, müşteri paneli erişim bilgileri ve iletişim tercihleri işlenebilir.",
            "Müşteri tarafından bağlanan reklam, sosyal medya ve analitik hesaplarına ait hesap adı, hesap ID, bağlantı durumu, son senkronizasyon tarihi ve raporlama için gerekli performans sinyalleri işlenebilir.",
            "Panel kullanım kayıtları, görev, rapor, ödeme, dosya ve destek talepleri hizmetin yürütülmesi, güvenlik ve kalite kontrol amacıyla kaydedilebilir."
          ]
        },
        {
          title: "Meta / Facebook Login ve Reklam Verileri",
          items: [
            "Meta veya Facebook Login kullanıldığında temel profil bilgileri, e-posta adresi, yetki verilen sayfa, işletme, reklam hesabı ve ilgili varlık bilgileri alınabilir.",
            "Meta reklam hesapları, kampanya performansı, gösterim, tıklama, harcama, dönüşüm ve benzeri metrikler yalnızca analiz, optimizasyon ve raporlama amacıyla kullanılır.",
            "HK Dijital, bağlı Meta/Facebook/Instagram varlıklarından alınan verileri müşterinin hizmet kapsamı dışında kullanmaz ve üçüncü kişilere satmaz."
          ]
        },
        {
          title: "Veri Kullanımı ve Paylaşımı",
          items: [
            "Veriler reklam yönetimi, raporlama, müşteri desteği, entegrasyon sağlığı, güvenlik ve operasyon takibi amacıyla işlenir.",
            "Kişisel veriler ve reklam performans verileri üçüncü kişilerle satılmaz. Yalnızca hizmetin sağlanması için zorunlu teknik sağlayıcılar ve yasal yükümlülükler kapsamında paylaşım yapılabilir.",
            "Erişim, düzeltme, güncelleme ve silme talepleri için kullanıcılar HK Dijital ile iletişime geçebilir."
          ]
        },
        {
          title: "Haklarınız",
          items: [
            "Kullanıcılar kendi verilerine erişim, hatalı bilgileri düzeltme, işleme sınırlandırma ve silme talebinde bulunma hakkına sahiptir.",
            "Veri silme talepleri için hayrikamali@icloud.com adresine e-posta gönderilebilir.",
            "Talep doğrulaması için ad-soyad, bağlı hesap e-postası ve müşteri firma adı istenebilir."
          ]
        }
      ]}
    />
  );
}
