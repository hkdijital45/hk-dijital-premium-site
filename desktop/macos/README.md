# HK Dijital macOS Dağıtımı

Bu yapı Electron veya PWA kullanmaz. SwiftUI + WKWebView ile canlı HK Dijital Digital Center giriş ekranını açan hafif native wrapper üretir. Uygulama public ana sayfayı açmaz; oturum varsa web sistemi rolüne göre admin veya müşteri paneline yönlendirir.

Canlı URL:

```text
https://hkdijital.com.tr/digital-center
```

## Gereksinimler

- macOS
- Xcode veya Command Line Tools
- `swiftc`
- `hdiutil`
- Apple Developer sertifikası opsiyonel
- Notarization opsiyonel

## Lokal Build

```bash
npm run desktop:mac
```

veya:

```bash
bash desktop/macos/build-dmg.sh
```

Çıktı:

```text
desktop-builds/HK-Dijital-0.1.0.dmg
```

## GitHub Actions Build

1. GitHub'da `Actions` sekmesine gidin.
2. `Desktop Build` workflow'unu açın.
3. `Run workflow` ile manuel çalıştırın.
4. `macos-dmg` job tamamlanınca artifact bölümünden `HK-Dijital-0.1.0.dmg` dosyasını indirin.

## Production URL

URL `desktop/shared/desktop-config.json` içindeki `productionUrl` alanından okunur. Geçici test için:

```bash
HK_DESKTOP_APP_URL=https://hkdijital.com.tr/digital-center bash desktop/macos/build-dmg.sh
```

## Güvenlik Notları

- Native taraf token veya login bilgisi saklamaz.
- Web session mevcut web auth akışıyla çalışır.
- Bilinmeyen domainler uygulama içinde açılmaz; varsayılan tarayıcıya yönlendirilir.
- Kamera, mikrofon ve dosya yükleme izin açıklamaları `Info.plist` içinde hazırdır.

## Müşteriye Gönderim

Apple Developer imzası ve notarization yoksa macOS Gatekeeper güvenlik uyarısı gösterebilir. Müşteriye dağıtım için imza/notarization yapılması önerilir.

## Icon

`desktop/shared/icons/AppIcon.icns` eklenirse build sırasında app bundle içine kopyalanır.
