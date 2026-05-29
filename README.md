# HK Dijital Marketing Center

HK Dijital için Next.js tabanlı Türkçe pazarlama sitesi, yönetim paneli ve müşteri paneli.

Canlı alan adı: `hkdijital.com.tr`

## Yerel Kurulum

```bash
npm install
cp .env.example .env.local
npm run dev
```

Yerel adres:

```text
http://localhost:3000
```

## Rotalar

- Public site: `/`
- Giriş: `/giris`
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
ADMIN_USERNAME=
ADMIN_PASSWORD=
ADMIN_SESSION_SECRET=

CUSTOMER_EMAIL=
CUSTOMER_PASSWORD=
CUSTOMER_NAME=
CUSTOMER_COMPANY_ID=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

OPENAI_API_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=
```

`SUPABASE_SERVICE_ROLE_KEY` kesinlikle tarayıcıya gönderilmez. Yazma işlemleri sunucu tarafındaki API route’ları üzerinden yapılır.

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

## Admin Kullanıcısı Oluşturma

Supabase `users` tablosuna bir kayıt ekleyin:

```sql
insert into public.users (email, full_name, role, is_active)
values ('admin@hkdijital.com.tr', 'HK Dijital Yönetici', 'admin', true);
```

Geçici şifre doğrulaması `.env` içindeki `ADMIN_PASSWORD` üzerinden yapılır. Üretimde Supabase Auth `signInWithPassword`, hashlenmiş şifre, rate limit ve rol bazlı yetkilendirme önerilir.

## Müşteri Oluşturma

1. `companies` tablosunda müşteri şirketini oluşturun.
2. `users` tablosuna `role = customer` ile kullanıcı ekleyin.
3. Kullanıcının `company_id` alanını ilgili şirketle eşleştirin.
4. `customer_visibility_settings` tablosunda müşterinin görebileceği alanları belirleyin.

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

- Supabase Auth tam oturumu yerine sunucu taraflı güvenli cookie ve environment password fallback’i vardır.
- API anahtarları admin arayüzünde alan olarak tutulabilir; üretimde encrypted secret storage önerilir.
- Admin panelindeki bazı karmaşık koleksiyonlar JSON/site_settings üzerinden saklanabilir; uzun vadede ayrı Supabase tablolarına taşınması önerilir.

## Vercel Yayınlama

1. Değişiklikleri GitHub’a push edin.
2. Vercel environment variables alanlarını doldurun.
3. Deploy alın.
4. `/giris`, `/hk-admin` ve `/musteri-paneli` rotalarını test edin.
