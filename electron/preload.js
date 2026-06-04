const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("hkDesktop", {
  isDesktop: true,
  platform: process.platform,
  appName: "HK Intelligence",
  onFocusSearch: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = () => callback();
    ipcRenderer.on("hk-desktop-focus-search", listener);
    return () => ipcRenderer.removeListener("hk-desktop-focus-search", listener);
  }
});
