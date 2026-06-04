const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("node:path");

const DEFAULT_PRODUCTION_URL = "https://www.hkdijital.com.tr";
const DEFAULT_LOCAL_URL = "http://localhost:3000";

const isDevelopment = !app.isPackaged;
const appUrl = process.env.HK_DESKTOP_APP_URL || process.env.ELECTRON_START_URL || (isDevelopment ? DEFAULT_LOCAL_URL : DEFAULT_PRODUCTION_URL);

let mainWindow;

function normalizeOrigin(url) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

const appOrigin = normalizeOrigin(appUrl);
const internalHosts = new Set(["localhost", "127.0.0.1", "::1", "www.hkdijital.com.tr", "hkdijital.com.tr"]);
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

  mainWindow.loadURL(appUrl);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternalUrl(url) && !shouldOpenExternally(url)) {
      mainWindow.loadURL(url);
      return { action: "deny" };
    }
    openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (isInternalUrl(url) && !shouldOpenExternally(url)) return;
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
        { label: "Kullanım Kılavuzu", click: () => mainWindow?.loadURL(new URL("/hk-admin/kullanim-kilavuzu", appUrl).toString()) },
        { label: "HK Dijital Web Sitesi", click: () => openExternal(DEFAULT_PRODUCTION_URL) }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.setName("HK Intelligence");

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
