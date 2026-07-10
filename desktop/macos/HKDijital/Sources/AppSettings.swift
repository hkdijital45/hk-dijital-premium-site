import Foundation

final class AppSettings: ObservableObject {
    @Published var productionUrl: String
    @Published var adminUrl: String
    @Published var deviceName: String
    @Published var autoSyncEnabled: Bool
    @Published var askSyncOnQuit: Bool

    private let database: LocalDatabase

    init(config: DesktopConfig, database: LocalDatabase = .shared) {
        self.database = database
        self.productionUrl = database.setting("production_url") ?? config.productionUrl
        self.adminUrl = database.setting("admin_url") ?? config.adminUrl
        self.deviceName = database.setting("device_name") ?? Host.current().localizedName ?? "HK Dijital Mac"
        self.autoSyncEnabled = database.setting("auto_sync_enabled") != "false"
        self.askSyncOnQuit = database.setting("ask_sync_on_quit") != "false"
    }

    func save() {
        database.setSetting(key: "production_url", value: productionUrl)
        database.setSetting(key: "admin_url", value: adminUrl)
        database.setSetting(key: "device_name", value: deviceName)
        database.setSetting(key: "auto_sync_enabled", value: autoSyncEnabled ? "true" : "false")
        database.setSetting(key: "ask_sync_on_quit", value: askSyncOnQuit ? "true" : "false")
        database.addLog(direction: "local", entityType: "settings", status: "saved", message: "Uygulama ayarları kaydedildi.")
    }
}
