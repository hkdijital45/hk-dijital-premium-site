# HK Dijital Desktop Ortak Yapı

Bu klasör macOS ve Windows wrapper uygulamalarının ortak yapılandırmasını tutar.

## Config

`desktop-config.json` alanları:

- `appName`: Uygulama adı.
- `productionUrl`: Masaüstü uygulamanın açacağı canlı web adresi.
- `supportUrl`: Hata veya destek ekranında kullanılacak adres.
- `version`: Native wrapper sürümü.
- `updateCheckUrl`: İleride GitHub Releases veya özel update manifest için kullanılabilir.
- `allowedHosts`: WebView içinde kalmasına izin verilen domain listesi.

Production URL değiştirmek için bu dosyadaki `productionUrl` değerini güncelleyin ve masaüstü paketini yeniden üretin.

## Güvenlik

- Native wrapper token, şifre veya refresh token saklamaz.
- Login ve session web uygulamasının mevcut auth akışıyla yürür.
- Bilinmeyen domain geçişleri uygulama içinde açılmaz; varsayılan tarayıcıya gönderilir.
- Icon değiştirmek için `desktop/shared/icons/AppIcon.icns` ve `desktop/shared/icons/AppIcon.ico` dosyalarını ekleyin.
