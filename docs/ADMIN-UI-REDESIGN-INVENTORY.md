# HK Dijital Admin UI — Eksiksiz Envanter ve Yeniden Tasarım Durumu

**Bu görevin başlangıç SHA'sı:** `54372f9be42542e22e67b853e14d4d57d1d5ecb9` (önceki dashboard/Müşteriler redesign turunun bitiş commit'i)
**Önceki turun final commit SHA'sı:** `54372f9be42542e22e67b853e14d4d57d1d5ecb9` (push doğrulandı, `origin/main` ile eşit)
**Bu envanter dosyasının oluşturulduğu commit:** aşağıdaki "GIT VE PUSH" bölümünde verilecek

**Yöntem:** Bu envanter `src/lib/admin-navigation.ts` (navigasyon registry), `src/components/admin/AdminDashboard.tsx` (11.590 satır — modül switch yapısı), `src/app/hk-admin/**` (route dosyaları), ve admin/*.tsx / admin/customer-profile/*.tsx dosyalarının tamamının taranmasıyla çıkarılmıştır. Bir ekranın "canlı" sayılması için: (a) nav registry'de bir `item.label` olarak bulunması VEYA (b) dosya içinde en az bir `setActive("<label>")` çağrısına hedef olması VEYA (c) kendi route dosyası üzerinden doğrudan erişilebilir olması gerekir. Sadece dosyada bir `function X()` bulunması yeterli sayılmamıştır.

---

## 1. ÖZET SAYILAR

| Metrik | Değer |
|---|---|
| Toplam kaynak navigasyon grubu (`adminNavigationSourceGroups`) | 11 |
| Toplam görünen sidebar grubu (`adminNavigationGroups`, kaynak gruplar 6'ya birleştirilir) | 6 |
| Toplam navigasyon registry öğesi (`adminNavigationItems`) | 77 (74 benzersiz etiket — birkaçı dedupe ediliyor) |
| `AdminDashboard.tsx` içindeki modül-render switch koşulu | 89 (satır 797–885) |
| Switch içinde en az bir CANLI etiketi olan koşul | 61 |
| Switch içinde **tamamen ölü** (hiçbir canlı yolu olmayan) koşul | 28 |
| Toplam ölü/erişilemez legacy etiket (switch içinde kontrol edilen ama hiçbir yerden tetiklenmeyen) | 89 |
| Toplam modal | ~30 |
| Toplam drawer | ~11 |
| Toplam bağımsız (`AdminDashboard` dışı) route sayfası | 9 (bunlardan 4'ü **shell'siz**, bkz. §6) |
| Sekmeli ("hub") bileşen sayısı | 8 (AgentHubCenter, MapsIntelligence, UsersAdmin, AccountingCenter, WebsiteManagementCenter, CustomerDetailDrawer, CustomerProfileModal, BlogSeoCenter) |
| Bu hub'lardaki toplam sekme | ~97 (örtüşen amaçlar dahil, benzersiz değil) |
| **Tamamen yenilenen canlı ekran** | 2 (Dashboard, Müşteriler) |
| **Ortak component sistemiyle yapısal yenilenen ekran** | 2 (yukarıdakiyle aynı — `admin/ui/*` + `admin/dashboard/*` kullanıyor) |
| **Bilinçli korunan özel ekran** | 0 |
| **Yenilenemedi — somut teknik/kapsam nedenle** | Kalan tüm canlı ekranlar (bkz. §4, §5, §6) |
| Playwright ile production build'e karşı doğrulanan ekran | 13 (Dashboard, Müşteriler + 7 shell-sarmalı ekran + 4 standalone sayfa — hepsi 200 döndü, console/page hatası yok) |
| Mobilde (390px) tam test edilen ekran | 2 (Dashboard, Müşteriler — 6 breakpoint'in tamamında) |
| Dark mode derinlemesine doğrulanan ekran | 2 (Dashboard, Müşteriler — computed style ile doğrulandı) |

---

## 2. NAVİGASYON MİMARİSİ — NASIL ÇALIŞIYOR

- `src/lib/admin-navigation.ts`: 11 kaynak grup → `navigationGroupPlan` ile 6 görünen sidebar grubuna birleştiriliyor (Operasyon, Müşteriler, Reklam, İçerik ve AI, Finans, Sistem).
- Her nav öğesi `{ label, slug, module, description }`. Sidebar/mobil nav bu öğeleri gerçek `<Link href="/hk-admin/{slug}">` olarak render ediyor (yani sayfa geçişi = tam route değişimi, `active` state'i URL'den geliyor).
- `src/app/hk-admin/[module]/page.tsx`: dinamik catch-all — `getAdminSectionBySlug(slug)` ile nav registry'den `section` bulur, `requireModuleAccess(section.module)` ile yetki kontrolü yapar, `<AdminDashboard initialActive={section.label} .../>` render eder.
- `AdminDashboard.tsx` içinde `active` state'i (başlangıçta `initialActive`) 89 adet `{active === "X" && <Component/>}` koşuluyla hangi bileşenin render edileceğini belirliyor. Bu koşullardan bazıları `setActive(...)` çağrılarıyla (dashboard içi navigasyon: KPI kartı tıklama, "Müşterilere Git" butonu vb.) da tetiklenebiliyor.
- **Kritik mimari not:** 9 slug (`ad-insights`, `agent-hub`, `blog-seo`, `customers/onboarding`, `google-integrations`, `meta-integrations`, `qa-center`, `website-analytics`) kendi statik `page.tsx` dosyasına sahip; Next.js App Router'da statik segment her zaman `[module]` dinamik segmentini yener, yani bu 9 slug **hiçbir zaman** `[module]/page.tsx` üzerinden geçmez, doğrudan kendi dosyalarından render edilir. Bunlardan 5'i yine `AdminDashboard`'ı çağırıyor (dolayısıyla shell'e sahip); **4'ü tamamen bağımsız, shell'siz** (bkz. §6 — en kritik bulgu).

---

## 3. NAVİGASYON GRUPLARI VE ÖĞE SAYILARI

| Görünen Sidebar Grubu | Kaynak Gruplar | Öğe Sayısı |
|---|---|---|
| Operasyon | Kontrol Merkezi + Ajans Operasyonu | 8 + 8 = 16 |
| Müşteriler | Müşteri Merkezi + CRM Merkezi | 5 + 9 = 14 |
| Reklam | Reklam & Performans + Rapor Merkezi | 12 + 6 = 18 |
| İçerik ve AI | Yapay Zekâ Merkezi + İçerik & Medya | 4 + 5 = 9 |
| Finans | Muhasebe | 6 |
| Sistem | Entegrasyonlar + Ayarlar | 7 + 7 = 14 |
| **Toplam** | | **77** |

---

## 4. TAM EKRAN ENVANTERİ (canlı, nav-registry veya setActive ile erişilebilir)

Sütunlar: Ekran adı · Slug/route · Render eden gerçek dosya · Parent grup · Kullanıcı yetkisi (module) · Mevcut tasarım durumu · Yenileme durumu · Dark mode · Mobil · Notlar

> Not: `AdminDashboard.tsx` içindeki tüm bileşenler dosyanın kendisi (`src/components/admin/AdminDashboard.tsx`) içinde "inline" tanımlı olduğu için "Render eden dosya" sütununda ayrıca belirtilmedikçe hepsi bu dosyadır.

### 4.1 Operasyon grubu

| Ekran | Slug | Bileşen | Yetki (module) | Tasarım durumu | Yenileme | Dark mode | Mobil | Not |
|---|---|---|---|---|---|---|---|---|
| Dashboard | `` (kök) | `HKAutonomousAgencyCenter(compact)` + `IntelligenceMvpPanel(compact)` + `Overview`→`DashboardOverview` | dashboard | **Yenilendi** | **Tamamen yenilendi** | ✅ Doğrulandı (computed style) | ✅ 6 breakpoint | `HKAutonomousAgencyCenter`/`IntelligenceMvpPanel` compact modları bu turda dokunulmadı — hâlâ eski hardcoded stil |
| HK Intelligence CEO | `hk-intelligence-ceo` | `HKAutonomousAgencyCenter` (tam mod) | hk-intelligence-ceo | Eski (premium CSS katmanı var, JSX değişmedi) | Yenilenemedi | Kısmi (globals.css genel token'ları alıyor, component-özel dark yok) | Test edilmedi | Büyük dosya (`HKAutonomousAgencyCenter.tsx`), 4 iç modal barındırıyor (§7) |
| QA Merkezi | `qa-center` | `QaCenter` (import, ayrıca kendi static route'u da var: `/hk-admin/qa-center`) | qa-center | Eski | Yenilenemedi | Kısmi | Playwright: 200, hatasız | — |
| Sistem Sağlığı | `sistem-sagligi` | `SystemHealthCenter` (inline) | sistem-sagligi | Eski | Yenilenemedi | Kısmi | Test edilmedi | Sekmesiz, tek grid ekran |
| Sistem Test Merkezi | `sistem-test-merkezi` | `SystemTestCenter` (inline) | sistem-test-merkezi | Eski | Yenilenemedi | Kısmi | Test edilmedi | Sekmesiz |
| Log Merkezi | `log-aktivite-merkezi` | `ActivityLogs` (inline) + generic `Drawer` (log detay) | sistem-loglari | Eski | Yenilenemedi | Kısmi | Test edilmedi | Drawer `admin-drawer-panel` kullanıyor → dark-mode'a **kısmen** uyumlu |
| Veri Yedekleme | `veri-aktarma` | `ExportCenter` (inline) | veri-aktarma | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Sistem Rehberi | `sistem-rehberi` | `SystemGuideCenter` (import) | sistem-rehberi | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| İletişim Merkezi | `iletisim-merkezi` | `CustomerCommunicationAdminCenter` (import, `CustomerCommunicationCenter.tsx`) | iletisim-merkezi | Eski (kendi `.communication-*` CSS'i var, JSX değişmedi) | Yenilenemedi | Kısmi | Playwright: 200, hatasız | 2 iç modal (`AuditModal`, `ConversationHistoryModal`) + gömülü `TeamCommunicationCenter` (3 modal daha) |
| Görevler | `gorevler` | `AgencyTasksCenter` (inline) | gorevler | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Takvim | `takvim` | `AgencyCalendarCenter` (inline) | gorevler | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Ajans Hedefleri | `ajans-hedefleri` | `AgencyTargetsCenter` (inline) | karlilik | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Belgeler | `belgeler` | `DocumentCenter` (inline) | belgeler | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Sözleşme Oluştur | `sozlesme-olustur` | `ContractGeneratorCenter` (inline) | belgeler | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| WhatsApp Hatırlatma Merkezi | `whatsapp-hatirlatma` | `WhatsAppReminderCenter` (inline) | teklifler | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Sektör Sistemleri | `sektor-sistemleri` | `SectorSystemsCenter` (inline) | sektor-sistemleri | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |

### 4.2 Müşteriler grubu

| Ekran | Slug | Bileşen | Yetki | Tasarım durumu | Yenileme | Dark mode | Mobil | Not |
|---|---|---|---|---|---|---|---|---|
| **Müşteriler** | `musteriler` | `CustomersAdmin` (inline) | musteriler | **Yenilendi** | **Tamamen yenilendi + ortak component sistemi** | ✅ Doğrulandı (computed style) | ✅ 6 breakpoint | `AdminPageHeader`, `AdminSection`, `AdminSearchInput`, `AdminFilterBar`, `AdminStatusBadge`, `AdminButton`, `AdminEmptyState` kullanıyor |
| Onboarding | `customers/onboarding` | `OnboardingCenter` (`Phase2OperatingSystem.tsx`, **kendi route'u, AdminDashboard dışı**) | musteriler | Eski | Yenilenemedi | ❌ Yok (shell'siz) | Playwright: 200, hatasız ama shell yok | **Bkz. §6 — shell'siz ekran** |
| Müşteri Entegrasyonları | `musteri-entegrasyonlari` | `IntegrationsCenter` (inline, aynı bileşen "Entegrasyonlar"la paylaşılıyor) | api-ayarlari | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Müşteri Paketleri | `musteri-paketleri` | `CustomersAdmin` (aynı, "Müşteriler" ile paylaşılan koşul) | hk-intelligence-ceo | **Yenilendi** (Müşteriler ile aynı bileşen) | Tamamen yenilendi | ✅ | ✅ | — |
| Müşteri Markalama | `musteri-markalama` | `CustomerBrandingCenter` (inline) | musteriler | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| **Müşteri Profili (360)** | (modal, route'u yok) | `CustomerDetailDrawer` → `CustomerProfileModal` (`customer-profile/CustomerProfileModal.tsx`) | musteriler | Eski | Yenilenemedi | ❌ Yok (`--admin-*` hiç kullanılmıyor) | Test edilmedi (gerçek müşteri verisi olmadan açılamıyor) | **25 iç sekme** — bkz. §7. En kritik tekil yenileme hedefi: en sık kullanılan ve en büyük ekran |
| Lead Merkezi | `leads` | `Crm` (view="Yeni Başvurular") | leads | Eski | Yenilenemedi | Kısmi | Playwright: 200, hatasız | `LeadDrawer` + `LeadEditModal` (bu ikisi kısmen dark-mode'lu, `admin-modal-panel` kullanıyor) |
| Müşteri Keşfi | `musteri-kesfi` | `CustomerFinder`→`MapsIntelligence` | musteri-bulucu | Eski | Yenilenemedi | Kısmi | Playwright: 200, hatasız | 8 sekmeli hub (§7), `BusinessLeadDetailPanel` drawer'ı yoğun hardcoded stil |
| Haritalar | `haritalar` | `MapsIntelligence` | haritalar | Eski | Yenilenemedi | Kısmi | Test edilmedi | Müşteri Keşfi ile aynı bileşen |
| Rakip İstihbarat Merkezi | `rakip-analizi` | `CompetitorAnalysisCenter` (inline) | rakip-analizi | Eski | Yenilenemedi | Kısmi | Test edilmedi | Kendi detay modalı var |
| Takip Merkezi | `takip-merkezi` | `LeadFollowUpCenter` (inline) | leads | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Satış Hunisi | `satis-hunisi` | `SalesPipeline` (inline) | leads | Eski | Yenilenemedi | Kısmi | Test edilmedi | 5 iç modal/onay diyaloğu (portal) |
| Teklif Oluştur | `teklif-hazirlama` | `ProposalEngine` (inline) | teklifler | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Teklif Takip Merkezi | `teklif-takip-merkezi` | `ProposalFollowupCenter` (inline) | teklifler | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Kazanıldı/Kaybedildi Analizi | `kazanildi-kaybedildi-analizi` | `WonLostAnalysisCenter` (inline) | leads | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |

### 4.3 Reklam grubu

| Ekran | Slug | Bileşen | Yetki | Tasarım durumu | Yenileme | Dark mode | Mobil | Not |
|---|---|---|---|---|---|---|---|---|
| Kampanyalar | `kampanyalar` | `CampaignAdmin` (inline) | kampanyalar | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Reklam Operasyon Merkezi | `reklam-operasyon-merkezi` | `AdsOperatingCenter` (`GrowthOperatingSystem.tsx`) | reklam-operasyon-merkezi | Eski | Yenilenemedi | Kısmi | Playwright: 200, hatasız | — |
| Reklam Hesabı Eşleştirme | `reklam-hesabi-eslestirme` | `AdAccountMappingCenter` (inline) | kampanyalar | Eski | Yenilenemedi | Kısmi | Test edilmedi | Kendi detay modalı var |
| Google Ads İstihbaratı | `google-istihbarat` | `GoogleAdsAnalysisSection` (inline) | google-analiz | Eski | Yenilenemedi | Kısmi | Test edilmedi | `AnalysisDetailModal` paylaşımlı |
| Meta Reklam İstihbaratı | `meta-istihbarat` | `MetaAnalysisSection` (inline) | meta-analiz | Eski | Yenilenemedi | Kısmi | Test edilmedi | `AnalysisDetailModal` paylaşımlı |
| Web Analitiği | `website-analytics` | `WebsiteAnalyticsCenter` (import) — kendi static route'u da var | website-analytics | Eski | Yenilenemedi | Kısmi | Test edilmedi (route var, ayrı test edilmedi) | — |
| Reklam Doktoru Pro | `ad-insights` | `AdDoctorMvpPanel` + `AdInsightsCenter` — **kendi static route'u** (`/hk-admin/ad-insights`) | ad-insights | Eski | Yenilenemedi | Kısmi | Test edilmedi | Static route → AdminDashboard'ı çağırıyor, shell var |
| Büyüme Motoru | `growth-engine` | `GrowthEngineCenter` (`GrowthOperatingSystem.tsx`) | growth-engine | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Funnel Planlayıcı | `funnel-builder` | `FunnelBuilderCenter` (`GrowthOperatingSystem.tsx`) | funnel-builder | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Modül Pazarı | `marketplace` | `GrowthMarketplaceCenter` (`GrowthOperatingSystem.tsx`) | marketplace | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Meta Raporları | `meta-raporlari` | `MetaAnalysisSection` (aynı) | meta-analiz | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Google Ads Raporları | `google-ads-raporlari` | `GoogleAdsAnalysisSection` (aynı) | google-analiz | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Aylık Raporlar | `aylik-raporlar` | `MonthlyReportCenter` (inline) | aylik-raporlar | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Müşteri Raporları | `musteri-raporlari` | `ReportsHub` (inline) | raporlar | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| PDF Rapor Tasarım Merkezi | `pdf-rapor-tasarim` | `PdfReportDesignCenter` (inline) | raporlar | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| PDF Audit | `pdf-audit` | `SocialMediaAuditCenter` (inline) | sosyal-medya-denetimi | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Rapor Çıktıları | `rapor-ciktilari` | `ReportsHub` (aynı) | raporlar | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Dışa Aktar | `rapor-disa-aktar` | `ReportsHub` (aynı, reportAliases) | veri-aktarma | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |

### 4.4 İçerik ve AI grubu

| Ekran | Slug | Bileşen | Yetki | Tasarım durumu | Yenileme | Dark mode | Mobil | Not |
|---|---|---|---|---|---|---|---|---|
| Agent Hub | `agent-hub` | `AgentHubCenter` (import) — **kendi static route'u** | agent-hub | Eski | Yenilenemedi | Kısmi | Test edilmedi | Static route → AdminDashboard, shell var. 12 sekmeli hub (§7) |
| Yapay Zekâ Stüdyosu | `ai-studio` | `AiAssistant` (inline) | ai-studio | Eski | Yenilenemedi | Kısmi | Test edilmedi | AI provider seçim modalı ortak (`AiProviderChooserModal`) |
| Prompt Merkezi | `prompt-uretimi` | `AiAssistant` (aynı) | prompt-kutuphanesi | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Yapay Zekâ Satış Koçu | `ai-satis-kocu` | `AiSalesCoachCenter` (inline) | ai-studio | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Blog & SEO Merkezi | `blog-seo` | `BlogSeoCenter` (import) — **kendi static route, shell YOK** | blog-seo | Yeni görünümlü ama **izole** (7 sekme, kendi tasarım dili) | Yenilenemedi (ve shell'e bağlı değil) | ❌ Shell yok | Playwright: 200, hatasız, **sidebar yok** | **Bkz. §6 — shell'siz ekran** |
| İçerik Planları | `icerik-fikirleri` | `PreparationCenter` (inline) | icerik-onerileri | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Sosyal Medya Planı | `sosyal-medya-icerik-plani` | `SocialPlanGenerator` (inline) | sosyal-medya-plani | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Kreatif Stüdyo | `kampanya-onerileri` | `PreparationCenter` (aynı) | kampanya-hazirligi | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Medya | `medya` | `MediaLogoHub` (inline) | medya | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |

### 4.5 Finans grubu

| Ekran | Slug | Bileşen | Yetki | Tasarım durumu | Yenileme | Dark mode | Mobil | Not |
|---|---|---|---|---|---|---|---|---|
| Muhasebe Merkezi | `muhasebe` | `AccountingCenter` (inline) | muhasebe | Eski | Yenilenemedi | Kısmi | Playwright: 200, hatasız | 8 sekmeli hub (§7) |
| Tahsilatlar | `tahsilat` | `AccountingCenter` (tab=`tahsilatlar`) | tahsilat | Eski | Yenilenemedi | Kısmi | Test edilmedi | `PaymentCenter` tablo+modal |
| Gelir Gider | `gelir-gider` | `AccountingCenter` (tab=`gelir-gider`) | karlilik | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Bekleyen Ödemeler | `bekleyen-odemeler` | `AccountingCenter` (tab=`bekleyen`) | tahsilat | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Gelir Tahmini | `gelir-tahmini` | `AccountingCenter` (tab=`gelir-tahmini`) | karlilik | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Kârlılık | `karlilik` | `AccountingCenter` (tab=`karlilik`) | karlilik | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |

### 4.6 Sistem grubu

| Ekran | Slug | Bileşen | Yetki | Tasarım durumu | Yenileme | Dark mode | Mobil | Not |
|---|---|---|---|---|---|---|---|---|
| Entegrasyonlar | `entegrasyonlar` | `IntegrationsCenter` (inline) | api-ayarlari | Eski | Yenilenemedi | Kısmi | Playwright: 200, hatasız | Sekmesiz, tek uzun sayfa, çok sayıda alt panel |
| Meta | `meta-integrations` | `IntegrationCenter` (`Phase2OperatingSystem.tsx`, **kendi route, shell YOK**) | api-ayarlari | Eski | Yenilenemedi | ❌ Shell yok | Playwright: 200, hatasız, sidebar yok | **Bkz. §6 — shell'siz ekran** |
| Google | `google-integrations` | `IntegrationCenter` (aynı dosya, `provider="google"`, **kendi route, shell YOK**) | api-ayarlari | Eski | Yenilenemedi | ❌ Shell yok | Playwright: 200, hatasız, sidebar yok | **Bkz. §6 — shell'siz ekran** |
| OAuth Kurulum Durumu | `oauth-kurulum-durumu` | `IntegrationsCenter` (aynı, `OAuthSetupStatusPanel`) | api-ayarlari | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Web Analitiği Bağlantıları | `web-analitik-entegrasyonlari` | `WebsiteAnalyticsCenter` (aynı) | website-analytics | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Discord | `discord-entegrasyonu` | `AgentHubCenter` (aynı, integrations sekmesi) | agent-hub | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| API Durumu | `api-durumu` | `SystemHealthCenter` (aynı) | api-ayarlari | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Web Sitesi Yönetimi | `web-sitesi-yonetimi` | `WebsiteManagementCenter` (inline) | site-ayarlari | Eski | Yenilenemedi | Kısmi | Test edilmedi | 9 sekmeli hub (§7) |
| Kullanıcı Yönetimi | `kullanici-yonetimi` | `UsersAdmin` (mode="Kullanıcı Yönetimi") | kullanicilar | Eski | Yenilenemedi | Kısmi | Test edilmedi | 4 sekmeli hub, düzenleme modalı var |
| Roller | `roller-yetkiler` | `UsersAdmin` (mode="Roller") | kullanicilar | Eski | Yenilenemedi | Kısmi | Test edilmedi | Aynı bileşen, farklı başlık |
| Tema / Logo | `tema-logo` | `ThemeEditor` (inline) | tema-ayarlari | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |
| Sistem Ayarları | `sistem-ayarlari` | `Settings` (inline) | site-ayarlari | Eski | Yenilenemedi | Kısmi | Playwright: 200, hatasız | Sekmesiz, çoğunlukla başka ekranlara yönlendiren kısayol kartları |
| Güvenlik | `guvenlik` | `UsersAdmin` (mode="Güvenlik") | kullanicilar | Eski | Yenilenemedi | Kısmi | Test edilmedi | Aynı bileşen, farklı başlık |
| HK Asistan Ayarları | `hk-asistan-ayarlari` | `IntegrationsCenter` (aynı, `CustomerAiSettingsAdminPanel`) | hk-asistan | Eski | Yenilenemedi | Kısmi | Test edilmedi | — |

---

## 5. ÖLÜ / ERİŞİLEMEZ LEGACY DALLAR (canlı ekran SAYILMADI)

`AdminDashboard.tsx` içindeki 89 switch koşulundan **28'i tamamen ölü** (satır 801, 802, 811, 840, 841, 843, 852, 853, 854, 864, 865, 866, 867, 868, 869, 870, 871, 872, 873, 874, 875, 876, 878, 879, 880, 881, 883, 884). Bunlar arasında en dikkat çekici olanı: `active === "Genel Bakış"` (satır 864) — dosyanın hiçbir yerinde `setActive("Genel Bakış")` çağrılmıyor, bu yüzden **ikinci, tamamen erişilemez bir `<Overview/>` render'ı** olarak duruyor (bir önceki turda bulduğumuz "3 kez tekrarlanan Son Aktiviteler" gibi kalıntılardan biri).

Ayrıca 89 tekil etiketten (switch içinde kontrol edilen) tam liste bir önceki araştırma turunda çıkarıldı; toplam ~89 ölü etiket var (bkz. ham veri: `Yapay Zekâ Denetim`, `Kullanıcılar`, `Genel Arama`, `Hazırlık Merkezi` gibi tamamen kendi başına ölü satırlar dahil, artı yukarıdaki 28 satırın içerdiği tüm etiketler).

**Bu satırlar için önerilen aksiyon (bu görevin kapsamı dışında, ayrı bir temizlik işi):** `AdminDashboard.tsx`'ten bu 28 tamamen ölü koşulu ve çağırdıkları artık kullanılmayan inline fonksiyonları (`AiAuditCenter`, `UsersHub`, `GlobalSearchPage`, `PreparationCenter`'ın bazı mod'ları, `Pages`, `Brand`, `KeyValue`'nun "Sosyal Medya Yönetimi" çağrısı, `Collection`'ın 3 çağrısı, `QuoteWizardAdmin`, ikinci `CustomersAdmin`/`UsersAdmin`/`FilesAdmin`/`CustomerPanelAdmin` çağrıları, `MetricAdmin`, `ReportingCenter`, `UpdatesAdmin`, `Media`, ikinci `AiAssistant` çağrıları, `TrackingSettings`) silmek dosyayı muhtemelen 1500-2000 satır azaltabilir. **Bu turda dokunulmadı** — büyük, riskli bir silme operasyonu; önce her birinin gerçekten çağrılmadığını runtime'da da doğrulamak gerekir.

---

## 6. EN KRİTİK BULGU: 4 EKRAN TAMAMEN SHELL'SİZ

Şu 4 canlı, nav-registry'de kayıtlı ekran **hiçbir zaman** yeni `AdminAppShell`/sidebar/header/dark-mode sistemine girmiyor — çünkü kendi bağımsız `page.tsx` dosyaları `AdminDashboard`'ı hiç çağırmıyor:

| Ekran | Route | Dosya | Kanıt |
|---|---|---|---|
| Blog & SEO Merkezi | `/hk-admin/blog-seo` | `src/app/hk-admin/blog-seo/page.tsx` → `BlogSeoCenter` doğrudan | Playwright: `.admin-sidebar` yok, `.admin-theme-toggle` yok |
| Meta entegrasyonu | `/hk-admin/meta-integrations` | `src/app/hk-admin/meta-integrations/page.tsx` → `IntegrationCenter` doğrudan | Aynı |
| Google entegrasyonu | `/hk-admin/google-integrations` | `src/app/hk-admin/google-integrations/page.tsx` → `IntegrationCenter` doğrudan | Aynı |
| Onboarding | `/hk-admin/customers/onboarding` | `src/app/hk-admin/customers/onboarding/page.tsx` → `OnboardingCenter` doğrudan | Aynı |

**Kullanıcıya etkisi:** Bu 4 ekrana giren bir admin kullanıcısı, admin panelinin geri kalanına (sidebar, üst menü, favoriler, arama, tema değiştirici) erişemiyor — sadece tarayıcının "geri" tuşuyla çıkabiliyor. `BlogSeoCenter` ve `IntegrationCenter`/`OnboardingCenter` component'lerinin hiçbirinde `/hk-admin`'e dönüş linki yok (grep ile doğrulandı, 0 sonuç).

**Teknik neden:** Bu 4 sayfa muhtemelen `AdminDashboard`'ın çok büyük olması (11.590 satır, tüm modülleri tek client component'te barındırıyor) nedeniyle performans/kod-bölme amacıyla ayrı, hafif route'lar olarak tasarlanmış — ama bu ayrım sırasında ortak shell paylaşılmamış.

**Önerilen çözüm (bu turda uygulanmadı, kapsam/risk nedeniyle):** Bu 4 sayfayı da `AdminAppShell` + `AdminSidebar` + `AdminTopHeader` ile sarmalamak. En güvenli yol: bu 4 component'i olduğu gibi bırakıp, page.tsx dosyalarına `AdminAppShell`'i "headless" biçimde (sadece sidebar+header, içerik olarak mevcut component) sarmalayan ince bir wrapper eklemek — ancak bu, her 4 component'in kendi `<div>` kök elemanının stiliyle çakışıp çakışmayacağının ayrı ayrı test edilmesini gerektirir (özellikle `BlogSeoCenter`'ın zaten kendi koyu tema paletini kullanması, çift-tema çakışması riski taşır). Bu, ayrı ve dikkatli bir görev olmalı.

---

## 7. SEKMELİ (HUB) BİLEŞENLER — DETAYLI SEKME LİSTESİ

| Hub | Dosya | Sekme sayısı | Sekmeler |
|---|---|---|---|
| **CustomerDetailDrawer** (Müşteri 360, "Müşteriler" listesinden açılıyor) | AdminDashboard.tsx:6392 | 25 | Genel Bilgi, Büyüme, Müşteri Kurulumu, Entegrasyonlar, Platform Yönetimi, Panel Builder, Bağlantı Bilgileri, Marka Varlıkları, İletişim, İletişim Geçmişi, Satış Durumu, Reklam Hesapları, Kampanyalar, Teklifler, Ödemeler, Yapılacaklar, Raporlar, Dosyalar, Zaman Çizelgesi, Panel Görünürlüğü, Giriş Bilgileri, Metrikler, Yapılan Çalışmalar, Aktivite Geçmişi, Notlar |
| **CustomerProfileModal** (aynı 360 sistemin `HKAutonomousAgencyCenter`'dan açılan versiyonu) | customer-profile/CustomerProfileModal.tsx:68 | 24 | CustomerDetailDrawer'a çok benzer ama "İletişim Geçmişi" yok, "Panel Builder" yerine "Müşteri Paneli Yetkileri" — **iki sekme listesi arasında tutarsızlık var, aynı ekranın iki farklı versiyonu gibi davranıyor** |
| **AgentHubCenter** | AgentHubCenter.tsx | 12 | Genel Bakış, AI Sağlayıcıları, Yeni Agent Görevi, Prompt Merkezi, İş Akışı Oluşturucu, Görev Sırası, AI Hafızası, AI Eğitim, AI Karşılaştırma Testi, Entegrasyon Kontrolü, İşlem Kayıtları, Planlanmış Görevler |
| **MapsIntelligence** (Haritalar / Müşteri Keşfi) | AdminDashboard.tsx:8949 | 8 | Fırsat Haritası, Google Maps Müşteri Bulma, Kaydedilenler, Sıcak Leadler, Bölgesel Fırsatlar, Rakip Analizi, Yapay Zekâ Analiz, CRM'e Aktarılanlar |
| **AccountingCenter** (Muhasebe) | AdminDashboard.tsx:3587 | 8 | Genel Bakış, Tahsilatlar, Bekleyen Ödemeler, Gelir/Gider, Gelir Tahmini, Kârlılık, Müşteri Finans Özeti, Raporlar/Dışa Aktar |
| **WebsiteManagementCenter** | AdminDashboard.tsx:5391 | 9 | Genel Site Ayarları, Logo Yönetimi, Görsel Yönetimi, Sayfa İçerikleri, Hakkımda+Sertifikalar, Hizmetler, Paketler, İletişim, Performans |
| **UsersAdmin** | AdminDashboard.tsx:8520 | 4 | Kullanıcılar, Roller ve Yetkiler, İzinler, Yeni Kullanıcı Oluştur |
| **BlogSeoCenter** (shell'siz, bkz. §6) | BlogSeoCenter.tsx | 7 | İçerik Üretimi, İçerik Planı, İçerik Takvimi, İç Bağlantılar, Sosyal Medya, Performans, Entegrasyon Durumu |

---

## 8. MODAL VE DRAWER ENVANTERİ

### 8.1 `AdminDashboard.tsx` içinde (28 adet)

| # | Ad | Satır | Açıldığı yer | Amaç | Dark mode |
|---|---|---|---|---|---|
| 1 | AiProviderChooserModal | 245 | LeadDrawer, AiAssistant, MetaAnalysisSection, GoogleAdsAnalysisSection, SocialMediaAuditCenter, ProposalEngine | AI sağlayıcı seçim onayı | ❌ Hardcoded |
| 2 | Bildirimler Drawer | 741 | Header çan ikonu | Bildirim listesi | ✅ `--admin-surface`+`admin-drawer-panel` |
| 3 | Yardım popover | 703 | Header "Yardım" | Hızlı yardım linkleri | ❌ Hardcoded |
| 4 | Favoriler popover | 681 | Header "Favoriler" | Favori modüller | ❌ Hardcoded |
| 5 | SystemBoot | 916 | Açılış animasyonu | Boot ekranı | ❌ Hardcoded |
| 6 | Komut Paleti | 1162/1206 | Cmd/Ctrl+K, her ekranda | Global arama + hızlı aksiyon | ❌ Hardcoded |
| 7 | GlobalCopilotPanel | 1209 | Header "Copilot" | AI copilot paneli | ❌ Hardcoded |
| 8 | StartupApiStatusModal | 1339 | Header API rozeti | API sağlık durumu | ❌ Hardcoded |
| 9 | "CEO Modu" overlay | 2809 | Dashboard "CEO Modu" | Özet KPI görünümü | ❌ Hardcoded |
| 10 | Rakip Detay Modalı | 4121 | Rakip İstihbarat Merkezi | Rakip detayı | ❌ Hardcoded |
| 11-15 | Lead Düzenle/Arşivle/Toplu İşlem/Aşama/Dönüştür onayları | 4985-4989 | Satış Hunisi (Kanban) | Çeşitli lead aksiyonları | ❌ Hardcoded |
| 16 | LeadDrawer | 5031 | CRM/Lead listesi | Lead 360 görünümü | ❌ Hardcoded (backdrop) |
| 17 | LeadEditModal | 5191 | LeadDrawer içi | Lead alan düzenleme | ✅ `admin-modal-panel` (backdrop hariç) |
| 18 | ConfirmDialog (genel) | 5221 | Çeşitli silme/onay noktaları | Onay diyaloğu | ✅ `admin-modal-panel` |
| 19 | Drawer (genel) | 5233 | Başvuru Detayı, Log Detayı | Detay çekmecesi | ✅ `admin-drawer-panel` |
| 20 | CustomerFormModal | 5696 | Müşteriler: yeni firma / giriş hesabı / kalıcı silme | 3 farklı form | ❌ Hardcoded |
| 21 | **CustomerDetailDrawer** | 6392 | Müşteriler listesi | **Müşteri 360 (25 sekme)** | ❌ Hardcoded |
| 22 | Kampanya Eşleştir modalı | 7425 | Müşteri 360 → Reklam Hesapları sekmesi | Meta kampanya eşleştirme | ❌ Hardcoded |
| 23 | Log Detayı Drawer | 7836 | Log Merkezi | Log kaydı detayı | ✅ `admin-drawer-panel` |
| 24 | Reklam Hesabı Eşleştirme detay modalı | 8108 | Reklam Hesabı Eşleştirme | Eşleştirme geçmişi | ❌ Hardcoded |
| 25-26 | Kullanıcı Düzenle / Sil onayı | 8690, 8719 | Kullanıcı Yönetimi | Kullanıcı rol/yetki düzenleme, silme onayı | ❌ Hardcoded |
| 27 | BusinessLeadDetailPanel | 9726 | Müşteri Keşfi / Haritalar | İşletme detay+aksiyon paneli | ❌ Hardcoded (38 kez `bg-white`) |
| 28 | AnalysisDetailModal | 10379 | Meta/Google Analiz bölümleri | Analiz sonucu detay + CRM kaydı | ❌ Hardcoded |

### 8.2 Diğer dosyalarda (13 adet)

| # | Ad | Dosya | Açıldığı yer | Dark mode |
|---|---|---|---|---|
| 29-30 | AuditModal, ConversationHistoryModal | CustomerCommunicationCenter.tsx | İletişim Merkezi | ❌ |
| 31-34 | TeamCommunicationCenter (sekme) + CreateTeamConversationModal + TeamAuditModal + TeamHistoryModal | TeamCommunicationCenter.tsx | İletişim Merkezi → Ekip sekmesi | ❌ |
| 35-38 | ActionModal, MarketplaceModal, ApplyWizardModal, ApplicationDetailModal | HKAutonomousAgencyCenter.tsx | Dashboard + HK Intelligence CEO | ❌ |
| 39 | **CustomerProfileModal** | customer-profile/CustomerProfileModal.tsx | HKAutonomousAgencyCenter → müşteri profili | ❌ (0 `--admin-`, 54 `bg-white`) |
| 40-41 | BranchEditorModal, BranchActionModal | customer-profile/CustomerProfileModal.tsx | Müşteri 360 → Şubeler | ❌ |

**Dark-mode özet:** 41 modal/drawer'ın yalnızca **4 tanesi** (Bildirimler drawer'ı, LeadEditModal, ConfirmDialog, generic Drawer) `--admin-*` token sistemini kullanıyor. Geri kalan 37'si tamamen hardcoded açık renk paleti — bunlar arasında en kritik ikisi, en sık açılan iki ekran olan **CustomerDetailDrawer/CustomerProfileModal** (müşteri 360 profili, 41-49 sekme) ve **CustomerFormModal**.

---

## 9. GENEL DEĞERLENDİRME — "YENİLENDİ" Mİ?

**Hayır, admin arayüzünün tamamı yenilenmedi.** Bu ve önceki turda gerçek JSX-seviyesi yeniden tasarım yalnızca 2 ekrana uygulandı: **Dashboard** ve **Müşteriler**. Bunun ötesinde:

- Shell (sidebar/header/dark-mode altyapısı) 73/77 nav öğesine ulaşıyor (4'ü tamamen shell'siz — §6).
- CSS token sistemi (`--admin-*`, `.hk-admin[data-theme=dark]`) global olarak yüklü ve genel sayfa arka planı/üst menü/sidebar'da çalışıyor, ama **component-seviyesinde** (kart, buton, modal, tablo) yalnızca yeni yazılan `admin/ui/*`/`admin/dashboard/*` component'lerini kullanan 2 ekranda tam kapsıyor.
- 89 switch dalının 28'i (~%31) tamamen ölü kod.
- 41 modal/drawer'ın 37'si dark-mode'dan tamamen kopuk.
- En yoğun kullanılan tekil ekran olan **Müşteri 360 profili** (25-49 sekme, 2 ayrı ama tutarsız implementasyon) bu turlarda hiç dokunulmadı.

Bu, tek bir oturumda (önceki + bu tur) gerçekçi biçimde tamamlanabilecek kapsamın çok üzerinde bir iş yükü (77 nav öğesi + 41 modal/drawer + 8 sekmeli hub + 4 shell'siz sayfa onarımı). Kalan iş, aşağıdaki gibi önceliklendirilmiş ayrı turlar gerektirir:

1. **En yüksek öncelik:** 4 shell'siz sayfayı `AdminAppShell`'e bağlamak (§6) — kullanıcı deneyimini doğrudan kıran, düşük-orta riskli bir düzeltme.
2. **İkinci öncelik:** CustomerDetailDrawer/CustomerProfileModal'ı birleştirmek (tek implementasyon) ve dark-mode token'larına taşımak — en sık kullanılan ekran.
3. **Üçüncü öncelik:** 41 modal/drawer'ı ortak `AdminModal`/`AdminDrawer` component'lerine taşımak (bu component'ler henüz oluşturulmadı — önceki turda "kullanılmayan component yaratma" riski nedeniyle ertelendi, ama artık 41 gerçek kullanım noktası olduğu netleşti, bu component'lerin oluşturulması artık gerekçelendirilmiş durumda).
4. **Dördüncü öncelik:** 28 ölü switch dalının runtime doğrulamasıyla birlikte temizlenmesi.
5. **Beşinci öncelik:** Kalan ~70 ekranın JSX-seviyesi yeniden tasarımı, modül modül.

---

## 10. PLAYWRIGHT DOĞRULAMA SONUÇLARI (bu tur)

Production build'e (`npm run build && npm run start`) karşı, imzalı QA admin cookie'siyle test edildi. Ekran görüntüleri `artifacts/admin-ui-inventory/` altında (yerel, commit'lenmedi — bkz. §11).

| Ekran | HTTP | Sidebar var mı | Tema değiştirici var mı | Console/page hatası |
|---|---|---|---|---|
| İletişim Merkezi (`/hk-admin/iletisim-merkezi`) | 200 | ✅ | ✅ | 0 |
| Müşteri Keşfi (`/hk-admin/musteri-kesfi`) | 200 | ✅ | ✅ | 0 |
| Lead Merkezi (`/hk-admin/leads`) | 200 | ✅ | ✅ | 0 |
| Reklam Operasyon Merkezi (`/hk-admin/reklam-operasyon-merkezi`) | 200 | ✅ | ✅ | 0 |
| Finans (`/hk-admin/muhasebe`) | 200 | ✅ | ✅ | 0 |
| Entegrasyonlar (`/hk-admin/entegrasyonlar`) | 200 | ✅ | ✅ | 0 |
| Sistem ve Ayarlar (`/hk-admin/sistem-ayarlari`) | 200 | ✅ | ✅ | 0 |
| Blog & SEO Merkezi (`/hk-admin/blog-seo`) | 200 | ❌ | ❌ | 0 |
| Google entegrasyonu (`/hk-admin/google-integrations`) | 200 | ❌ | ❌ | 0 |
| Meta entegrasyonu (`/hk-admin/meta-integrations`) | 200 | ❌ | ❌ | 0 |
| Onboarding (`/hk-admin/customers/onboarding`) | 200 | ❌ | ❌ | 0 |

Bunlara ek olarak Dashboard ve Müşteriler önceki turda 6 breakpoint × light/dark tam doğrulandı (bkz. önceki commit `54372f9`'ın raporu).

**Alınamayan ekran görüntüsü yok** — planlanan 11 ekranın tamamı başarıyla yakalandı. Müşteri 360 profili (CustomerDetailDrawer/CustomerProfileModal) gerçek müşteri verisi olmadan (bu ortamda Supabase yapılandırılmamış) açılamadığı için görsel olarak test edilemedi — bu, veri eksikliğinden kaynaklanan bir kısıt, kod hatası değil.

---

## 11. DOSYA VE ARTEFAKT DURUMU

- Bu envanter: `docs/ADMIN-UI-REDESIGN-INVENTORY.md` (commit'lendi)
- Ekran görüntüleri: `artifacts/admin-ui-inventory/*.png` (11 dosya, **commit'lenmedi** — `.gitignore`'da `artifacts/` zaten hariç tutuluyor, gereksiz binary şişkinliği önlemek için)
- Bu tur kod değişikliği yapmadı — yalnızca araştırma + doküman. `git status` bunu yansıtmalı (yalnızca `docs/ADMIN-UI-REDESIGN-INVENTORY.md` yeni dosya).
