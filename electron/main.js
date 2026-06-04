const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("node:path");

const DEFAULT_PRODUCTION_URL = "https://www.hkdijital.com.tr";
const DEFAULT_LOCAL_URL = "http://localhost:3000";

const isDevelopment = !app.isPackaged;
const configuredAppUrl = process.env.HK_DESKTOP_APP_URL || process.env.ELECTRON_START_URL || (isDevelopment ? DEFAULT_LOCAL_URL : DEFAULT_PRODUCTION_URL);
const appBaseUrl = normalizeBaseUrl(configuredAppUrl);
const defaultDesktopPage = process.env.HK_DESKTOP_START_PAGE || "dashboard";

let mainWindow;

function normalizeBaseUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return isDevelopment ? DEFAULT_LOCAL_URL : DEFAULT_PRODUCTION_URL;
  }
}

function normalizeOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

const appOrigin = normalizeOrigin(appBaseUrl);
const internalHosts = new Set(["localhost", "127.0.0.1", "::1", "www.hkdijital.com.tr", "hkdijital.com.tr"]);
const desktopAllowedPrefixes = [
  "/giris",
  "/hk-admin",
  "/musteri-paneli",
  "/api/",
  "/_next/",
  "/icon.svg",
  "/favicon.ico"
];
const externalProtocols = new Set(["mailto:", "tel:", "sms:"]);
const externalHosts = [
  "wa.me",
  "api.whatsapp.com",
  "whatsapp.com",
  "instagram.com",
  "facebook.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
  "youtube.com",
  "youtu.be",
  "linkedin.com",
  "maps.google.com",
  "google.com"
];

function isInternalUrl(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.origin === appOrigin) return true;
    if (isDevelopment && internalHosts.has(parsed.hostname)) return true;
    return false;
  } catch {
    return false;
  }
}

function shouldOpenExternally(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    if (externalProtocols.has(parsed.protocol)) return true;
    return externalHosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function openExternal(targetUrl) {
  shell.openExternal(targetUrl).catch(() => {});
}

function withDesktopMode(pathname) {
  const url = new URL(pathname, appBaseUrl);
  url.searchParams.set("desktop", "1");
  return url.toString();
}

function desktopStartPath() {
  const map = {
    dashboard: "/hk-admin",
    crm: "/hk-admin/crm",
    social: "/hk-admin/sosyal-medya-denetimi",
    meta: "/hk-admin/meta-analiz",
    google: "/hk-admin/google-analiz"
  };
  return map[String(defaultDesktopPage).toLowerCase()] || "/hk-admin";
}

function isDesktopAllowedInternalUrl(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    return desktopAllowedPrefixes.some((prefix) => parsed.pathname === prefix.replace(/\/$/, "") || parsed.pathname.startsWith(prefix));
  } catch {
    return false;
  }
}

function splashHtml(message = "Loading dashboard...") {
  return `<!doctype html>
  <html lang="tr">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>HK Intelligence</title>
      <style>
        :root { color-scheme: dark; }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          min-height: 100vh;
          display: grid;
          place-items: center;
          overflow: hidden;
          background:
            radial-gradient(circle at 30% 18%, rgba(34, 211, 238, .20), transparent 36%),
            radial-gradient(circle at 72% 66%, rgba(250, 204, 21, .16), transparent 34%),
            linear-gradient(145deg, #020617, #071023 55%, #050711);
          color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
        }
        .shell {
          width: min(520px, calc(100vw - 48px));
          border: 1px solid rgba(255, 255, 255, .12);
          border-radius: 18px;
          padding: 34px;
          background: rgba(6, 13, 29, .76);
          box-shadow: 0 34px 120px rgba(0, 0, 0, .46), inset 0 1px 0 rgba(255, 255, 255, .12);
          backdrop-filter: blur(24px);
        }
        .mark {
          display: grid;
          width: 58px;
          height: 58px;
          place-items: center;
          border-radius: 16px;
          background: linear-gradient(135deg, #22d3ee, #facc15);
          color: #020617;
          font-weight: 950;
          letter-spacing: -.04em;
          box-shadow: 0 18px 50px rgba(34, 211, 238, .22);
        }
        h1 { margin: 24px 0 0; font-size: 34px; line-height: 1.05; letter-spacing: -.03em; }
        p { margin: 10px 0 0; color: rgba(226, 232, 240, .72); font-size: 14px; line-height: 1.7; }
        .bar { margin-top: 28px; height: 6px; overflow: hidden; border-radius: 999px; background: rgba(255, 255, 255, .10); }
        .bar span { display: block; width: 42%; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #22d3ee, #facc15); animation: load 1.2s ease-in-out infinite; }
        @keyframes load { 0% { transform: translateX(-110%); } 100% { transform: translateX(260%); } }
      </style>
    </head>
    <body>
      <main class="shell">
        <div class="mark">HK</div>
        <h1>HK Intelligence</h1>
        <p>${message}</p>
        <div class="bar"><span></span></div>
      </main>
    </body>
  </html>`;
}

function offlineHtml() {
  return splashHtml("İnternet bağlantısı bulunamadı. Bağlantınızı kontrol edin ve uygulamayı yeniden deneyin.");
}

async function cookieHeaderForBase() {
  const cookies = await mainWindow.webContents.session.cookies.get({ url: appBaseUrl });
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

async function hasAdminSession() {
  try {
    const response = await fetch(new URL("/api/auth/me", appBaseUrl), {
      headers: { Cookie: await cookieHeaderForBase() },
      cache: "no-store"
    });
    if (!response.ok) return false;
    const data = await response.json().catch(() => ({}));
    return ["admin", "yonetici", "editor", "sales"].includes(data.user?.role);
  } catch {
    return null;
  }
}

async function loadDesktopStart() {
  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml())}`);
  const sessionState = await hasAdminSession();
  if (sessionState === null) {
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(offlineHtml())}`);
    return;
  }
  const target = sessionState ? desktopStartPath() : "/giris";
  mainWindow.loadURL(withDesktopMode(target));
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    title: "HK Intelligence",
    width: 1440,
    height: 950,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#050711",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition: { x: 18, y: 16 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js")
    }
  });

  loadDesktopStart();

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternalUrl(url) && !isDesktopAllowedInternalUrl(url)) {
      mainWindow.loadURL(withDesktopMode("/giris"));
      return { action: "deny" };
    }
    if (isInternalUrl(url) && !shouldOpenExternally(url)) {
      mainWindow.loadURL(url);
      return { action: "deny" };
    }
    openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isInternalUrl(url) && !shouldOpenExternally(url)) {
      if (!isDesktopAllowedInternalUrl(url)) {
        event.preventDefault();
        mainWindow.loadURL(withDesktopMode("/giris"));
      }
      return;
    }
    event.preventDefault();
    openExternal(url);
  });
}

function sendShortcut(channel) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel);
}

function buildMenu() {
  const template = [
    {
      label: "HK Intelligence",
      submenu: [
        { label: "HK Intelligence Hakkında", role: "about" },
        { type: "separator" },
        { label: "Çıkış", accelerator: "CommandOrControl+Q", click: () => app.quit() }
      ]
    },
    {
      label: "Dosya",
      submenu: [
        { label: "Geri", accelerator: "CommandOrControl+[", click: () => mainWindow?.webContents.canGoBack() && mainWindow.webContents.goBack() },
        { label: "İleri", accelerator: "CommandOrControl+]", click: () => mainWindow?.webContents.canGoForward() && mainWindow.webContents.goForward() },
        { type: "separator" },
        { label: "Yenile", accelerator: "CommandOrControl+R", click: () => mainWindow?.reload() },
        { label: "Odaklan / Ara", accelerator: "CommandOrControl+L", click: () => sendShortcut("hk-desktop-focus-search") }
      ]
    },
    {
      label: "Görünüm",
      submenu: [
        { label: "Yakınlaştır", accelerator: "CommandOrControl+Plus", role: "zoomin" },
        { label: "Uzaklaştır", accelerator: "CommandOrControl+-", role: "zoomout" },
        { label: "Yakınlaştırmayı Sıfırla", accelerator: "CommandOrControl+0", role: "resetzoom" },
        { type: "separator" },
        { label: "Tam Ekran", accelerator: "Ctrl+Command+F", role: "togglefullscreen" },
        ...(isDevelopment ? [{ label: "Geliştirici Araçları", accelerator: "Alt+CommandOrControl+I", role: "toggledevtools" }] : [])
      ]
    },
    {
      label: "Yardım",
      submenu: [
        { label: "Kullanım Kılavuzu", click: () => mainWindow?.loadURL(withDesktopMode("/hk-admin/kullanim-kilavuzu")) },
        { label: "HK Dijital Web Sitesi", click: () => openExternal(DEFAULT_PRODUCTION_URL) }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.setName("HK Intelligence Desktop");

app.whenReady().then(() => {
  buildMenu();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
