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
