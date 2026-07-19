-- Updates the living System Guide (system_guides table) to describe the new
-- premium admin shell (collapsible sidebar, dark mode, redesigned dashboard,
-- redesigned Müşteriler screen). Safe to re-run: upserts by slug, never
-- deletes existing guide rows or categories.
-- NOT APPLIED to the live database from this environment (no Supabase
-- credentials configured here) — run manually in the Supabase SQL editor.

insert into public.system_guide_categories (name, description, sort_order)
values ('Arayüz ve Navigasyon', 'Yeni admin kabuğu: sidebar, header, tema ve genel gezinme.', 0)
on conflict (name) do nothing;

insert into public.system_guides (slug, title, category, description, route, content, is_published)
values
(
  'yeni-sidebar-kullanimi',
  'Yeni Sol Menü (Sidebar) Kullanımı',
  'Arayüz ve Navigasyon',
  'Sol menü artık açılır/kapanır, renkli grup ikonlarına ve favori kısayollarına sahip.',
  '/hk-admin',
  jsonb_build_object(
    'purpose', 'Sol menü, tüm admin modüllerine erişimin tek noktasıdır. Her grup kendi rengiyle işaretlenir (Operasyon: cam göbeği, Müşteriler: zümrüt, Reklam: turuncu, İçerik ve AI: mor, Finans: yeşil, Sistem: lacivert).',
    'whenToUse', 'Herhangi bir modüle geçmek istediğinizde kullanın. Dar ekranlarda menü otomatik olarak drawer''a dönüşür.',
    'steps', jsonb_build_array(
      'Üst header''daki daraltma ikonuna tıklayarak menüyü daraltıp genişletebilirsiniz; tercihiniz tarayıcıda hatırlanır.',
      'Bir grup başlığına tıklayarak o gruptaki modülleri açıp kapatabilirsiniz.',
      'Mobilde sol üstteki menü ikonuna dokunarak tam ekran menüyü açabilirsiniz; dışarı dokunmak veya Esc tuşu menüyü kapatır.',
      'Sık kullandığınız modülleri üst header''daki Favoriler menüsünden yıldızlayarak kısayol listesine ekleyebilirsiniz.'
    ),
    'example', 'Müşteriler ekranına gitmek için sol menüde "Müşteriler" grubunu açın ve "Müşteriler" öğesine tıklayın.',
    'commonErrors', jsonb_build_array('Menü daraltıldığında modül adları görünmez; ikon üzerine gelerek tam adı görebilirsiniz.'),
    'tips', jsonb_build_array('Menü durumu (açık/kapalı grup, daraltılmış/genişletilmiş) tarayıcı bazında localStorage''da saklanır.'),
    'warnings', jsonb_build_array()
  ),
  true
),
(
  'karanlik-mod-kullanimi',
  'Karanlık Mod (Dark Mode)',
  'Arayüz ve Navigasyon',
  'Admin panelinin tamamı açık ve koyu temayı destekler; tercih cihazınızda saklanır.',
  '/hk-admin',
  jsonb_build_object(
    'purpose', 'Uzun süre ekran başında çalışırken göz yorgunluğunu azaltmak için koyu tema sunulur.',
    'whenToUse', 'Düşük ışıklı ortamlarda veya tercihen her zaman kullanılabilir.',
    'steps', jsonb_build_array(
      'Üst header''ın sağındaki ay/güneş ikonuna tıklayın.',
      'Tema anında değişir ve tarayıcınızda hatırlanır; bir sonraki girişte otomatik uygulanır.',
      'İlk girişte sistem temanız (işletim sisteminizin açık/koyu ayarı) otomatik algılanır.'
    ),
    'example', 'Akşam çalışırken ay ikonuna tıklayıp koyu temaya geçebilirsiniz.',
    'commonErrors', jsonb_build_array('Bazı eski ekranlarda (örn. Müşteri 360 profili gibi henüz yenilenmemiş bölümler) koyu temada kontrast düşük olabilir; bu bilinen bir eksik olup aşamalı olarak giderilmektedir.'),
    'tips', jsonb_build_array(),
    'warnings', jsonb_build_array()
  ),
  true
),
(
  'yeni-dashboardu-anlamak',
  'Yeni Dashboard''u Anlamak',
  'Arayüz ve Navigasyon',
  'Dashboard artık tek parça değil; günlük özet, KPI, öncelikli aksiyonlar, finans, satış hunisi, reklam performansı ve AI önerileri ayrı bölümler halinde sunulur.',
  '/hk-admin',
  jsonb_build_object(
    'purpose', 'Girişte ajansın günlük durumunu tek bakışta görmek: kritik görevler, geciken tahsilatlar, riskli müşteriler, satış hunisi ve reklam performansı.',
    'whenToUse', 'Her gün işe başlarken ilk açılan ekrandır.',
    'steps', jsonb_build_array(
      'Üstteki karşılama alanından "Hızlı İşlem" menüsüyle sık kullanılan aksiyonlara ulaşın.',
      'Günlük Özet KPI kartlarına tıklayarak ilgili modüle doğrudan geçebilirsiniz.',
      '"Bugün ne yapmalıyım?" bölümü görev, tahsilat, lead ve entegrasyon sinyallerini önem sırasına göre listeler.',
      'Alt kısımdaki "Detaylı analiz ve operasyon araçları" bölümünü açarak büyüme motoru, senaryo simülasyonu ve CEO kokpiti gibi ileri düzey araçlara ulaşabilirsiniz.'
    ),
    'example', 'Geciken bir tahsilatı görmek için Günlük Özet''teki "Geciken tahsilatlar" kartına tıklayın; sizi doğrudan Tahsilat ekranına götürür.',
    'commonErrors', jsonb_build_array(),
    'tips', jsonb_build_array('Dashboard''u Düzenle butonuyla hangi bölümlerin görüneceğini kişiselleştirebilirsiniz.'),
    'warnings', jsonb_build_array()
  ),
  true
),
(
  'musteriler-ekraninin-yeni-hali',
  'Müşteriler Ekranının Yeni Hali',
  'Arayüz ve Navigasyon',
  'Müşteriler listesi yeni arama, filtre ve durum rozeti sistemiyle yeniden tasarlandı.',
  '/hk-admin/musteriler',
  jsonb_build_object(
    'purpose', 'Aktif, pasif, arşivli ve silinen müşterileri tek ekrandan aramak, filtrelemek ve yönetmek.',
    'whenToUse', 'Bir müşteri kaydını bulmak, yeni firma eklemek veya toplu işlem yapmak istediğinizde.',
    'steps', jsonb_build_array(
      'Üstteki büyük arama kutusuna firma adı, telefon, e-posta veya sektör yazın.',
      'Hızlı filtre etiketlerinden (Aktif, Pasif, Ödemesi geciken, Riskli müşteri vb.) birini veya birkaçını seçin.',
      'Sağlık/öncelik ve kayıt türü filtreleriyle listeyi daraltın.',
      'Müşteri kartındaki renkli durum rozetlerinden (Giriş, Sağlık skoru) durumu hızlıca görün.',
      'Kart üzerindeki aksiyon butonlarıyla (Müşteri detayını aç, WhatsApp, Görev oluştur vb.) doğrudan işlem yapın.'
    ),
    'example', 'Ödemesi geciken müşterileri görmek için "Ödemesi geciken" hızlı filtresine tıklayın.',
    'commonErrors', jsonb_build_array(),
    'tips', jsonb_build_array('Sonuç bulunamadığında ekrandaki "Filtreleri Temizle" butonunu kullanın.'),
    'warnings', jsonb_build_array()
  ),
  true
)
on conflict (slug) do update set
  title = excluded.title,
  category = excluded.category,
  description = excluded.description,
  route = excluded.route,
  content = excluded.content,
  is_published = excluded.is_published,
  updated_at = now();
