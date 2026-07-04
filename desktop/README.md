# HK Dijital Desktop Dağıtım Altyapısı

Bu klasör HK Dijital web sistemini Electron veya PWA kullanmadan native masaüstü uygulama olarak paketlemek için hazırlandı.

Ana mantık:

- macOS: SwiftUI + WKWebView wrapper
- Windows: .NET WPF + WebView2 wrapper
- Uygulama canlı production URL'ini açar: `https://hkdijital.com.tr`
- Web tarafı Vercel'e deploy edildiğinde masaüstü uygulama yeni web sürümünü otomatik gösterir.
- Native wrapper token, şifre veya refresh token saklamaz.

## Ortak Config

`desktop/shared/desktop-config.json`

Varsayılan production URL:

```text
https://hkdijital.com.tr
```

Allowlist yalnız şu hostları içerir:

```text
hkdijital.com.tr
www.hkdijital.com.tr
```

Production URL değişirse config güncellenmeli ve paketler yeniden üretilmelidir.

## macOS .dmg

Lokal macOS build:

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

Apple imza/notarization yoksa kullanıcı macOS Gatekeeper uyarısı görebilir. Müşteriye dağıtım için Apple Developer sertifikasıyla imza ve notarization önerilir.

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

Code signing yoksa Windows SmartScreen uyarısı çıkabilir. Müşteriye dağıtım için imzalı installer önerilir.

## GitHub Actions ile DMG/EXE Üretimi

Workflow dosyası:

```text
.github/workflows/desktop-build.yml
```

Manuel çalıştırma:

1. GitHub repository sayfasına girin.
2. `Actions` sekmesini açın.
3. `Desktop Build` workflow'unu seçin.
4. `Run workflow` butonuyla çalıştırın.
5. Job tamamlanınca run detayındaki `Artifacts` bölümünden dosyaları indirin.

Artifact isimleri:

- `HK-Dijital.dmg`
- `HK-Dijital-Setup.exe`

## Harici Link ve Domain Güvenliği

Wrapper sadece `desktop-config.json` içindeki `allowedHosts` domainlerini uygulama içinde açar. Diğer linkler varsayılan tarayıcıya gönderilir.

## Otomatik Güncelleme

Web uygulaması canlı URL'den açıldığı için admin/customer web güncellemeleri native paket yenilemeden görünür. Native wrapper güncellemesi için ileride `updateCheckUrl` alanı GitHub Releases veya özel manifest endpointine bağlanabilir.

## Icon Değiştirme

Dosyaları ekleyin:

- `desktop/shared/icons/AppIcon.icns`
- `desktop/shared/icons/AppIcon.ico`

Sonra ilgili build komutunu veya GitHub Actions workflow'unu yeniden çalıştırın.

## Git'e Eklenmeyen Çıktılar

`desktop/dist/`, `desktop/build/` ve `desktop/windows/publish/` build çıktıları Git'e eklenmez. Dağıtım dosyaları GitHub Actions artifact olarak üretilir.
