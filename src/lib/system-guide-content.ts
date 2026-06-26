export type SystemGuideSeed = {
  slug: string;
  title: string;
  category: string;
  description: string;
  route: string;
  videoUrl?: string;
  content: {
    purpose: string;
    whenToUse: string;
    steps: string[];
    example: string;
    commonErrors: string[];
    tips: string[];
    warnings: string[];
  };
};

export const systemGuideCategories = [
  "Dashboard & Kontrol Merkezi", "CRM & Müşteriler", "Satış Hunisi", "Tahsilat & Karlılık",
  "Görev Yönetimi", "Raporlama Merkezi", "Meta Entegrasyonları", "Google Entegrasyonları",
  "HK Intelligence", "AI Studio", "Dosya & Belge Merkezi", "Kullanıcı Yönetimi", "Ayarlar",
  "Web Site Yönetimi", "Müşteri Paneli", "Sorun Giderme"
];

const definitions: Array<[string, string, string, string]> = [
  ["Dashboard nedir?", "Dashboard & Kontrol Merkezi", "Ajansın günlük KPI, risk ve aksiyonlarını tek ekranda izleyin.", ""],
  ["HK Intelligence Command Center", "Dashboard & Kontrol Merkezi", "Tahsilat, lead, teklif, görev, müşteri ve entegrasyon sinyallerini günlük öncelik sırasına dönüştürün.", "intelligence-command-center"],
  ["Risk Merkezi", "Dashboard & Kontrol Merkezi", "Operasyon risklerini etki ve aciliyet puanına göre inceleyip ilgili kayda ilerleyin.", "risk-merkezi"],
  ["Müşteri yaşam döngüsü", "CRM & Müşteriler", "Lead aşamasından referansa kadar her müşterinin operasyon evresini izleyin.", "intelligence-command-center"],
  ["Müşteri sağlık ve kârlılık analizi", "Tahsilat & Karlılık", "Tahsilat, görev, temas, rapor ve maliyet sinyallerinden müşteri riskini ve tahmini kârlılığı okuyun.", "intelligence-command-center"],
  ["KPI kartlarını okuma", "Dashboard & Kontrol Merkezi", "Gelir, tahsilat, müşteri, kampanya ve görev kartlarını doğru yorumlayın.", ""],
  ["Kritik görevleri yönetme", "Dashboard & Kontrol Merkezi", "Geciken ve kritik görevleri önceliklendirip ilgili kayda ilerleyin.", "gorevler"],
  ["Hızlı işlemler", "Dashboard & Kontrol Merkezi", "Müşteri, kampanya, görev, tahsilat ve rapor formlarını doğrudan açın.", ""],
  ["Müşteri oluşturma", "CRM & Müşteriler", "Yeni firma profilini iletişim ve sektör bilgileriyle kaydedin.", "musteriler"],
  ["Müşteri düzenleme", "CRM & Müşteriler", "Firma, iletişim ve operasyon bilgilerini güvenli biçimde güncelleyin.", "musteriler"],
  ["Müşteri arşivleme ve geri yükleme", "CRM & Müşteriler", "Aktif olmayan müşterileri kalıcı silmeden arşivleyin ve gerektiğinde geri alın.", "musteriler"],
  ["Müşteri görünürlük ayarları", "CRM & Müşteriler", "Müşteri panelinde hangi rapor, ödeme, görev ve dosyanın görüneceğini yönetin.", "musteriler"],
  ["Müşteri paneli kullanıcısı oluşturma", "CRM & Müşteriler", "Firmaya bağlı güvenli müşteri hesabı ve panel erişimi oluşturun.", "kullanici-yonetimi"],
  ["Lead oluşturma ve düzenleme", "Satış Hunisi", "Potansiyel müşteriyi iletişim, sektör, skor ve takip bilgileriyle yönetin.", "satis-hunisi"],
  ["Kanban drag & drop", "Satış Hunisi", "Lead kartlarını onaylı sürükle-bırak akışıyla aşamalar arasında taşıyın.", "satis-hunisi"],
  ["Lead skorlama", "Satış Hunisi", "Sıcak, ılık ve soğuk lead skorlarını veri sinyallerine göre yorumlayın.", "satis-hunisi"],
  ["AI lead analizi", "Satış Hunisi", "Satın alma ihtimali, risk ve sonraki aksiyon önerisini üretin.", "satis-hunisi"],
  ["Gelir tahmini", "Satış Hunisi", "Teklif tutarlarını aşama olasılıklarıyla ağırlıklandırarak değerlendirin.", "satis-hunisi"],
  ["Lead müşteriye dönüştürme", "Satış Hunisi", "Kazanılan lead için duplicate kontrolüyle müşteri ve onboarding görevleri oluşturun.", "satis-hunisi"],
  ["Lead arşivleme", "Satış Hunisi", "Leadleri hard delete kullanmadan arşivleyip CRM üzerinden geri yükleyin.", "satis-hunisi"],
  ["Tahsilat ekleme", "Tahsilat & Karlılık", "Müşteri, tutar, vade, hizmet dönemi ve görünürlük bilgisiyle ödeme kaydı oluşturun.", "tahsilat"],
  ["Ödemeyi tahsil edildi işaretleme", "Tahsilat & Karlılık", "Bekleyen ödemeyi ödeme tarihiyle birlikte kapatın.", "tahsilat"],
  ["Vadesi geçen ödemeler", "Tahsilat & Karlılık", "Vade tarihi geçmiş açık tahsilatları filtreleyip takip edin.", "tahsilat"],
  ["Karlılık ekranı", "Tahsilat & Karlılık", "Gelir, gider, ödenen ve bekleyen tutar dengesini inceleyin.", "karlilik"],
  ["Tahsilat filtreleri", "Tahsilat & Karlılık", "Firma, durum, ödeme türü, ay ve yıl filtrelerini kontrollü uygulayın.", "tahsilat"],
  ["Görev oluşturma", "Görev Yönetimi", "Başlık, açıklama, öncelik, tarih ve sorumlu bilgisiyle görev açın.", "gorevler"],
  ["Görev atama", "Görev Yönetimi", "Görevi uygun ekip üyesine atayıp teslim tarihini belirleyin.", "gorevler"],
  ["Görev tamamlama ve tekrar açma", "Görev Yönetimi", "Tamamlanan görevi tarihçede koruyun veya yeniden açın.", "gorevler"],
  ["Otomatik satış görevleri", "Görev Yönetimi", "Teklif, takip ve onboarding aşamalarında üretilen görevleri yönetin.", "gorevler"],
  ["Müşteriye görünür görevler", "Görev Yönetimi", "Yalnız paylaşılması uygun görevleri müşteri paneline açın.", "gorevler"],
  ["Meta raporu oluşturma", "Raporlama Merkezi", "Meta kampanya metriklerinden dönemsel müşteri raporu hazırlayın.", "meta-analiz"],
  ["Google Ads raporu oluşturma", "Raporlama Merkezi", "Google Ads veya manuel performans verilerini raporlayın.", "google-analiz"],
  ["AI rapor yorumu", "Raporlama Merkezi", "Performans verilerinden Türkçe, ölçülü ve aksiyon odaklı yorum üretin.", "musteri-raporlari"],
  ["Executive rapor", "Raporlama Merkezi", "Teknik metrikleri müşteri dostu yönetici özetine dönüştürün.", "musteri-raporlari"],
  ["PDF Word Excel dışa aktarma", "Raporlama Merkezi", "Türkçe karakterleri koruyan rapor dosyalarını indirin.", "musteri-raporlari"],
  ["Meta Pixel kurulumu", "Meta Entegrasyonları", "Müşteri Pixel ID bilgisini kaydedip ölçümleme durumunu kontrol edin.", "entegrasyonlar"],
  ["Conversion API kurulumu", "Meta Entegrasyonları", "Sunucuda maskeli token ile CAPI test ve durum kontrolü yapın.", "entegrasyonlar"],
  ["Meta Test Event", "Meta Entegrasyonları", "Test Event Code ile gerçek müşteri verisi kullanmadan olay doğrulayın.", "entegrasyonlar"],
  ["Meta reklam hesabı bağlama", "Meta Entegrasyonları", "Business, Ads Account, Facebook Page ve Instagram hesaplarını firmaya eşleyin.", "reklam-hesabi-eslestirme"],
  ["Meta veri senkronizasyonu", "Meta Entegrasyonları", "Tarih aralığı seçip kampanya ve metrik verilerini güvenli biçimde çekin.", "meta-istihbarat"],
  ["Meta sorun giderme", "Meta Entegrasyonları", "Token, yetki, hesap ID ve veri dönemi sorunlarını teşhis edin.", "sistem-test-merkezi"],
  ["Google Ads müşteri hesabı", "Google Entegrasyonları", "Google Ads Customer ID ve MCC ilişkisini müşteriyle eşleyin.", "reklam-hesabi-eslestirme"],
  ["Google Analytics GA4", "Google Entegrasyonları", "Measurement ID ve property bilgisini analitik hazırlığı için kaydedin.", "entegrasyonlar"],
  ["Search Console hazırlığı", "Google Entegrasyonları", "Site sahipliği ve organik arama veri gereksinimlerini kontrol edin.", "entegrasyonlar"],
  ["Tag Manager ve dönüşüm takibi", "Google Entegrasyonları", "Etiket ve dönüşüm olaylarının isimlendirme planını yönetin.", "entegrasyonlar"],
  ["Müşteri keşfi", "HK Intelligence", "Şehir, ilçe ve sektör bazında işletme adayları bulun.", "musteri-kesfi"],
  ["Ajans Satış Operasyon Merkezi nedir?", "HK Intelligence", "Sektör fırsatlarını satış önceliği, tahmini gelir, kapanış olasılığı, pipeline durumu ve sonraki aksiyonla birlikte yönetin.", "musteri-kesfi"],
  ["Fırsatı İşlemeye Başla butonu ne yapar?", "HK Intelligence", "Seçilen sektör, alt sektör, şehir ve ilçe bilgisini İşletme Keşfi akışına aktarır ve uygun aramayı hazırlar.", "musteri-kesfi"],
  ["İşletme Keşfi butonu ne yapar?", "HK Intelligence", "Fırsat kartındaki filtreleri Google Maps müşteri bulma alanına taşır; kullanıcı sadece aramayı başlatır.", "musteri-kesfi"],
  ["AI Satış Analizi nasıl kullanılır?", "HK Intelligence", "Fırsat verilerinden AI Studio içinde sektör analizi, ilk görüşme planı, itiraz cevapları ve teklif stratejisi hazırlar.", "ai-studio"],
  ["Teklif Hazırla butonu nasıl çalışır?", "HK Intelligence", "Sektör, alt sektör, bütçe, paket, WhatsApp ve e-posta taslaklarını Teklif Motoru için hazırlar.", "teklif-hazirlama"],
  ["Pipeline durumları ne anlama gelir?", "HK Intelligence", "Keşfedildi, araştırılıyor, AI analizi hazır, teklif hazırlandı, ilk görüşme, takipte, kazanıldı ve kaybedildi aşamalarını satış sürecinde izleyin.", "musteri-kesfi"],
  ["Öncelik skoru nasıl yorumlanır?", "HK Intelligence", "Dijital eksiklik, reklam potansiyeli, işletme yoğunluğu, rekabet ve gelir sinyallerinden oluşan satış önceliğini okuyun.", "musteri-kesfi"],
  ["Kapanış olasılığı ne demektir?", "HK Intelligence", "Fırsatın tekliften müşteriye dönüşme ihtimalini yüzde olarak gösterir; yüksek değerler hızlı temas gerektirir.", "musteri-kesfi"],
  ["Tahmini aylık hizmet geliri nasıl okunur?", "HK Intelligence", "Fırsatın HK Dijital için üretebileceği olası aylık hizmet bedeli aralığını gösterir.", "musteri-kesfi"],
  ["Bugünün Ajans Öncelikleri kartı nasıl kullanılır?", "Dashboard & Kontrol Merkezi", "Dashboard üzerindeki sıcak lead, teklif, AI analiz ve görev sinyallerinden günlük satış aksiyonlarını seçin.", ""],
  ["Akıllı takip uyarıları ne zaman çıkar?", "HK Intelligence", "Tekliften sonra 3 gün, ilk görüşmeden sonra 2 gün işlem yoksa veya AI analizi hazır olduğu halde teklif yoksa takip önerisi görünür.", "musteri-kesfi"],
  ["Görev oluşturma akışı nasıl işler?", "Görev Yönetimi", "Fırsat kartından oluşturulan görev, sektör ve tahmini gelir bilgisiyle ajans görev listesine eklenir.", "gorevler"],
  ["CRM’e aktarılan fırsatlar nerede görünür?", "CRM & Müşteriler", "Fırsat Motoru kaynaklı kayıtlar CRM, Satış Hunisi ve Lead Workspace içinde sektör, şehir ve skor bilgisiyle izlenir.", "lead-analizi"],
  ["Mobil Operasyon Modu", "HK Intelligence", "Saha kullanımında fırsat kartlarını tek sütuna alır, butonları büyütür ve ana aksiyonları telefonda daha kolay kullanılacak hale getirir.", "musteri-kesfi"],
  ["Haritalar keşfi", "HK Intelligence", "Yerel işletme sinyallerini harita ve Google profili verileriyle inceleyin.", "haritalar"],
  ["Rakip analizi", "HK Intelligence", "Rakip görünürlüğü, reklam fırsatı ve önerilen aksiyonları karşılaştırın.", "rakip-analizi"],
  ["Lead workspace", "HK Intelligence", "Keşif sonuçlarını CRM ve teklif hazırlığına taşıyın.", "lead-analizi"],
  ["AI dijital denetim", "HK Intelligence", "Web, Instagram ve Google sinyallerinden denetim özeti üretin.", "ai-denetim"],
  ["AI Studio içerik üretimi", "AI Studio", "Marka, kanal ve hedefe göre kontrollü içerik taslağı üretin.", "ai-studio"],
  ["Prompt kullanımı", "AI Studio", "Tekrar kullanılabilir promptları bağlam ve çıktı beklentisiyle çalıştırın.", "prompt-uretimi"],
  ["AI sosyal medya planı", "AI Studio", "Sektör ve hedefe göre düzenlenebilir içerik takvimi hazırlayın.", "icerik-fikirleri"],
  ["Dosya yükleme", "Dosya & Belge Merkezi", "Dosya URL, tür, açıklama ve görünürlük bilgisiyle müşteri dosyası ekleyin.", "belgeler"],
  ["Dosya paylaşımı", "Dosya & Belge Merkezi", "Yalnız güvenli ve müşteri için uygun belgeleri görünür yapın.", "belgeler"],
  ["Kreatif Merkezi", "Dosya & Belge Merkezi", "Reklam görsellerini önizleme ve indirme için kreatif merkezine ekleyin.", "belgeler"],
  ["Kullanıcı rolleri", "Kullanıcı Yönetimi", "Admin, yönetici, editör ve müşteri rollerinin sınırlarını yönetin.", "kullanici-yonetimi"],
  ["Modül yetkileri", "Kullanıcı Yönetimi", "Ekip üyelerinin yalnız ihtiyaç duyduğu modüllere erişmesini sağlayın.", "kullanici-yonetimi"],
  ["Şifre ve hesap güvenliği", "Kullanıcı Yönetimi", "Geçici şifre, aktiflik ve güvenli hesap yönetimi uygulayın.", "kullanici-yonetimi"],
  ["SMTP ayarları", "Ayarlar", "Sistem e-postalarının sunucu bağlantısı ve gönderim durumunu yönetin.", "entegrasyonlar"],
  ["WhatsApp ayarları", "Ayarlar", "WhatsApp bağlantı kimliklerini ve hazır mesaj akışlarını yönetin.", "entegrasyonlar"],
  ["AI sağlayıcı ayarları", "Ayarlar", "OpenAI, Groq, Gemini ve fallback modunu güvenli biçimde yapılandırın.", "entegrasyonlar"],
  ["Sistem ayarları", "Ayarlar", "Performans, güvenlik, yedekleme ve uygulama tercihlerini yönetin.", "sistem-ayarlari"],
  ["Butonlar ve İşlem Mantığı", "Ayarlar", "Kaydetme, güncelleme, arşivleme, hata bildirimi ve kalıcılık davranışlarını doğrulayın.", "sistem-test-merkezi"],
  ["Logo ve marka yönetimi", "Web Site Yönetimi", "Public site logo, favicon ve marka metinlerini güncelleyin.", "web-sitesi-yonetimi"],
  ["Hizmet ve paket yönetimi", "Web Site Yönetimi", "Public sitedeki hizmet ve paket içeriklerini düzenleyin.", "web-sitesi-yonetimi"],
  ["İletişim ve sosyal bağlantılar", "Web Site Yönetimi", "Telefon, e-posta, adres ve sosyal medya bağlantılarını yönetin.", "web-sitesi-yonetimi"],
  ["Müşteri panelinde raporlar", "Müşteri Paneli", "Yayınlanmış ve görünür raporları müşteri gözüyle kontrol edin.", "musteriler"],
  ["Müşteri panelinde ödeme ve görevler", "Müşteri Paneli", "Yalnız görünür ödeme ve görev kayıtlarının doğru yansıdığını doğrulayın.", "musteriler"],
  ["Müşteri panelinde dosyalar", "Müşteri Paneli", "Paylaşılan belge ve kreatiflerin açılma ve indirme akışını kontrol edin.", "musteriler"],
  ["Pixel çalışmıyor", "Sorun Giderme", "Pixel ID, public sayfa kapsamı ve Events Manager test durumunu kontrol edin.", "sistem-test-merkezi"],
  ["Meta verisi gelmiyor", "Sorun Giderme", "Token, reklam hesabı, tarih aralığı ve yetki hatalarını sırasıyla inceleyin.", "sistem-test-merkezi"],
  ["Google Ads bağlanmıyor", "Sorun Giderme", "Customer ID, MCC, OAuth ve API yapılandırmasını doğrulayın.", "sistem-test-merkezi"],
  ["Müşteri giriş yapamıyor", "Sorun Giderme", "Kullanıcının aktifliği, firma bağı ve rolünü kontrol edin.", "kullanici-yonetimi"],
  ["Rapor veya export görünmüyor", "Sorun Giderme", "Rapor durumu, müşteri görünürlüğü ve dosya üretim sonucunu kontrol edin.", "musteri-raporlari"],
  ["Görev veya ödeme görünmüyor", "Sorun Giderme", "Arşiv, tarih, müşteri ve görünürlük filtrelerini kontrol edin.", "sistem-test-merkezi"],
  ["AI çalışmıyor", "Sorun Giderme", "Aktif sağlayıcı, model, API anahtarı ve demo fallback durumunu kontrol edin.", "sistem-test-merkezi"],
  ["Admin modülleri ve bakım yapısı", "Ayarlar", "AdminDashboard içindeki büyük modüllerin küçük bileşenlere nasıl ayrıldığını ve QA performans uyarılarının nasıl yorumlanacağını öğrenin.", "sistem-rehberi"],
  ["QA Center nasıl kullanılır?", "Ayarlar", "Sayfa, API, migration, env, güvenlik ve buton risklerini tek QA ekranından tarayın.", "qa-center"],
  ["HK Reklam Doktoru Pro nasıl yorumlanır?", "Raporlama Merkezi", "Reklam sağlık skoru, doktor teşhisleri, reçete aksiyonları, kreatif yorgunluğu ve müşteri özetini birlikte okuyun.", "ad-insights"],
  ["Görev şablonları nasıl kullanılır?", "Görev Yönetimi", "Onboarding, Pixel, rapor, teklif takip ve tahsilat hatırlatma görevlerini hazır şablondan oluşturun.", "musteriler"],
  ["Tekrarlayan görev nasıl oluşturulur?", "Görev Yönetimi", "Günlük, haftalık, aylık veya özel tekrar kuralı ile düzenli operasyon görevleri planlayın.", "musteriler"],
  ["Alt görev nedir?", "Görev Yönetimi", "Büyük işleri küçük kontrol maddelerine bölerek ana görevin altında takip edin.", "musteriler"],
  ["Reklam sağlık skoru ne anlama gelir?", "Raporlama Merkezi", "CTR, CPC, CPM, lead/mesaj sinyali, frekans ve bütçe verimliliğinden oluşan 0-100 performans puanını yorumlayın.", "ad-insights"],
  ["Boşa harcanan bütçe nasıl yorumlanır?", "Raporlama Merkezi", "Düşük CTR veya yüksek CPC sinyali veren reklam harcamasını durdurma, izleme veya kreatif yenileme kararı için kullanın.", "ad-insights"]
];

function slugify(value: string) {
  return value.toLocaleLowerCase("tr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const systemGuideSeeds: SystemGuideSeed[] = definitions.map(([title, category, description, route]) => ({
  slug: slugify(title),
  title,
  category,
  description,
  route: route ? `/hk-admin/${route}` : "/hk-admin",
  content: {
    purpose: description,
    whenToUse: `${title} işlemini uygulamanız veya ilgili kaydın doğru çalıştığını doğrulamanız gerektiğinde kullanılır.`,
    steps: [
      `${route ? `/hk-admin/${route}` : "/hk-admin"} ekranını yetkili hesabınızla açın.`,
      `${description} İlgili müşteri veya kaydı seçip mevcut bilgileri kontrol edin.`,
      "Değişiklikleri kaydetmeden önce görünürlük, tarih ve durum alanlarını doğrulayın; işlem sonucunu üst bildirimden kontrol edin."
    ],
    example: `${title} sırasında örnek bir kayıt üzerinde işlem yapın; kaydetme sonrasında listeyi yenileyerek sonucun kalıcı olduğunu doğrulayın.`,
    commonErrors: ["Yanlış müşteri veya tarih filtresiyle işlem yapmak.", "Kaydetmeden ekrandan ayrılmak ya da görünürlük alanını kontrol etmemek."],
    tips: ["Önce filtreleri temizleyip doğru kaydı seçin.", "Kritik değişikliklerden sonra ilgili müşteri panelini veya raporu kontrol edin."],
    warnings: ["Token, API anahtarı, dahili not veya müşteri için gizli bilgileri paylaşılabilir alanlara yazmayın.", "Silme yerine mevcutsa arşivleme akışını tercih edin."]
  }
}));
