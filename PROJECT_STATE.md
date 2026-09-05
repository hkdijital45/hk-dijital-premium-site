# Dijital Pazarlama Akademisi — Çalışma Durumu

## Mimari ve audit
- Next.js 16.2.6 App Router, React 19.2.4, TypeScript, Tailwind 4, npm; mevcut mimariye entegre. Yeni runtime bağımlılığı yok.
- Supabase Auth REST + mevcut HMAC/httpOnly oturum. Akademi ayrıca canlı token, aktif profil ve aktif academy_memberships kontrol eder; hata halinde erişimi kapatır.
- Kaynak domain hkdijital.com.tr; istenen 11245911.com eşleşmesi doğrulanmadı.
- Önceden mevcut globals.css/admin shell/admin E2E değişiklikleri korunuyor.

## Tamamlanan uygulama
- 14 modül / 390 özel kaynak kaydı / 73 teşhis / 44 sözlük / 80 ayrıştırılmış egzersiz / 18 aşamalı vaka.
- Gizli Ctrl/Meta+Shift ile fiziksel 1,1,2 dizisi; public nav ve sitemap bağlantısı yok; private/no-store/noindex/noarchive; akademide Pixel kapalı.
- Akademi shell, katalog, global arama, ders blokları, typed workbook kontrolleri, vakalar, sınav zamanlayıcı/işaretleme/sunucu puanlama, yedi aşamalı teşhis, triage, 16 formül.
- Kaynak işletmelerle ilk üç müşteri önceliklendirmesi; dallanan görüşme; kaynak 20 alanlı final ve 6 kategori öz değerlendirme.
- DB'de ilerleme, taslak, cevap, sınav, tekrar, not, yer imi; gerçek sonuçlardan dashboard/12 yetkinlik alanı.
- Akademi admin üyelik ve sonuç ekranı; ayrı yetki kontrolü.

## Kritik dosyalar
- src/lib/academy, src/components/academy, src/app/academy, src/app/api/academy
- content/academy/index.json izin verilen kaynak kayıtlarının tek listesi; solutions.json cevapları sadece sunucuda.
- scripts/academy/import_content.py, structure_workbook.py, structure_lessons.py
- content/audit-report.md ve content/academy/editorial.json

## QA
- 64 unit testi, lint ve typecheck geçti (son ders/editoryal değişiklikler için yeniden kontrol gerekli).
- İlk 18 desktop/mobile E2E geçti. Ek tam final/rubrik testi iki cihazda geçti; görüşme testi iki cihazda geçti.
- Son eklenen hesaplar arası izolasyon testi ve tüm son değişikliklerle build/E2E sırada.
- Auth testleri yerel Supabase REST fixture kullanır; canlı PostgreSQL/RLS testi değildir.
- Orijinal node_modules cloud/dataless okumaları takılıyor. Aynı package-lock ile /tmp/hk-academy-qa.rmqYtR içinde npm ci yapıldı; kullanıcı değişiklikleri ve görev dosyaları bu QA kopyasına aktarılıyor.
- Geçici görsel QA route'u silindi; üretim kodunda auth bypass yok.

## Migration / deployment
- supabase/migrations/20260905141717_academy_learning_platform.sql hazır, uygulanmadı. Additive iki tablo, RLS, anon/authenticated erişimi kapalı, sadece server service_role.
- Yerel gerçek Supabase/Vercel env veya project link yok.
- Supabase connector list_projects yalnız bir INACTIVE, repo ile eşleştirilemeyen proje döndürdü. Bu projeye değişiklik yapılmadı.
- Commit/push/deploy henüz yapılmadı. Mevcut kullanıcı değişiklikleri commit kapsamından ayrı tutulmalı.

## Kalan önemli işler
- Her egzersize özel hızlı/açıklamalı çözüm eşlemesi: kaynakta olmayan cevaplar üretilmedi. Otomatik puanlama yalnız güvenilir kaynak anahtarları için.
- Tüm PDF tablolarının hücre ve okuma sırası editoryal doğrulaması.
- 73 teşhis için ayrı uzman karar ağacı doğrulaması; mevcut ortak yedi aşamalı kaynak uyarlaması bunun yerine tamamlanmış sayılamaz.
- Kaynağın 6 final puan kategorisi ile istenen 7 yetkinlik kategorisinin açıklanmış eşlemesi.
- Canlı migration, gerçek auth/RLS ve production domain/deploy doğrulaması.
- Son build/test raporu ve kabul listesi. Ürün tüm kabul maddeleriyle tamamlanmış değildir.

## Son QA ve gizlilik denetimi
- Şifreli içerikten temiz QA hazırlığı geçti: 397 özel JSON kaydı AES-256-GCM paketinden açıldı. Açık JSON ve anahtar Git dışında.
- GitHub repo API'si `private:false` döndürdü. Bu nedenle eğitim kaynakları `content/academy.bundle.enc` içinde tutuluyor. `.env.academy.local` yalnız yerel anahtar; terminale yazılmadı, staged secret taraması geçti.
- CI'ya private content prepare adımı eklendi. GitHub Actions ve Vercel'de `ACADEMY_CONTENT_KEY` secret tanımlanmadan fresh checkout yayını yapılamaz.
- 66 unit testi, tam lint ve production build geçti. Akademi + mevcut public site E2E: 62 geçti, mevcut gerçek QA kimlik bilgileri olmadığı için 4 eski auth testi atlandı.
- İlave academy_admin üyelik kapatma / kendi erişimini koruma testleri desktop ve mobile'da geçti (2 test). Fixture PostgREST active filtresi düzeltildi; bu gerçek RLS testi değildir.
- Tam finalin 20 alanı, kaynak 6 rubriği ve ek 7 yetkinlik puanı kayıt altında. İlerleme ekranı 7 yetkinliği ayrı gösteriyor.
- Sınav Merkezi ana kitap mini quizlerini de listeliyor. Egzersizler ayrı katalog. Sözlük Türkçe alfabetik sıralı.
- Son görsel QA: desktop dashboard, ders ve mobile dashboard; 393px'de yatay taşma yok. Ders paragrafları yeniden akıtıldı; kitap s.7 karşılaştırması kaynak metinden elle doğrulanmış tabloya dönüştürüldü. Diğer tabloların tamamı hücre bazında doğrulanmış sayılamaz.
- Branch: codex/digital-marketing-academy. Yalnız görev dosyaları staged; kullanıcının mevcut admin/global değişiklikleri stage dışında.
