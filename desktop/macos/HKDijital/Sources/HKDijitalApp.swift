import SwiftUI
import WebKit
import AppKit

@main
struct HKDijitalApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var database = LocalDatabase.shared
    @StateObject private var network = NetworkMonitor.shared
    @StateObject private var settings: AppSettings
    @StateObject private var model: WebViewModel
    @StateObject private var syncEngine: SyncEngine

    init() {
        let loadedConfig = DesktopConfig.load()
        let database = LocalDatabase.shared
        let settings = AppSettings(config: loadedConfig, database: database)
        _model = StateObject(wrappedValue: WebViewModel(config: loadedConfig))
        _settings = StateObject(wrappedValue: settings)
        _syncEngine = StateObject(wrappedValue: SyncEngine(config: loadedConfig, database: database, settings: settings))
        appDelegate.database = database
        appDelegate.settings = settings
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(model)
                .environmentObject(database)
                .environmentObject(network)
                .environmentObject(settings)
                .environmentObject(syncEngine)
                .frame(minWidth: 1100, minHeight: 720)
        }
        .commands {
            CommandGroup(replacing: .appInfo) {
                Button("HK Digital Hakkında") {
                    NSApplication.shared.orderFrontStandardAboutPanel([
                        .applicationName: "HK Digital",
                        .applicationVersion: model.config.version,
                        NSApplication.AboutPanelOptionKey(rawValue: "Version"): "Build 1",
                        .credits: NSAttributedString(
                            string: "www.hkdijital.com.tr\n© \(Calendar.current.component(.year, from: Date())) HK Dijital",
                            attributes: [.foregroundColor: NSColor.secondaryLabelColor]
                        )
                    ])
                }
            }

            CommandGroup(replacing: .appSettings) {
                Button("Ayarlar…") { model.activeSection = .settings }
                    .keyboardShortcut(",", modifiers: [.command])
            }

            CommandGroup(replacing: .appTermination) {
                Button("HK Digital'den Çık") {
                    NSApplication.shared.terminate(nil)
                }
                .keyboardShortcut("q", modifiers: [.command])
            }

            CommandGroup(after: .newItem) {
                Divider()
                Button("Belge Yükle…") { model.navigate(toSlug: "belgeler") }
                Button("İndirilenleri Göster") { model.activeSection = .downloads }
                    .keyboardShortcut("j", modifiers: [.command, .shift])
            }

            CommandMenu("Görünüm") {
                Button("Geri") { model.goBack() }
                    .keyboardShortcut("[", modifiers: [.command])
                Button("İleri") { model.goForward() }
                    .keyboardShortcut("]", modifiers: [.command])
                Button("Yenile") { model.reload() }
                    .keyboardShortcut("r", modifiers: [.command])
                Divider()
                Button("Yakınlaştır") { model.zoomIn() }
                    .keyboardShortcut("+", modifiers: [.command])
                Button("Uzaklaştır") { model.zoomOut() }
                    .keyboardShortcut("-", modifiers: [.command])
                Button("Gerçek Boyut") { model.resetZoom() }
                    .keyboardShortcut("0", modifiers: [.command])
                Divider()
                Button("Digital Center'a Dön") { model.goHome() }
                    .keyboardShortcut("1", modifiers: [.command])
                Button("Web Admin'e Git") { model.goAdmin() }
                    .keyboardShortcut("2", modifiers: [.command])
                Button("Tam Ekran") { NSApplication.shared.keyWindow?.toggleFullScreen(nil) }
                    .keyboardShortcut("f", modifiers: [.control, .command])
            }

            // Real admin-navigation.ts slugs — dashboard: "" (base /hk-admin),
            // musteriler, agent-hub — not guessed. Named "Git" rather than
            // "HK Digital" — the app (Bundle) menu is already titled
            // "HK Digital" (from CFBundleName), and a second menu bar item
            // with the identical title is genuinely ambiguous both for
            // accessibility tooling and for a person scanning the menu bar.
            CommandMenu("Git") {
                Button("Dashboard") { model.navigate(toSlug: "") }
                    .keyboardShortcut("d", modifiers: [.command, .shift])
                Button("Müşteriler") { model.navigate(toSlug: "musteriler") }
                    .keyboardShortcut("m", modifiers: [.command, .shift])
                Button("Agent Hub") { model.navigate(toSlug: "agent-hub") }
                    .keyboardShortcut("a", modifiers: [.command, .shift])
                Button("Belgeler") { model.navigate(toSlug: "belgeler") }
                Button("Raporlar") { model.navigate(toSlug: "musteri-raporlari") }
            }

            CommandMenu("Senkronizasyon") {
                Button("Senkronize Et") {
                    Task { await syncEngine.syncNow() }
                }
                .keyboardShortcut("s", modifiers: [.command, .shift])
            }

            CommandMenu("Yardım") {
                Button("HK Dijital Destek") { model.openSupport() }
                Button("Web Sitesini Tarayıcıda Aç") { model.openWebsiteInBrowser() }
            }
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    weak var database: LocalDatabase?
    weak var settings: AppSettings?

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard settings?.askSyncOnQuit != false, let database, database.pendingCount > 0 else {
            return .terminateNow
        }
        let alert = NSAlert()
        alert.messageText = "Web ile senkronize edilmemiş değişiklikler var."
        alert.informativeText = "Şimdi çıkarsanız değişiklikler yerelde kalır. Daha sonra Senkronizasyon Merkezi'nden gönderebilirsiniz."
        alert.addButton(withTitle: "Çık")
        alert.addButton(withTitle: "Vazgeç")
        return alert.runModal() == .alertFirstButtonReturn ? .terminateNow : .terminateCancel
    }
}
