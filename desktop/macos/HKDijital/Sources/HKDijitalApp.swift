import SwiftUI
import WebKit

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
            CommandMenu("HK Dijital") {
                Button("Yenile") { model.reload() }
                    .keyboardShortcut("r", modifiers: [.command])
                Button("Geri") { model.goBack() }
                    .keyboardShortcut("[", modifiers: [.command])
                Button("İleri") { model.goForward() }
                    .keyboardShortcut("]", modifiers: [.command])
                Divider()
                Button("Çıkış") { NSApplication.shared.terminate(nil) }
                    .keyboardShortcut("q", modifiers: [.command])
            }
        }
    }
}
