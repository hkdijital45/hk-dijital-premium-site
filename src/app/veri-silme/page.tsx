import type { Metadata } from "next";
import { LegalPage } from "@/components/public/LegalPage";

export const metadata: Metadata = {
  title: "HK Dijital | Veri Silme Talimatları",
  description: "HK Dijital veri silme talimatları; Meta/Facebook uygulama erişimini kaldırma ve veri silme talebi gönderme adımlarını açıklar."
};

export default function DataDeletionPage() {
  return (
    <LegalPage
      eyebrow="Veri Silme"
      title="HK Dijital Veri Silme Talimatları"
      description="HK Dijital, https://hkdijital.com.tr üzerinden bağlanan hesaplar ve müşteri paneli verileri için kullanıcıların silme talebi oluşturabilmesini sağlar."
      sections={[
        {
          title: "Veri Silme Talebi Nasıl Gönderilir?",
          items: [
            "Veri silme talebi için hayrikamali@icloud.com adresine e-posta gönderebilirsiniz.",
            "E-posta konusu olarak “HK Dijital Veri Silme Talebi” yazmanız önerilir.",
            "Talebin doğrulanabilmesi için ad-soyad, bağlı Meta hesabı veya e-posta adresi ve müşteri firma adı istenebilir."
          ]
        },
        {
          title: "Talebin İşlenmesi",
          items: [
            "HK Dijital, doğrulanmış veri silme taleplerini makul süre içinde incelemeye ve işleme almaya çalışır.",
            "Yasal saklama yükümlülüğü, fatura kaydı, sözleşme veya güvenlik kaydı gibi zorunlu alanlar varsa, ilgili kayıtlar mevzuata uygun süre boyunca saklanabilir.",
            "Silme işlemi tamamlandığında veya ek doğrulama gerektiğinde kullanıcıya e-posta üzerinden dönüş yapılabilir."
          ]
        },
        {
          title: "Meta / Facebook Uygulama Erişimini Kaldırma",
          items: [
            "Alternatif olarak Meta/Facebook hesap ayarlarınızdan HK Dijital uygulama erişimini kaldırabilirsiniz.",
            "Meta uygulama erişimini kaldırmak, gelecekteki veri erişimini durdurur; daha önce HK Dijital sisteminde işlenmiş verilerin silinmesi için ayrıca e-posta ile talep göndermeniz önerilir.",
            "Meta, Facebook veya Instagram hesabınıza ait uygulama izinlerini platformun güvenlik ve uygulama ayarları ekranından yönetebilirsiniz."
          ]
        },
        {
          title: "İletişim ve Kapsam",
          items: [
            "Bu sayfa, Meta App Review ve kullanıcı veri silme gereksinimleri için public olarak erişilebilir şekilde hazırlanmıştır.",
            "Talepler HK Dijital markası ve hkdijital.com.tr domaini kapsamındaki hesap bağlantıları için değerlendirilir.",
            "Sorularınız için hayrikamali@icloud.com adresine yazabilirsiniz."
          ]
        }
      ]}
    />
  );
}
