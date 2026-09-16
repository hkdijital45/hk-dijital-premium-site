# MediaCrew Web Sitesinde Kullanılan Skiller

> Bu site (mediacrewpro.com), Claude Code içinde bir dizi **skill** (uzman yetenek modülü) orkestra edilerek yapıldı.
> Aşağıda her skill'in **ne işe yaradığı**, **sitede tam olarak nerede kullanıldığı** ve **kendi yapay zekânda nasıl çağıracağın** yazıyor.
>
> Bir skill'i çağırmanın iki yolu var:
> 1. **Claude Code kullanıyorsan:** sohbete `/skill-adı` yaz (örn. `/gsap-scrolltrigger`) ya da işi tarif et; ilgili skill otomatik devreye girer.
> 2. **Başka bir yapay zekâ kullanıyorsan (ChatGPT, Cursor, Gemini vb.):** skill'in **"ne yaptığını"** anlatan cümleyi prompt'una ekle. Skiller aslında "uzmanlık talimatları"dır; aynı niyeti tarif edince benzer sonucu alırsın.

---

## 🏗️ Mimari & Çatı

### `frontend-architecture`
**Ne yapar:** Frontend kod tabanını büyüdükçe dağılmayacak şekilde kurar — özellik-öncelikli klasör yapısı, sunucu/istemci bileşen sınırı, veri katmanı, state yönetimi seçimi.
**Sitede:** `app/[locale]/...` App Router yapısı, `components/` (atmosphere / hero / projects / sections / layout / ui katmanları), `lib/` (portfolio, metadata, blog verisi), `constants/`, `hooks/`.
**Çağır:** *"Next.js App Router projesini özellik-öncelikli, ölçeklenebilir bir klasör mimarisiyle kur."*

### `react-best-practices`
**Ne yapar:** React/Next.js performans desenleri (Vercel mühendisliği) — gereksiz render'ı önleme, sunucu bileşenleri, bundle optimizasyonu.
**Sitede:** Animasyonların React state yerine **ref'lerle** sürülmesi (slider tek `gsap.ticker` döngüsü), sunucu bileşeni/istemci bileşeni ayrımı.
**Çağır:** *"Bu bileşeni React performans en iyi pratiklerine göre optimize et; animasyonu state yerine ref ile sür."*

---

## 🌍 Çok Dillilik & SEO

### `nextjs-i18n`
**Ne yapar:** next-intl ile çok dilli App Router sitesi — locale rotaları, mesaj dosyaları, statik render, hreflang, dil değiştirici.
**Sitede:** TR (varsayılan) + EN; `/hizmetlerimiz` ↔ `/services`, `/projeler` ↔ `/projects` gibi **yerelleştirilmiş yollar**; `messages/tr.json` & `messages/en.json`; `proxy.ts` middleware.
**Çağır:** *"next-intl ile TR varsayılan + EN, yerelleştirilmiş URL'ler ve hreflang alternatifleri olan çok dilli bir site kur."*

### `seo` + `seo-schema`
**Ne yapar:** Tam SEO altyapısı — metadata, canonical, Open Graph, `sitemap.xml`, `robots`, JSON-LD yapılandırılmış veri.
**Sitede:** `lib/metadata.ts` (dinamik başlık/açıklama/OG), `app/sitemap.ts` (tüm sayfalar + blog + proje detayları + hreflang), `components/seo/OrganizationSchema.tsx` (Organization JSON-LD).
**Çağır:** *"Her sayfaya canonical, OG, hreflang ekle; sitemap.ts ve Organization JSON-LD şeması üret."*

---

## 🎬 Animasyon & Hareket (bu sitenin kalbi)

> Aşağıdaki GSAP ailesi skilleri, `animasyon-promptlari/` klasöründeki her bir animasyon prompt'unun temelini oluşturur.

### `cinematic-web`  ⭐ (yön veren skill)
**Ne yapar:** Scroll ile sürülen, film hissi veren web deneyimleri yönetir — kamera koreografisi, tempo, süreklilik, "Apple/Awwwards gibi" dramatik geçişler. Mekanik değil, **sanat yönü** katmanıdır.
**Sitede:** Tüm sitenin "KADRAJ / alan derinliği" konsepti; hero'nun scroll ile açılması, sinematik proje slider'ı, bokeh atmosferi.
**Çağır:** *"Bu siteyi sinematik yap: scroll bir kamera hareketi gibi hissettirsin, sahneler tempoyla açılsın, film greni/alan derinliği havası olsun."*

### `gsap-core`
**Ne yapar:** GSAP temel API — `gsap.to/from/fromTo`, easing, süre, stagger, `gsap.matchMedia()` (responsive + reduced-motion).
**Sitede:** Neredeyse tüm giriş/hover animasyonları.

### `gsap-react`
**Ne yapar:** React'te GSAP — `useGSAP()` hook'u, ref'ler, otomatik temizlik.
**Sitede:** **11 bileşende** `useGSAP` ile animasyon kuruldu (hero, slider, servisler, bokeh, butonlar...).
**Çağır:** *"React'te useGSAP hook'u ile, unmount'ta temizlenen bir animasyon yaz."*

### `gsap-scrolltrigger`
**Ne yapar:** Scroll'a bağlı animasyon — pinning, scrub, start/end tetikleyicileri, parallax.
**Sitede:** Scroll ile sürülen hero intro ve reveal animasyonları.
**Çağır:** *"ScrollTrigger ile bu bölümü scroll'a scrub'la; girişte pin'le."*

### `gsap-timeline`
**Ne yapar:** Animasyon sıralama — `gsap.timeline()`, pozisyon parametresi, iç içe zaman çizelgeleri.
**Sitede:** Loader (aperture açılışı) ve çok adımlı giriş sekansları.

### `gsap-utils`
**Ne yapar:** Yardımcılar — `clamp`, `mapRange`, `interpolate`, `wrap`, `snap`, `random`.
**Sitede:** Slider'da sonsuz döngü indeksi (`wrap`), lerp/interpolasyon, değer eşleme.

### `gsap-performance`
**Ne yapar:** 60fps için — transform tercihi, layout thrash'i önleme, `will-change`, batching.
**Sitede:** Slider'ın tek render döngüsü, sadece `transform`/`opacity` animasyonu.

### `animate` (motion / Framer Motion)
**Ne yapar:** Sıfırdan animasyon kararları — animasyonun amacı, doğru özellik, eğri, süre, kesinti ve çıkış.
**Sitede:** `components/layout/Nav.tsx` menü/geçiş mikro-animasyonları (`motion` kütüphanesi).

---

## 🌊 Kaydırma & 3B / WebGL

### `lenis-smooth-scroll`
**Ne yapar:** Yumuşak (ataletli) kaydırma; GSAP ScrollTrigger ile senkron, route değişiminde sıfırlama.
**Sitede:** `hooks/useLenis.ts`, sinematik slider'ın scroll'a bağlanması, "yağ gibi" kayma hissi.
**Çağır:** *"Lenis ekle, ScrollTrigger ile senkronize et, reduced-motion'da devre dışı bırak."*

### `react-three-fiber`
**Ne yapar:** React içinde 3B/WebGL sahneleri — `<Canvas>`, `useFrame`, drei yardımcıları, shader materyalleri.
**Sitede:** **3 sahne** — `atmosphere/Bokeh.tsx` (alan derinliği partikülleri), `atmosphere/wave/WaveField.tsx` (dalga/shader), `hero/Hero.tsx`.
**Çağır:** *"React Three Fiber ile bir `<Canvas>` kur; useFrame ile her karede güncelle."*

### `threejs-shaders` / `threejs-materials` / `webgl-performance`
**Ne yapar:** GLSL shader'lar, materyaller ve WebGL performans optimizasyonu.
**Sitede:** Bokeh partikül sistemi ve dalga alanının shader/materyal katmanı.
**Çağır:** *"Bu R3F sahnesine özel bir shader materyali yaz ve düşük GPU maliyetiyle çalıştır."*

---

## 🎨 Tasarım, Tipografi & Responsive

### `frontend-design` / `high-end-visual-design` / `design-taste-frontend`
**Ne yapar:** Kasıtlı görsel yön (palet, tipografi, yapı, doku); "ucuz/şablon AI" görünümünü engeller; ajans seviyesi detay.
**Sitede:** Karanlık sinematik palet (void/abyss/petrol/teal/signal/neon), boşluk ritmi, kart yapıları, hover halleri.
**Çağır:** *"Şablon gibi durmayan, ajans seviyesi premium bir görsel yön kur; klişe AI desenlerinden kaçın."*

### `typography-system`
**Ne yapar:** Gerçek tipografik sistem — tip ölçeği, `clamp()` ile akışkan tipo, satır yüksekliği, ölçü, tabular rakamlar, font yükleme.
**Sitede:** `clamp()` ile akışkan başlıklar, `--text-label` etiket ölçeği, mono etiketler.

### `responsive-design`
**Ne yapar:** Breakpoint dağınıklığı olmadan uyarlanan düzenler — container query, akışkan boşluk/tip, mobil viewport (svh/dvh), responsive görseller.
**Sitede:** Mobil tek kolon hero servisleri, mobil slider kart boyutları, dikey/yatay proje görselleri.

### `web-video-encoding`
**Ne yapar:** Web için video kodlama/sıkıştırma (ffmpeg) — hero arka plan döngüleri, muted autoplay, scroll ile taranan **kare dizileri**, poster kareler.
**Sitede:** Hero mobil **77 kareli WebP dizisi** (cihazlar arası tutarlı), web-deneyimi kartlarındaki GIF benzeri döngü videoları (siyah bar kırpma), 2K scrubbed masaüstü video.
**Çağır:** *"ffmpeg ile hero için scroll'a taranan kare dizisi üret; videoları muted autoplay + faststart ile optimize et."*

---

## ♿ Erişilebilirlik (öneri)

### `wcag-audit`
**Ne yapar:** WCAG 2.2 AA denetimi — klavye/odak, kontrast, hareket ölçütleri (2.2.2, 2.3.3), `prefers-reduced-motion`.
**Sitede/öneri:** Yoğun animasyonlu bir site "sorumlu" biçimde yayınlanırken reduced-motion ve kontrast denetimi için kullanılır.
**Çağır:** *"Bu animasyon-yoğun siteyi WCAG 2.2 AA'ya göre denetle; reduced-motion ve kontrastı kontrol et."*

---

## ⚠️ Dürüst Notlar (yanlış yönlendirme olmasın)
- **`SplitText` kullanılmadı** — başlık harflerini tek tek animasyonlamak isteyen olursa `gsap-plugins` (SplitText) ayrıca eklenmeli.
- **İletişim formu şu an sadece frontend** (`onSubmit` istemcide çalışıyor, gerçek e-posta göndermiyor). Gerçek gönderim için `form-booking-backend` skill'i (Server Action + Resend + spam koruması) ayrıca kurulmalı.
- Bu site **TR/EN**; Arapça/RTL yok. Arapça eklenirse `rtl-arabic` gerekir.

---

*Sonraki dosya: `animasyon-promptlari/` klasörü — her animasyon için kendi yapay zekâna yapıştırabileceğin hazır prompt.*
