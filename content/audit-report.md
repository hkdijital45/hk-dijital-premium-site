# İçerik Denetimi — 2026-09-05

## Kaynaklar ve doğrulama
- Ana kitap: 157 PDF sayfası, 14 modül.
- Workbook: 209 PDF sayfası.
- Dosya adları, sayfa sayıları ve SHA-256 kimlikleri: `academy/sources.json`.
- İçe aktarma: `scripts/academy/import_content.py`. Runtime PDF parse etmez.
- 390 kayıt: 73 teşhis kartı (20 Meta, 14 Google, 8 CRO, 10 sosyal medya, 10 SEO, 11 ajans); kaynakta TANIM etiketi bulunan 44 sözlük maddesinin tamamı.
- UI'daki sayfa numarası PDF dosyasının 1 tabanlı sayfasıdır. Kitabın basılı altbilgi numarası çoğunlukla bundan 1 küçüktür.
- Metin pypdf ile çıkarıldı; kaynak yerleşimindeki tabloların satır/sütunları ve okuma sırası henüz tüm sayfalarda görsel olarak doğrulanmadı. Metin aktarımı, editoryal onay anlamına gelmez.

## Doğrulanan kaynak içi farklılıklar
1. Final PDF s.166: GBP için “yorum yok”. PDF s.167: “3 yorum var”. İkisi aynı müşteri briefinde. Hangisinin esas alınacağına dair kaynakta tarih ayrımı bulunmuyor. Orijinal metin korunmuştur; tek ve doğrulanmış veri olarak kullanılamaz.
2. İstem 16 final adımı ve 7 puan kategorisi istiyor. Workbook PDF s.168'de 20 görev, s.178'de 6 kategori / 24 puan mevcut. Yapılandırılmış çalışma alanı 20 görevi ve 6 kaynak kategorisini korur. Bunlara uygulamaya ait olduğu açıkça belirtilen 7 yetkinlik öz değerlendirmesi eklendi; kaynak rubriği sessizce değiştirilmedi.
3. İlk 3 müşteri çalışması (PDF s.113–116), hazır puanlı farklı sektör prospect veritabanı sunmuyor. Kullanıcının sektör, ICP, 20 lead için kriter ve temas stratejisi üretmesini istiyor. Uydurma prospect veya başarı KPI'sı eklenmedi.
4. Teşhis kütüphanesinin 73 kartı “ÖNCE BAK / SONRA / YAPMA” biçiminde. Her birinde tam 7 aşamalı ayrı karar ağacı bulunmuyor. Uygulamadaki veri doğrulama, geriye dönüş ve yeniden ölçüm adımları arayüz uyarlamasıdır; kaynakta geçiyormuş gibi sunulmamalıdır.
5. Sözlük kaynakta 44 TANIM maddesi içeriyor. “Dev” başlığı madde sayısını artırmak için kullanılmadı.

## Teknik doğrulama bekleyen ifadeler
- Ana kitap PDF s.75'te “Teklif Tutarı × Kalite Puanı = Ad Rank” gösterimi var. 5 Eylül 2026 tarihinde [Google Ads resmi açıklaması](https://support.google.com/google-ads/answer/1722122?hl=en) doğrulandı: altı faktörlü model basit çarpımla temsil edilemez. Kaynak korunarak derse görünür editoryal düzeltme eklendi; `academy/editorial.json`.
- Frequency 1–2 gibi aralıklar, sektör CPA/CPC karşılaştırmaları ve öğrenme fazı süreleri evrensel eşik olarak kabul edilmemeli; bunlar kaynak eğitim bağlamıdır. Triage kullanıcı tarafından girilen hedef eşikleriyle çalışır.
- Final modelindeki sağlık hizmeti reklamları, önce/sonra görselleri ve ücretsiz muayene teklifleri güncel Türkiye sağlık tanıtım mevzuatına göre ayrıca doğrulanmalı. Bu kaynak metin üretim kampanyası onayı değildir.
- Kaynaktaki LTV/ROI/başabaş varsayımları ile hesaplayıcı girdileri editoryal olarak tek tek karşılaştırılmalı. LTV hesaplayıcısı gelir temelli basit modeli açıkça etiketler.

## Aktarım sınırları — tamamlanmış sayılmayanlar
- Tüm workbook egzersizleri bağımsız soru/opsiyon/eşleştirme/sıralama/tablo kontrollerine henüz ayrılmadı; bir bölümü kaynak çalışma sayfası ve yazılı karar alanı olarak sunuluyor.
- Her egzersize özel hızlı/açıklamalı cevap eşlemesi tamamlanmadı. Olmayan cevap üretilmiyor.
- 73 kartın her birine özel çok dallı teşhis mantığı henüz oluşturulmadı; ortak doğrulama akışı kullanılıyor.
- Müşteri görüşmesi kaynak repliklerinden uyarlanmış dallanan eğitim motorudur. Gerçek müşteri davranışı öngörmez; puanlama kural temelli ve açıkça etiketlidir.
- Ara sınavlar tek girişim altında birleştirildi. Otomatik puan yalnız kaynak anahtarından güvenle ayrıştırılan A–D / D–Y soruları kapsar. Açık uçlular öz değerlendirme gerektirir.
- Basılı kaynakta bulunan “Klinik Adı” ve benzeri şablon alanları orijinal model metnidir; uygulamaya ait sahte üretim verisi değildir.

## Güvenlik yaklaşımı
Cevaplar ayrı server-only dosyada. İçerik indeksinde cevap kayıtları yok. Üye olmayan API çağrısı içerik/sonuç döndürmez. Final modeli 20 alanlı çalışmanın gönderimine; sınav anahtarı girişimin bitmesine bağlanır. Canlı DB / RLS testi henüz yapılmadı.

## Ek kaynak çelişkisi
- Vaka 7.1, workbook PDF s.60: aynı metrik satırında “ortalama arama süresi 4 dakika” ile “personel genelde 24 saat içinde arıyor” birlikte kullanılıyor. Görüşme süresi ile lead'e dönüş süresi kastedilmiş olabilir, fakat kaynak bunu ayırmıyor. Ham metin korunmuştur; teşhiste tek bir yanıt süresi kabul edilmemeli.

## İlerleyen uygulama çalışması
- 80 egzersiz kaynak etiketlerinden ayrı seçim, doğru/yanlış, eşleştirme, sıralama, bütçe, tablo ve yazılı karar kontrollerine ayrıldı. Karma sayfalardaki seviye etiketlerinin soru bazında doğrulanması devam ediyor.
- 18 vaka bağlam alanları ve ayrı sorularla aşamalı çalışmaya dönüştürüldü.
- 73 teşhis kaydı yedi aşamalı akışta çalışıyor; farklı kontrol alanına geçme, hipotezi reddetme, veriye dönme ve yeniden ölçüm adımları var. Kontrol alanları kaynak metninden ayrıştırılır; kapsamlı klinik doğrulama yapılmış özel uzman sistem iddiası yoktur.
- Müşteri görüşmesine kaynak replik ve yaklaşımından uyarlanmış dallanan seçimler eklendi. Puanlar eğitim kurallarıyla hesaplanır, gerçek satış sonucu veya müşteri davranışı tahmini değildir.
- İlk üç müşteri alanındaki örnek işletmeler ayrı PDF vakalarından alınır. Önceliklendirme, kullanıcının verdiği kriter puanları ve kaynakta belirtilen 5/4/3 ağırlıklarıyla hesaplanır; işletmeler için uydurma hazır puan yoktur.

## Son doğrulamalar
- Karma seviye etiketleri, kaynak etiket adedi ile egzersiz adedi eşleşen sayfalarda egzersize atanır. Atama belirsizse tek egzersize seviye uydurulmaz.
- Ana kitap anlatımı, karşılaştırma/uygulama notları ve özet ayrı içerik bloklarına dönüştürüldü. Ham metin de kaynak denetimi için korunur. Tabloların tamamının hücresel dönüşümü halen editoryal QA gerektirir.
- Sağlık Bakanlığının [12 Kasım 2025 yönetmelik duyurusu](https://shgmdenetimdb.saglik.gov.tr/TR-111587/saglik-hizmetlerinde-tanitim-ve-bilgilendirme-faaliyetleri-hakkinda-yonetmelik-yayimlanmistir.html) doğrulandı; finale güncellik notu eklendi. Bu kontrol tüm senaryo önerilerinin hukuki uygunluğunun doğrulandığı anlamına gelmez.
- Net kârın negatif olabildiği kâr marjı girdisi düzeltildi; diğer maliyet/adet girdileri negatif olamaz.

## Yayın gizliliği
Repository public olduğu doğrulandığından kaynak JSON'ları ve cevaplar Git'e eklenmez. AES-256-GCM şifreli paket ve ayrı build secret kullanılır. Açık JSON dosyaları sadece yetkili yerel/build ortamında hazırlanır. 66 unit testinin içinde yanlış anahtar, değiştirilmiş paket ve dosya yolu saldırısının reddi de doğrulanır.
