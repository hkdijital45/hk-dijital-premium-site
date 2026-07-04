# HK Dijital Desktop Dağıtım Altyapısı

Bu klasör HK Dijital web sistemini Electron veya PWA kullanmadan native masaüstü uygulama olarak paketlemek için hazırlandı.

Ana mantık:

- macOS: SwiftUI + WKWebView wrapper
- Windows: .NET WPF + WebView2 wrapper
- Uygulama canlı Vercel/production URL'ini açar.
- Web tarafı Vercel'e deploy edildiğinde masaüstü uygulama yeni web sürümünü otomatik gösterir.
- Native wrapper token, şifre veya refresh token saklamaz.

## Ortak Config

`desktop/shared/desktop-config.json`

Varsayılan production URL:

```text
https://11245911.com
```

Bu değeri değiştirip paketleri yeniden üretmeniz yeterlidir.

## macOS .dmg

```bash
npm run desktop:mac
```

Çıktı:

```text
desktop/dist/macos/HK-Dijital.dmg
```

Gereksinimler:

- macOS
- Xcode veya Command Line Tools
- `swiftc`
- `hdiutil`

Apple imza/notarization yoksa kullanıcı Gatekeeper uyarısı görebilir.

## Windows .exe Installer

Windows üzerinde:

```powershell
npm run desktop:win
```

Çıktı:

```text
desktop/dist/windows/HK-Dijital-Setup.exe
```

Gereksinimler:

- Windows 10/11
- .NET 8 SDK
- WebView2 Runtime
- Inno Setup (`iscc`)

Code signing yoksa SmartScreen uyarısı çıkabilir.

## Harici Link ve Domain Güvenliği

Wrapper sadece `desktop-config.json` içindeki `allowedHosts` domainlerini uygulama içinde açar. Diğer linkler varsayılan tarayıcıya gönderilir.

## Otomatik Güncelleme

Web uygulaması canlı URL'den açıldığı için admin/customer web güncellemeleri native paket yenilemeden görünür. Native wrapper güncellemesi için ileride `updateCheckUrl` alanı GitHub Releases veya özel manifest endpointine bağlanabilir.

## Icon Değiştirme

Dosyaları ekleyin:

- `desktop/shared/icons/AppIcon.icns`
- `desktop/shared/icons/AppIcon.ico`

Sonra ilgili build komutunu yeniden çalıştırın.
