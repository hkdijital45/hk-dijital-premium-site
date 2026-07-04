$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$Project = Join-Path $Root "desktop\windows\HKDijital\HKDijital.csproj"
$PublishDir = Join-Path $Root "desktop\windows\publish"
$DistDir = Join-Path $Root "desktop\dist\windows"
$Installer = Join-Path $DistDir "HK-Dijital-Setup.exe"

if (-not $IsWindows) {
  Write-Error "Windows .exe installer build'i Windows üzerinde çalışır. Bu script Windows + .NET SDK + WebView2 + Inno Setup gerektirir."
}

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
  Write-Error ".NET SDK bulunamadı. .NET 8 SDK kurun."
}

New-Item -ItemType Directory -Force -Path $PublishDir | Out-Null
New-Item -ItemType Directory -Force -Path $DistDir | Out-Null

dotnet publish $Project -c Release -r win-x64 --self-contained false -o $PublishDir

$Iscc = Get-Command iscc -ErrorAction SilentlyContinue
if ($Iscc) {
  iscc (Join-Path $Root "desktop\windows\HKDijital\installer.iss")
  Write-Host "Installer üretildi: $Installer"
} else {
  Write-Warning "Inno Setup iscc bulunamadı. Publish çıktısı hazır: $PublishDir"
  Write-Warning "Installer için Inno Setup kurup scripti tekrar çalıştırın."
}
