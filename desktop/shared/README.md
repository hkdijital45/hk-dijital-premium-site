# HK Dijital Desktop Ortak Yapı

Bu klasör macOS ve Windows wrapper uygulamalarının ortak yapılandırmasını tutar.

## Config

`desktop-config.json` alanları:

- `appName`: Uygulama adı.
- `productionUrl`: Masaüstü uygulamanın açacağı canlı web adresi.
- `adminUrl`: Web Admin hızlı erişim adresi.
- `supportUrl`: Hata veya destek ekranında kullanılacak adres.
- `version`: Native wrapper sürümü.
- `updateCheckUrl`: İleride GitHub Releases veya özel update manifest için kullanılabilir.
- `allowedHosts`: WebView içinde kalmasına izin verilen domain listesi.

Production URL değiştirmek için bu dosyadaki `productionUrl` değerini güncelleyin ve masaüstü paketini yeniden üretin.

HK Dijital production dağıtımında varsayılan açılış adresi `https://hkdijital.com.tr/digital-center`, admin adresi `https://hkdijital.com.tr/hk-admin`; allowlist ise `hkdijital.com.tr` ve `www.hkdijital.com.tr` üzerine kuruludur.

## Sync Manifest

`sync-manifest.json`, macOS admin uygulamasının desteklediği güvenli offline entity tiplerini ve kritik online-only işlemleri listeler. Uygulama bu manifesti paket içine kopyalar; canlı veri senkronizasyonu `/api/desktop/sync` endpointi üzerinden mevcut web session ile yapılır.

## Güvenlik

- Native wrapper token, şifre veya refresh token saklamaz.
- Login ve session web uygulamasının mevcut auth akışıyla yürür.
- Bilinmeyen domain geçişleri uygulama içinde açılmaz; varsayılan tarayıcıya gönderilir.
- Icon değiştirmek için `desktop/shared/icons/AppIcon.icns` ve `desktop/shared/icons/AppIcon.ico` dosyalarını ekleyin.
