import SwiftUI
import WebKit
import AppKit

@main
struct HKDijitalApp: App {
    @StateObject private var model = WebViewModel(config: DesktopConfig.load())

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(model)
                .frame(minWidth: 1100, minHeight: 720)
        }
        .commands {
            CommandGroup(replacing: .appInfo) {
                Button("HK Dijital Hakkında") {
                    NSApplication.shared.orderFrontStandardAboutPanel(nil)
                }
            }

            CommandGroup(replacing: .appTermination) {
                Button("Çıkış") {
                    NSApplication.shared.terminate(nil)
                }
                .keyboardShortcut("q", modifiers: [.command])
            }

            CommandMenu("Görünüm") {
                Button("Yenile") { model.reload() }
                    .keyboardShortcut("r", modifiers: [.command])
                Button("Geri") { model.goBack() }
                    .keyboardShortcut("[", modifiers: [.command])
                Button("İleri") { model.goForward() }
                    .keyboardShortcut("]", modifiers: [.command])
                Divider()
                Button("Digital Center'a Dön") { model.goHome() }
                    .keyboardShortcut("1", modifiers: [.command])
                Button("Tam Ekran") { NSApplication.shared.keyWindow?.toggleFullScreen(nil) }
                    .keyboardShortcut("f", modifiers: [.control, .command])
            }

            CommandMenu("Yardım") {
                Button("HK Dijital Destek") { model.openSupport() }
                Button("Web Sitesini Tarayıcıda Aç") { model.openWebsiteInBrowser() }
            }
        }
    }
}
