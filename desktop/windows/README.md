# HK Dijital Windows Dağıtımı

Bu yapı Electron veya PWA kullanmaz. .NET WPF + Microsoft WebView2 ile canlı HK Dijital web uygulamasını açan hafif native wrapper üretir.

## Gereksinimler

- Windows 10/11
- .NET 8 SDK
- Microsoft Edge WebView2 Runtime
- Inno Setup, `iscc` komutu PATH içinde olmalı
- Code signing sertifikası opsiyonel

## Build

PowerShell:

```powershell
npm run desktop:win
```

veya:

```powershell
powershell -ExecutionPolicy Bypass -File desktop/windows/build-exe.ps1
```

Çıktı:

```text
desktop/dist/windows/HK-Dijital-Setup.exe
```

Inno Setup yoksa installer üretilemez; ancak publish çıktısı burada oluşur:

```text
desktop/windows/publish/
```

## Production URL

URL `desktop/shared/desktop-config.json` içindeki `productionUrl` alanından okunur. Test için environment override:

```powershell
$env:HK_DESKTOP_APP_URL="https://11245911.com"
powershell -ExecutionPolicy Bypass -File desktop/windows/build-exe.ps1
```

## Güvenlik Notları

- Native taraf token veya login bilgisi saklamaz.
- Web session mevcut web auth akışıyla çalışır.
- Bilinmeyen domainler uygulama içinde açılmaz; varsayılan tarayıcıya yönlendirilir.
- WebView2 dosya yükleme ve web izinleri standart tarayıcı davranışını kullanır.

## Müşteriye Gönderim

Code signing yoksa Windows SmartScreen uyarısı gösterebilir. Müşteriye dağıtım için imzalı installer önerilir.

## Icon

`desktop/shared/icons/AppIcon.ico` eklenirse proje uygulama ikonu olarak kullanır.
