# Akademi işletim ve yayınlama

## Kaynak üretimi

`import_content.py` iki PDF'nin bulunduğu dizini argüman olarak alır. `pypdf` yalnızca içerik ithalatında gerekir; uygulama bağımlılığı değildir. İthalat sonunda workbook kontrolleri ve ders blokları yeniden üretilir. `index.json` erişilebilir kayıtların izin listesidir; kaynak/cevap dosyaları public dizinine taşınmaz. `workflows.json` ve `editorial.json` editoryal olarak yönetilir ve ithalatta korunur.

## Veritabanı ve üyelik

Mevcut proje migration sistemiyle `20260905141717_academy_learning_platform.sql` uygulanmalıdır. Bu migration iki ek tablo oluşturur; mevcut kullanıcı rollerini değiştirmez ve herkesi otomatik üye yapmaz. Kullanıcı tarayıcısı veritabanı tablolarına doğrudan erişemez; sunucu service_role ile çalışır ve her istekte mevcut Supabase Auth kullanıcısını, aktif profilini ve akademi üyeliğini doğrular.

İlk akademi yöneticisi mevcut `public.users` hesabından açıkça seçilerek `academy_memberships` tablosuna `academy_admin` olarak kaydedilmelidir. İlk üye otomatik seçilmez. Ardından `/academy/admin` ekranından mevcut hesaplara üyelik verilebilir, üyelik kapatılabilir ve sonuçlar incelenebilir. Bu ekran yalnız `academy_admin` üyelerine açıktır. Gizli kısayol yetki vermez.

## Ortam

Yeni bir auth secret veya ayrı kimlik sağlayıcısı yoktur. Projenin mevcut `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ve `ADMIN_SESSION_SECRET` yapılandırması kullanılmalıdır. Service-role ve oturum secret'ı istemciye aktarılmaz.

Mevcut workspace'te gerçek deployment ortamı ve Supabase proje eşlemesi bulunmadığı için migration uygulanmadı. Bağlı Supabase hesabında listelenen tek proje INACTIVE ve repository ile eşleştirilemedi; o projeye değişiklik yapılmadı. Repository canonical alan adı ile istenen 11245911.com eşlemesi yayınlamadan önce mevcut Vercel projesinde doğrulanmalıdır.

## Doğrulama

- `npm run lint`
- `npx tsc --noEmit`
- `npm test`
- `npm run build`
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:4181 npm run test:e2e -- tests/e2e/academy.spec.ts`

Yetkili sözleşme testleri için `node tests/fixtures/academy-supabase.mjs` yalnız yerelde başlatılır. Fixture gerçek kampanya verisi veya production hesabı oluşturmaz. Uygulama yerel fixture URL'si ve fixture anahtarlarıyla production build üzerinden çalıştırılır; `ACADEMY_FIXTURE=1` ile `academy-learning.spec.ts` etkinleşir. Bu testler gerçek PostgreSQL/RLS ve production OAuth testi yerine geçmez.

## Yayınlama sırası

1. Kaynak denetimindeki açık maddeleri kapatın; tam kabul listesi henüz tamamlanmış değildir.
2. Doğru Supabase projesini mevcut production ortamıyla eşleştirin; migration geçmişini kontrol edip migration'ı uygulayın.
3. Seçilmiş mevcut hesaba ilk academy_admin üyeliğini verin.
4. Mevcut Vercel workflow'uyla doğrulanmış commit'i yayınlayın; mevcut kullanıcı değişikliklerini kapsam dışında bırakmayın veya yanlışlıkla değiştirmeyin.
5. Gerçek hesapla giriş/çıkış, kullanıcı izolasyonu, yetkisiz Data API engeli ve içerik cevap kilitlerini doğrulayın.

## Geri alma

Önce önceki uygulama deployment'ına dönün. Akademi tablolarını yedeklemeden silmeyin. Tablo kaldırılması gerekirse önce `academy_learning_state`, sonra `academy_memberships` kaldırılır; mevcut users/auth tablolarına cascade uygulanmaz. Normal uygulama rollback'i için veri tablolarını silmek gerekmez.

## Public repository ve şifreli içerik

GitHub repository'sinin public olduğu API üzerinden doğrulandı. Bu nedenle özel JSON dosyaları Git dışında tutulur. Repository yalnız AES-256-GCM ile doğrulanmış `content/academy.bundle.enc` paketini taşır. `npm run academy:pack` mevcut kaynak kayıtlarını paketler; anahtar yoksa `.env.academy.local` dosyasında 0600 izinleriyle oluşturur. Bu dosya ve açık JSON kayıtları `.gitignore` kapsamındadır; anahtar terminale basılmaz.

Yeni checkout için `ACADEMY_CONTENT_KEY` sunucu/build ortamına verilmelidir. `npm run academy:prepare` paketi çözer; `prebuild` de bunu çalıştırır. GitHub Actions'ta aynı isimli repository secret ve Vercel build ortamında aynı isimli server secret gereklidir. Secret ayarlanmadan fresh-checkout CI/deploy tamamlanamaz. Anahtarın yedeğini güvenli secret yönetiminde saklayın; kaybolursa paket çözülemez. Kaynaklar değişince `npm run academy:pack` tekrar çalıştırılır. Paketin içeriği public/statik asset dizinine taşınmaz.

Anahtar yalnız build/deployment tarafında bulunur. Üretilen açık içerik yalnız Next.js server çıktısında yer alır; istemci rotaları ve API'ler mevcut üyelik/sınav kilitlerini uygulamaya devam eder. Repository'ye açık içerik veya anahtar içeren commit gönderilmemelidir.
