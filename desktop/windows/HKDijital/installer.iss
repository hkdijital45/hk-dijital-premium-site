#define MyAppName "HK Dijital"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "HK Dijital"
#define MyAppExeName "HKDijital.exe"

[Setup]
AppId={{8D4D5F8A-5C21-4C2F-9D4C-1259F26D10A1}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\HK Dijital
DefaultGroupName=HK Dijital
OutputDir=..\..\dist\windows
OutputBaseFilename=HK-Dijital-Setup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64

[Files]
Source: "..\publish\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\HK Dijital"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\HK Dijital"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Masaüstü kısayolu oluştur"; GroupDescription: "Ek kısayollar:"

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "HK Dijital'i başlat"; Flags: nowait postinstall skipifsilent
