# HK Dijital Marketing Center

HK Dijital için Next.js tabanlı Türkçe pazarlama sitesi, yönetim paneli ve müşteri paneli.

Canlı alan adı: `hkdijital.com.tr`

## Yerel Kurulum

```bash
npm install
cp .env.example .env.local
npm run dev
```

Yerel geliştirme adresi:

```text
http://127.0.0.1:3000
```

## Rotalar

- Public site: `/`
- Giriş: `/giris`
- Şifre sıfırlama: `/sifre-sifirla`
- İlk kurulum: `/kurulum`
- Acil süper admin kurulumu: `/super-admin-kurulum`
- Yönetim paneli: `/hk-admin`
- Müşteri paneli: `/musteri-paneli`
- Hakkımda: `/hakkimda`
- Sertifikalar: `/sertifikalar`
- Hizmetler: `/hizmetler`
- Paketler: `/paketler`
- HK Intelligence: `/hk-intelligence`
- Teklif Al: `/teklif-al`
- İletişim: `/iletisim`

## Gerekli Ortam Değişkenleri

```env
ADMIN_SESSION_SECRET=
BOOTSTRAP_ADMIN_SECRET=
FORCE_BOOTSTRAP_ADMIN=false

CUSTOMER_EMAIL=
CUSTOMER_PASSWORD=
CUSTOMER_NAME=
CUSTOMER_COMPANY_ID=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=https://www.hkdijital.com.tr

OPENAI_API_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` kesinlikle tarayıcıya gönderilmez. Yazma işlemleri sunucu tarafındaki API route’ları üzerinden yapılır.

`NEXT_PUBLIC_SITE_URL` üretimde `https://www.hkdijital.com.tr` olmalıdır. Şifre sıfırlama e-postaları ve Supabase Auth yönlendirmeleri bu alan adını kullanır.

## macOS Desktop App

HK Dijital / HK Intelligence sistemi web sürümünü bozmadan Electron kabuğu içinde macOS masaüstü uygulaması olarak çalıştırılabilir. Masaüstü uygulaması public ana sayfayı açmaz; doğrudan yönetim sistemi akışına girer.

Masaüstü uygulamasının adı:

```text
HK Intelligence.app
```

Geliştirme modunda Next.js dev server başlatılır, localhost hazır olunca Electron penceresi açılır:

```bash
npm run dev:desktop
```

Sadece Electron kabuğunu çalıştırmak için:

```bash
npm run desktop
```

Yerel macOS uygulama klasörü oluşturmak için:

```bash
npm run build:desktop
```

DMG üretmek için:

```bash
npm run dist:mac
```

Üretim masaüstü uygulaması varsayılan olarak canlı web sürümünü yükler:

```text
https://www.hkdijital.com.tr
```

Farklı bir web adresi yüklemek için `HK_DESKTOP_APP_URL` değişkenini kullanın:

```bash
HK_DESKTOP_APP_URL=https://www.hkdijital.com.tr npm run desktop
HK_DESKTOP_APP_URL=http://127.0.0.1:3000 npm run desktop
```

Desktop açılış davranışı:

```text
HK Intelligence Desktop başlar
→ Kısa splash ekranı gösterilir
→ Oturum kontrol edilir
→ Admin oturumu varsa /hk-admin?desktop=1 açılır
→ Oturum yoksa /giris?desktop=1 açılır
```

Desktop modu public marketing sayfalarını uygulama penceresinde açmaz. Ana sayfa, hizmetler, paketler, sertifikalar ve iletişim gibi public sayfalar web sürümünde aynı şekilde kalır; masaüstü penceresi yönetim sistemi, CRM, raporlar, AI modülleri ve müşteri operasyonları için kullanılır.

İsteğe bağlı açılış modülü için `HK_DESKTOP_START_PAGE` kullanılabilir:

```bash
HK_DESKTOP_START_PAGE=dashboard npm run desktop
HK_DESKTOP_START_PAGE=crm npm run desktop
HK_DESKTOP_START_PAGE=social npm run desktop
HK_DESKTOP_START_PAGE=meta npm run desktop
HK_DESKTOP_START_PAGE=google npm run desktop
```

Electron uygulaması mevcut Next.js web uygulamasını yüklediği için CRM, Supabase, authentication, AI modülleri, Meta Analiz, Google Analiz, Sosyal İstihbarat Merkezi, PDF Audit, WhatsApp teklifleri, müşteri paneli ve yönetim paneli web sürümüyle aynı backend ve aynı Supabase veritabanını kullanır. Webde eklenen veri masaüstünde, masaüstünde eklenen veri webde görünür.

Güvenlik notları:

- API anahtarları Electron renderer içinde tutulmaz.
- Supabase service role key Electron tarafında gösterilmez.
- `contextIsolation: true`, `nodeIntegration: false` ve `sandbox: true` kullanılır.
- WhatsApp, e-posta ve sosyal medya dış bağlantıları varsayılan tarayıcı veya ilgili macOS uygulamasında açılır.
- `/hk-admin`, `/musteri-paneli` ve diğer HK Dijital iç rotaları Electron penceresi içinde kalır.

Kod imzalama ve notarization:

Yerel build unsigned olarak üretilebilir. Geniş dağıtım için Apple Developer Program, Xcode, geçerli Developer ID sertifikaları, hardened runtime ayarları ve Apple notarization süreci gerekir. Bu bilgiler yapılandırılmadan Apple notarization denenmez.

Gelecek mobil yol haritası:

- PWA
- Daha sonra Capacitor iOS wrapper

## Supabase Auth URL Ayarları

Supabase Dashboard içinde Authentication > URL Configuration bölümünde şu değerleri kullanın:

```text
Site URL: https://www.hkdijital.com.tr
Redirect URLs:
https://www.hkdijital.com.tr/giris
https://www.hkdijital.com.tr/auth/callback
https://www.hkdijital.com.tr/sifre-sifirla
https://www.hkdijital.com.tr/hk-admin
https://www.hkdijital.com.tr/musteri-paneli
```

Password reset e-postaları uygulama tarafında şu `redirect_to` değeriyle gönderilir:

```text
https://www.hkdijital.com.tr/sifre-sifirla
```

## Supabase Kurulumu

1. Supabase projesi oluşturun.
2. SQL Editor içinde [supabase/schema.sql](/Users/hayrikamali/Documents/Codex/2026-05-29/create-a-brand-new-premium-next/supabase/schema.sql) dosyasını çalıştırın.
3. Storage içinde `hk-dijital-media` bucket oluştuğunu kontrol edin.
4. Vercel Environment Variables bölümüne Supabase URL, anon key ve service role key değerlerini ekleyin.
5. Vercel’de yeniden deploy alın.

## Supabase Tabloları

Kurulum dosyası şu tabloları oluşturur:

- `users`
- `companies`
- `site_settings`
- `pages`
- `services`
- `packages`
- `certificates`
- `leads`
- `media_files`
- `campaigns`
- `campaign_metrics`
- `customer_updates`
- `customer_visibility_settings`
- `customer_files`
- `api_settings`
- `reports`
- `report_interpretations`

## İlk Yönetici Kullanıcısı Oluşturma

Supabase Auth kullanıcıları boşsa canlı sitede veya yerelde şu adrese gidin:

```text
/kurulum
```

Form ilk admin hesabını Supabase Auth üzerinde oluşturur ve `public.users` tablosuna `role = admin`, `is_active = true`, `auth_user_id = auth.users.id` eşleşmesiyle profil kaydı ekler.

Kurulum sayfası `public.users` içinde bir admin bulunduğunda kapanır ve şu mesajı gösterir:

```text
Kurulum tamamlandı. Bu sayfa artık kullanılamaz.
```

Mevcut tabloda `auth_user_id` yoksa `supabase/schema.sql` dosyasındaki migration bölümünü Supabase SQL Editor içinde çalıştırın:

```sql
alter table public.users add column if not exists auth_user_id uuid unique references auth.users(id) on delete cascade;
```

## Acil Süper Admin Onarımı

Normal admin girişi çalışmıyorsa geçici bootstrap sistemi kullanılabilir.

Vercel > Project Settings > Environment Variables alanına geçici olarak ekleyin:

```env
BOOTSTRAP_ADMIN_SECRET=uzun-rastgele-bir-anahtar
FORCE_BOOTSTRAP_ADMIN=true
```

Ardından şu sayfayı açın:

```text
/super-admin-kurulum
```

Form alanlarını doldurun:

- Ad Soyad
- E-posta
- Şifre
- Bootstrap Secret

Bu işlem şu kayıtları oluşturur veya onarır:

- Supabase Auth user
- `public.users` profil satırı
- `auth_user_id` bağlantısı
- `role = admin`
- `is_active = true`

Başarılı mesajdan sonra `/giris` ekranında “Yönetici” modunu seçerek giriş yapın. Giriş başarılı olduktan sonra Vercel’den şu iki değişkeni kaldırın:

```env
BOOTSTRAP_ADMIN_SECRET
FORCE_BOOTSTRAP_ADMIN
```

## Müşteri Oluşturma

1. `/hk-admin` içinde “Müşteriler” bölümünden şirketi oluşturun.
2. Aynı bölümde müşteri için “Müşteri giriş hesabı oluştur” formunu kullanın.
3. Firma atamasını seçin ve rolü `customer` bırakın.
4. “Müşteri Paneli Yönetimi” bölümünden görünürlük ayarlarını belirleyin.
5. Müşteri `/giris` ekranında “Müşteri” modunu seçerek `/musteri-paneli` rotasına girer.

## Kampanya ve Metrik Ekleme

Yönetim panelinde “Reklam Raporları” bölümünden kampanya ve metrik kayıtları girilebilir. Supabase tarafında doğrudan şu tablolar kullanılır:

- `campaigns`
- `campaign_metrics`

Çok kanallı raporlar için `Raporlama Merkezi` kullanılır. Meta Reklamları, Google Ads, Sosyal Medya Yönetimi ve Genel Dijital Performans raporları `reports` tablosuna; yapay zekâ destekli müşteri yorumları `report_interpretations` tablosuna kaydedilir. Canlı ortamda yeni raporlama özelliklerini kullanmadan önce güncel `supabase/schema.sql` dosyasını Supabase SQL Editor içinde çalıştırın.

Tarihli ajans notları `report_updates` tablosunda tutulur. Rapor e-postası göndermek için Vercel ortam değişkenlerine `RESEND_API_KEY` ve `REPORT_FROM_EMAIL` eklenmelidir. Bu değişkenler yoksa sistem gönderim yapılmış gibi davranmaz ve yapılandırma uyarısı verir.

Yüklenen raporların otomatik ayrıştırılmasında CSV biçimi desteklenir. XLS, XLSX ve PDF dosyaları için yöneticiye CSV dışa aktarma yönlendirmesi gösterilir. Excel, Word ve PDF rapor indirme işlemleri sunucu tarafında çalışır.
- `customer_updates`

Müşteri paneli sadece kendi `company_id` değerine bağlı kayıtları gösterir.

## Müşteri Görünürlüğü

`customer_visibility_settings` alanları:

- Kampanyalar görünsün
- Metrikler görünsün
- Bütçe görünsün
- Harcama görünsün
- Lead sayısı görünsün
- Strateji notları görünsün
- Yapılan çalışmalar görünsün
- Dosyalar görünsün
- İletişim kişisi görünsün

## Medya ve Dosya Yükleme

Canlı ortamda medya dosyaları Supabase Storage `hk-dijital-media` bucket’ına yüklenir.

Desteklenen türler:

- PNG
- JPG / JPEG
- SVG
- WebP
- PDF
- MP4

## Fallback / Demo Davranışı

Supabase ortam değişkenleri yoksa:

- Public site seed JSON’dan okunur.
- Yönetim panelinde uyarı gösterilir: “Supabase bağlantısı yapılandırılmadı. Canlı ortamda kaydetme çalışmaz.”
- Canlı ortamda local JSON’a yazılmaz.
- Müşteri paneli demo/fallback veriler gösterir.

## Bilinen Sınırlamalar

- Supabase Auth `password` girişi kullanılır; oturum bilgisi httpOnly ve imzalı cookie ile korunur.
- API anahtarları admin arayüzünde alan olarak tutulabilir; üretimde encrypted secret storage önerilir.
- Şifre sıfırlama e-postaları Supabase Auth üzerinden `https://www.hkdijital.com.tr/sifre-sifirla` adresine yönlendirilir.
- Admin panelindeki public site içerikleri `site_settings`, müşteri/kampanya/rapor verileri ilişkili Supabase tablolarında saklanır.

## Vercel Yayınlama

1. Değişiklikleri GitHub’a push edin.
2. Vercel environment variables alanlarını doldurun.
3. Deploy alın.
4. `/giris`, `/hk-admin` ve `/musteri-paneli` rotalarını test edin.
