"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

type GuideTopic = {
  title: string;
  description: string;
  steps: string[];
};

// Customer-safe help content: no mention of migrations, RLS, server actions,
// API secrets/tokens, or database schema — only what a customer can see and
// do inside their own panel.
const CUSTOMER_GUIDE_TOPICS: GuideTopic[] = [
  {
    title: "Ana Sayfa",
    description: "Panelinize girdiğinizde hesabınızın genel durumunu görürsünüz.",
    steps: [
      "Üstte firma bilgileriniz ve paket durumunuz görünür.",
      "Reklam performansı, bekleyen görevler ve son raporlar özet kartlarda listelenir.",
      "Bir kartın üzerine tıklayarak ilgili bölüme geçebilirsiniz."
    ]
  },
  {
    title: "Raporlar",
    description: "HK Dijital ekibinin sizin için hazırladığı performans raporlarına buradan ulaşırsınız.",
    steps: [
      "Raporlar bölümünde tarih sırasına göre listelenen raporları görün.",
      "Bir rapora tıklayarak detaylarını inceleyin; gerekirse PDF olarak indirin.",
      "Bir rapor hakkında sorunuz varsa 'Bu rapor hakkında destek iste' butonunu kullanın."
    ]
  },
  {
    title: "Belgeler",
    description: "Sizinle paylaşılan sözleşme, sunum ve diğer dosyalar burada listelenir.",
    steps: [
      "Belgeler bölümünden dosya adını ve tarihini görüp indirin.",
      "Yalnızca ekibimizin sizinle paylaşmayı seçtiği dosyalar burada görünür."
    ]
  },
  {
    title: "Görevler",
    description: "Hesabınızla ilgili devam eden ve tamamlanan çalışmaları takip edin.",
    steps: [
      "Görevler listesinde durum (devam ediyor, tamamlandı, bekliyor) etiketiyle ilerlemeyi görün.",
      "Sizden bir bilgi veya onay bekleyen görevler ayrıca işaretlenir."
    ]
  },
  {
    title: "Finans / Ödemeler",
    description: "Ödeme geçmişinizi ve bekleyen tutarları görüntüleyin.",
    steps: [
      "Ödenen ve bekleyen tutarlar ayrı kartlarda gösterilir.",
      "Her ödeme kaydında hizmet dönemi ve durumu yer alır."
    ]
  },
  {
    title: "Reklam Sonuçları / Analiz",
    description: "Reklam kampanyalarınızın performansını sade bir dille görün.",
    steps: [
      "Tıklama oranı, tıklama maliyeti, dönüşüm maliyeti ve reklam getirisi gibi özetler sade Türkçe etiketlerle gösterilir.",
      "Veri henüz yoksa sistem uydurma sayı göstermez, 'veri bekleniyor' notu görürsünüz."
    ]
  },
  {
    title: "SEO ve Sosyal Medya",
    description: "Web sitenizin arama motoru ve sosyal medya görünürlüğüyle ilgili özet bilgiler.",
    steps: [
      "İlgili bölümdeki kartlarda site ve sosyal medya performans özetini görün."
    ]
  },
  {
    title: "Destek",
    description: "Bir sorunuz veya talebiniz olduğunda doğrudan ekibimize ulaşın.",
    steps: [
      "Destek bölümünden yeni bir konuşma başlatın; konu ve mesajınızı yazın.",
      "Ekibimizin yanıtlarını aynı ekrandan takip edebilirsiniz."
    ]
  },
  {
    title: "Platform Bağlama (Hesap Bağla)",
    description: "Meta, Google veya diğer reklam/analiz hesaplarınızı ekibimizle paylaşmak için kullanılır.",
    steps: [
      "Hesap Bağla bölümünde platform seçin.",
      "Otomatik Bağlan seçeneği varsa onu kullanın; yoksa Manuel Bilgi Gir ile hesap bilgilerinizi paylaşın.",
      "Bağlantı durumu 'Beklemede', 'İnceleniyor' veya 'Bağlandı' olarak görünür."
    ]
  },
  {
    title: "Bildirimler",
    description: "Eksik bilgi, yeni rapor, yeni dosya veya bağlantı durumu değişikliği gibi uyarılar burada toplanır.",
    steps: [
      "Bildirimler bölümünü düzenli kontrol edin; bir aksiyon gerektiren uyarılar ayrıca vurgulanır."
    ]
  },
  {
    title: "Şifre Değiştirme",
    description: "Hesap güvenliğiniz için şifrenizi istediğiniz zaman değiştirebilirsiniz.",
    steps: [
      "Hesabım bölümünden veya giriş sonrası yönlendirmeden şifre değiştirme ekranına gidin.",
      "Yeni şifrenizi girip onaylayın; geçici bir şifreyle giriş yaptıysanız bu adım zorunludur."
    ]
  }
];

export function CustomerGuideCenter() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section id="yardim" className="glass-card scroll-mt-28 p-5 md:col-span-2">
      <h2 className="flex items-center gap-2 text-xl font-black">
        <HelpCircle className="text-cyan-600" /> Yardım ve Kullanım Rehberi
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">Panelinizi nasıl kullanacağınızla ilgili kısa açıklamalar. Bir başlığa tıklayarak detayları görün.</p>
      <div className="mt-5 grid gap-2">
        {CUSTOMER_GUIDE_TOPICS.map((topic) => {
          const isOpen = open === topic.title;
          return (
            <div key={topic.title} className="rounded-[14px] border border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : topic.title)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-3 p-4 text-left"
              >
                <span>
                  <span className="block font-black text-slate-900">{topic.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{topic.description}</span>
                </span>
                <ChevronDown size={18} className={`shrink-0 text-slate-500 transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <ol className="grid gap-2 border-t border-slate-200 p-4 pt-3 text-sm leading-6 text-slate-700">
                  {topic.steps.map((step, index) => (
                    <li key={step} className="flex gap-2">
                      <span className="font-black text-cyan-700">{index + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
