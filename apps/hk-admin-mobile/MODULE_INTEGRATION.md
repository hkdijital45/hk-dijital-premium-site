# HK Admin Mobile — Module Integration Checklist

Generated from the web admin's own `adminNavigationItems` (`src/lib/admin-navigation.ts`) — the repository's real module inventory, not a guessed list.

Status legend: NOT_STARTED / IN_PROGRESS / IMPLEMENTED / VERIFIED / BLOCKED.
A module is VERIFIED only once its mobile screen reuses the real backend and has passed TypeScript/lint checks against actual API responses (not mock data). IN_PROGRESS means a real, non-fabricated mobile screen exists but only covers part of the web module's functionality.

## Summary

- Total discovered modules: 81
- VERIFIED: 3
- IN_PROGRESS: 1
- NOT_STARTED: 77
- BLOCKED: 0

Additionally, native-only mobile features not tied to a single web navigation slug:

| Feature | Status | Notes |
|---|---|---|
| Bottom navigation (Ana Sayfa / Müşteriler / Favoriler / Bildirimler / Menü) | VERIFIED | Reordered per spec; Reklamlar/Görevler remain reachable as non-tab routes. |
| Favoriler (module favorites) | VERIFIED | Real, cross-device — reuses `public.admin_user_preferences.favorite_modules`, the exact table/column the web Favoriler button already writes. No new table, no migration. |
| Bildirimler (notification center) | VERIFIED | Real `agency_notifications` rows, read/unread sync — built in a prior pass. |

## Full module inventory

| Module (web label) | Slug | Permission module key | Mobile status | Notes |
|---|---|---|---|---|
| Dashboard | `dashboard` | `dashboard` | VERIFIED | Ana Sayfa tab — real KPI counts (customers/leads/tasks/notifications) from live tables. |
| HK Intelligence CEO | `hk-intelligence-ceo` | `hk-intelligence-ceo` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/hk-intelligence-ceo`), never a WebView. |
| HK Intelligence Kontrol Merkezi | `hk-intelligence-kontrol-merkezi` | `hk-intelligence-ceo` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/hk-intelligence-kontrol-merkezi`), never a WebView. |
| Müşteriler | `musteriler` | `musteriler` | VERIFIED | Müşteriler tab + detail — real list/search/detail + integration connection status. |
| Onboarding | `customers/onboarding` | `musteriler` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/customers/onboarding`), never a WebView. |
| Müşteri Entegrasyonları | `musteri-entegrasyonlari` | `api-ayarlari` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/musteri-entegrasyonlari`), never a WebView. |
| Müşteri Paketleri | `musteri-paketleri` | `hk-intelligence-ceo` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/musteri-paketleri`), never a WebView. |
| Müşteri Markalama | `musteri-markalama` | `musteriler` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/musteri-markalama`), never a WebView. |
| Gelen Talepler | `gelen-talepler` | `gelen-talepler` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/gelen-talepler`), never a WebView. |
| Ön İnceleme Merkezi | `on-inceleme` | `on-inceleme` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/on-inceleme`), never a WebView. |
| Lead Merkezi | `leads` | `leads` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/leads`), never a WebView. |
| Müşteri Keşfi | `musteri-kesfi` | `musteri-bulucu` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/musteri-kesfi`), never a WebView. |
| Haritalar | `haritalar` | `haritalar` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/haritalar`), never a WebView. |
| Rakip İstihbarat Merkezi | `rakip-analizi` | `rakip-analizi` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/rakip-analizi`), never a WebView. |
| Satış Hunisi | `satis-hunisi` | `leads` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/satis-hunisi`), never a WebView. |
| Teklif Oluştur | `teklif-hazirlama` | `teklifler` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/teklif-hazirlama`), never a WebView. |
| Teklif Takip Merkezi | `teklif-takip-merkezi` | `teklifler` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/teklif-takip-merkezi`), never a WebView. |
| Kazanıldı / Kaybedildi Analizi | `kazanildi-kaybedildi-analizi` | `leads` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/kazanildi-kaybedildi-analizi`), never a WebView. |
| Kampanyalar | `kampanyalar` | `kampanyalar` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/kampanyalar`), never a WebView. |
| Reklam Operasyon Merkezi | `reklam-operasyon-merkezi` | `reklam-operasyon-merkezi` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/reklam-operasyon-merkezi`), never a WebView. |
| Reklam Hesabı Eşleştirme | `reklam-hesabi-eslestirme` | `kampanyalar` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/reklam-hesabi-eslestirme`), never a WebView. |
| Google Ads İstihbaratı | `google-istihbarat` | `google-analiz` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/google-istihbarat`), never a WebView. |
| Meta Reklam İstihbaratı | `meta-istihbarat` | `meta-analiz` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/meta-istihbarat`), never a WebView. |
| Web Analitiği | `website-analytics` | `website-analytics` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/website-analytics`), never a WebView. |
| Reklam Doktoru Pro | `ad-insights` | `ad-insights` | IN_PROGRESS | Reklamlar screen — real Meta/Google Ads CONNECTION STATUS only; no live spend/CTR/CPC/reach metrics yet (opens web Reklam Doktoru Pro for that). |
| Rapor Merkezi | `rapor-merkezi` | `rapor-merkezi` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/rapor-merkezi`), never a WebView. |
| Büyüme Motoru | `growth-engine` | `growth-engine` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/growth-engine`), never a WebView. |
| Funnel Planlayıcı | `funnel-builder` | `funnel-builder` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/funnel-builder`), never a WebView. |
| Modül Pazarı | `marketplace` | `marketplace` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/marketplace`), never a WebView. |
| AI Workforce | `ai-workforce` | `ai-workforce` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/ai-workforce`), never a WebView. |
| Agent Hub | `agent-hub` | `agent-hub` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/agent-hub`), never a WebView. |
| Yapay Zekâ Stüdyosu | `ai-studio` | `ai-studio` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/ai-studio`), never a WebView. |
| Prompt Merkezi | `prompt-uretimi` | `prompt-kutuphanesi` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/prompt-uretimi`), never a WebView. |
| Yapay Zekâ Satış Koçu | `ai-satis-kocu` | `ai-studio` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/ai-satis-kocu`), never a WebView. |
| Otonom Operasyonlar | `otonom-operasyonlar` | `customer-risk` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/otonom-operasyonlar`), never a WebView. |
| İletişim Merkezi | `iletisim-merkezi` | `iletisim-merkezi` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/iletisim-merkezi`), never a WebView. |
| Görevler | `gorevler` | `gorevler` | VERIFIED | Görevler screen (Menü → Görevler) — real agency_tasks rows, status read + advance. |
| Takvim | `takvim` | `gorevler` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/takvim`), never a WebView. |
| Ajans Hedefleri | `ajans-hedefleri` | `karlilik` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/ajans-hedefleri`), never a WebView. |
| Belgeler | `belgeler` | `belgeler` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/belgeler`), never a WebView. |
| Sözleşme Oluştur | `sozlesme-olustur` | `belgeler` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/sozlesme-olustur`), never a WebView. |
| WhatsApp Hatırlatma Merkezi | `whatsapp-hatirlatma` | `teklifler` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/whatsapp-hatirlatma`), never a WebView. |
| Sektör Sistemleri | `sektor-sistemleri` | `sektor-sistemleri` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/sektor-sistemleri`), never a WebView. |
| Muhasebe Merkezi | `muhasebe` | `muhasebe` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/muhasebe`), never a WebView. |
| HK Ajans Zekası | `ajans-zekasi` | `karlilik` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/ajans-zekasi`), never a WebView. |
| Analiz & Raporlama Merkezi | `analiz-raporlama` | `analiz-raporlama` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/analiz-raporlama`), never a WebView. |
| Aylık Raporlar | `aylik-raporlar` | `aylik-raporlar` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/aylik-raporlar`), never a WebView. |
| Müşteri Raporları | `musteri-raporlari` | `raporlar` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/musteri-raporlari`), never a WebView. |
| PDF Rapor Tasarım Merkezi | `pdf-rapor-tasarim` | `raporlar` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/pdf-rapor-tasarim`), never a WebView. |
| PDF Audit | `pdf-audit` | `sosyal-medya-denetimi` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/pdf-audit`), never a WebView. |
| Organik Büyüme Merkezi | `organik-buyume-merkezi` | `blog-seo` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/organik-buyume-merkezi`), never a WebView. |
| HK Growth Intelligence | `growth-intelligence` | `growth-intelligence` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/growth-intelligence`), never a WebView. |
| İçerik Planları | `icerik-fikirleri` | `icerik-onerileri` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/icerik-fikirleri`), never a WebView. |
| Sosyal Medya Planı | `sosyal-medya-icerik-plani` | `sosyal-medya-plani` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/sosyal-medya-icerik-plani`), never a WebView. |
| Social Autopilot | `social-autopilot` | `social-autopilot` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/social-autopilot`), never a WebView. |
| Kreatif Stüdyo | `kampanya-onerileri` | `kampanya-hazirligi` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/kampanya-onerileri`), never a WebView. |
| Medya | `medya` | `medya` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/medya`), never a WebView. |
| Markalar | `markalar` | `markalar` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/markalar`), never a WebView. |
| Entegrasyonlar | `entegrasyonlar` | `api-ayarlari` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/entegrasyonlar`), never a WebView. |
| HK Connect | `hk-connect` | `social-autopilot` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/hk-connect`), never a WebView. |
| Meta | `meta-integrations` | `api-ayarlari` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/meta-integrations`), never a WebView. |
| Google | `google-integrations` | `api-ayarlari` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/google-integrations`), never a WebView. |
| OAuth Kurulum Durumu | `oauth-kurulum-durumu` | `api-ayarlari` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/oauth-kurulum-durumu`), never a WebView. |
| Web Analitiği Bağlantıları | `web-analitik-entegrasyonlari` | `website-analytics` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/web-analitik-entegrasyonlari`), never a WebView. |
| Discord | `discord-entegrasyonu` | `agent-hub` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/discord-entegrasyonu`), never a WebView. |
| API Durumu | `api-durumu` | `api-ayarlari` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/api-durumu`), never a WebView. |
| Web Sitesi Yönetimi | `web-sitesi-yonetimi` | `site-ayarlari` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/web-sitesi-yonetimi`), never a WebView. |
| Kullanıcı Yönetimi | `kullanici-yonetimi` | `kullanicilar` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/kullanici-yonetimi`), never a WebView. |
| Roller | `roller-yetkiler` | `kullanicilar` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/roller-yetkiler`), never a WebView. |
| Tema / Logo | `tema-logo` | `tema-ayarlari` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/tema-logo`), never a WebView. |
| Sistem Ayarları | `sistem-ayarlari` | `site-ayarlari` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/sistem-ayarlari`), never a WebView. |
| Güvenlik | `guvenlik` | `kullanicilar` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/guvenlik`), never a WebView. |
| HK Asistan Ayarları | `hk-asistan-ayarlari` | `hk-asistan` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/hk-asistan-ayarlari`), never a WebView. |
| Test Merkezi | `operasyonel-kalite-merkezi` | `operational-quality` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/operasyonel-kalite-merkezi`), never a WebView. |
| QA Merkezi | `qa-center` | `qa-center` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/qa-center`), never a WebView. |
| Sistem Sağlığı | `sistem-sagligi` | `sistem-sagligi` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/sistem-sagligi`), never a WebView. |
| Sistem Test Merkezi | `sistem-test-merkezi` | `sistem-test-merkezi` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/sistem-test-merkezi`), never a WebView. |
| Log Merkezi | `log-aktivite-merkezi` | `sistem-loglari` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/log-aktivite-merkezi`), never a WebView. |
| Veri Yedekleme | `veri-aktarma` | `veri-aktarma` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/veri-aktarma`), never a WebView. |
| Veri Sıfırlama Merkezi | `veri-sifirlama-merkezi` | `veri-sifirlama` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/veri-sifirlama-merkezi`), never a WebView. |
| Sistem Rehberi | `sistem-rehberi` | `sistem-rehberi` | NOT_STARTED | Not yet built natively — reachable from Menü/Favoriler via system browser to the real web route (`/hk-admin/sistem-rehberi`), never a WebView. |

## Remaining work (next exact steps)

1. Leads / Sales pipeline (`leads`, `satis-hunisi`, `gelen-talepler`) — real native list/detail/status-change screens, same pattern as Görevler.
2. Reklam Doktoru Pro live metrics (spend/CTR/CPC/CPM/reach) — requires a dedicated `/api/mobile/ad-insights/*` route that calls the existing Reklam Doktoru Pro sync/read services server-side (no direct Meta Graph calls from the device).
3. Müşteri Keşfi (prospect discovery/evaluation) — native list + evaluation detail, reusing the existing Candidate Evaluation data model.
4. Organik Büyüme Merkezi — read-only native views (content plan, topic clusters) are safe to add; the actual editorial workflow stays Claude-Project/manual per the existing (reversed-from-AI-autopilot) design and must not be automated.
5. Finans (Muhasebe Merkezi) and Rapor Merkezi — native list/detail screens for payments and report history; PDF/Word export needs an Expo-Go-compatible download flow (expo-file-system + expo-sharing, no native module requiring a dev build).
6. Remaining Sistem/Entegrasyonlar modules — intentionally left web-only; they are admin-configuration screens rarely needed from a phone and higher-risk to expose on a mobile device.
