-- Updates the living System Guide (system_guides table) to describe the new
-- 9-center admin navigation (Ana Merkez, Müşteri Yönetimi, Satış ve Keşif,
-- Operasyon, Reklam ve Performans, İçerik ve AI, Finans, Entegrasyonlar,
-- Sistem), replacing the stale 6-group description from the previous guide
-- migration. Safe to re-run: upserts by slug/name, never deletes existing
-- guide rows or categories.
-- NOT APPLIED to the live database from this environment (no Supabase
-- credentials configured here) — run manually in the Supabase SQL editor.

update public.system_guide_categories
set description = 'Yeni 9 ana merkezli admin kabuğu: sidebar, header, tema ve genel gezinme.'
where name = 'Arayüz ve Navigasyon';

insert into public.system_guides (slug, title, category, description, route, content, is_published)
values
(
  'yeni-sidebar-kullanimi',
  'Yeni Sol Menü (Sidebar) Kullanımı',
  'Arayüz ve Navigasyon',
  'Sol menü artık açılır/kapanır, renkli grup ikonlarına ve favori kısayollarına sahip; 9 ana merkeze indirgendi.',
  '/hk-admin',
  jsonb_build_object(
    'purpose', 'Sol menü, tüm admin modüllerine erişimin tek noktasıdır. Modüller artık en fazla 9 ana merkez altında toplanır, her merkez kendi rengiyle işaretlenir (Ana Merkez: turkuaz, Müşteri Yönetimi: zümrüt, Satış ve Keşif: mavi, Operasyon: indigo, Reklam ve Performans: turuncu, İçerik ve AI: mor, Finans: yeşil, Entegrasyonlar: slate, Sistem: lacivert).',
    'whenToUse', 'Herhangi bir modüle geçmek istediğinizde kullanın. Dar ekranlarda menü otomatik olarak drawer''a dönüşür.',
    'steps', jsonb_build_array(
      'Üst header''daki daraltma ikonuna tıklayarak menüyü daraltıp genişletebilirsiniz; tercihiniz tarayıcıda hatırlanır.',
      'Bir merkez başlığına tıklayarak o merkezdeki alt modülleri açıp kapatabilirsiniz.',
      'Mobilde sol üstteki menü ikonuna dokunarak tam ekran menüyü açabilirsiniz; dışarı dokunmak veya Esc tuşu menüyü kapatır.',
      'Sık kullandığınız modülleri üst header''daki Favoriler menüsünden yıldızlayarak kısayol listesine ekleyebilirsiniz.'
    ),
    'example', 'Müşteri kayıtlarına gitmek için sol menüde "Müşteri Yönetimi" merkezini açın ve "Müşteriler" öğesine tıklayın.',
    'commonErrors', jsonb_build_array('Menü daraltıldığında modül adları görünmez; ikon üzerine gelerek tam adı görebilirsiniz.'),
    'tips', jsonb_build_array('Menü durumu (açık/kapalı merkez, daraltılmış/genişletilmiş) tarayıcı bazında localStorage''da saklanır.', 'Eski bağlantılar (örn. eski modül adresleri) otomatik olarak doğru merkez altındaki sayfaya yönlendirilir; hiçbir işlevsellik kaldırılmadı.'),
    'warnings', jsonb_build_array()
  ),
  true
),
(
  '9-ana-merkez-yapisi',
  '9 Ana Merkez Yapısına Genel Bakış',
  'Arayüz ve Navigasyon',
  'Admin panelindeki tüm modüller artık 9 ana merkez altında toplanır. Her merkezin amacı ve kapsamı burada özetlenir.',
  '/hk-admin',
  jsonb_build_object(
    'purpose', 'Daha önce ayrı ayrı menü öğeleri olan onlarca modül, işlev benzerliğine göre 9 ana merkezde gruplandı: hiçbir modül silinmedi, yalnızca gruplama sadeleştirildi.',
    'whenToUse', 'Yeni admin kullanıcıların panele ilk kez giriş yaptığında veya bir modülü hangi merkezde bulacağını merak ettiğinde.',
    'steps', jsonb_build_array(
      'Ana Merkez: Günlük ajans özeti, KPI''lar ve HK Intelligence CEO karar masası.',
      'Müşteri Yönetimi: Müşteri kayıtları, Müşteri 360 profili, kurulum ve panel yetkileri.',
      'Satış ve Keşif: CRM, lead merkezi, müşteri keşfi, satış hunisi ve teklif takibi.',
      'Operasyon: Görevler, takip, iletişim merkezi ve günlük ajans iş akışları.',
      'Reklam ve Performans: Kampanyalar, reklam hesapları, Reklam Doktoru ve raporlama.',
      'İçerik ve AI: HK Asistan, Agent Hub, içerik/kreatif üretimi ve SEO araçları.',
      'Finans: Tahsilat, ödeme takibi ve kârlılık raporları.',
      'Entegrasyonlar: Meta, Google ve diğer dış servis bağlantıları.',
      'Sistem: Kullanıcı ve rol yönetimi, tema/görünüm, kalite ve sistem ayarları.'
    ),
    'example', 'Reklam Doktoru''nu bulmak için "Reklam ve Performans" merkezini açın.',
    'commonErrors', jsonb_build_array('Bir modülü eski menü konumunda arayıp bulamayabilirsiniz; üstteki "Komut paleti" veya arama ile modül adını yazarak da doğrudan ulaşabilirsiniz.'),
    'tips', jsonb_build_array('Rolünüze göre bazı merkezler (örn. Finans) görünmeyebilir; bu bir hata değil, yetki kısıtlamasıdır.'),
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
