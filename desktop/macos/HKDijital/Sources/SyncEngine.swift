import Foundation
import WebKit

@MainActor
final class SyncEngine: ObservableObject {
    @Published private(set) var isSyncing = false
    @Published var message = "Senkronizasyon bekleniyor."

    private let config: DesktopConfig
    private let database: LocalDatabase
    private let settings: AppSettings

    init(config: DesktopConfig, database: LocalDatabase = .shared, settings: AppSettings) {
        self.config = config
        self.database = database
        self.settings = settings
    }

    var syncUrl: URL? {
        URL(string: "https://hkdijital.com.tr/api/desktop/sync")
    }

    func syncNow() async {
        guard NetworkMonitor.shared.isOnline else {
            message = "İnternet bağlantısı yok. Değişiklikler yerelde saklandı, bağlantı gelince senkronize edilebilir."
            database.addLog(direction: "sync", entityType: "all", status: "offline", message: message)
            database.reload()
            return
        }
        guard let syncUrl else {
            message = "Senkronizasyon adresi hazırlanamadı."
            return
        }

        isSyncing = true
        defer { isSyncing = false }

        do {
            let requestPayload = DesktopSyncRequest(
                clientId: clientId(),
                deviceName: settings.deviceName,
                lastSyncAt: database.setting("last_sync_at"),
                localChanges: database.pendingChanges(),
                appVersion: config.version
            )
            var request = URLRequest(url: syncUrl)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONEncoder().encode(requestPayload)
            let cookies = await webCookies(for: syncUrl)
            if !cookies.isEmpty {
                request.setValue(cookies.map { "\($0.name)=\($0.value)" }.joined(separator: "; "), forHTTPHeaderField: "Cookie")
            }

            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else {
                throw SyncError.failed("Sunucu yanıtı okunamadı.")
            }
            if http.statusCode == 401 {
                throw SyncError.failed("Web oturumu bulunamadı. Önce Web Admin üzerinden giriş yapın.")
            }
            if http.statusCode == 403 {
                throw SyncError.failed("Bu cihazdaki oturum admin yetkisine sahip değil.")
            }
            guard (200..<300).contains(http.statusCode) else {
                throw SyncError.failed("Senkronizasyon başarısız oldu. HTTP \(http.statusCode)")
            }

            let decoded = try JSONDecoder().decode(DesktopSyncResponse.self, from: data)
            database.applySyncResponse(decoded)
            message = "Senkronizasyon tamamlandı."
        } catch {
            message = error.localizedDescription
            database.addLog(direction: "sync", entityType: "all", status: "failed", message: message)
            database.reload()
        }
    }

    private func clientId() -> String {
        if let existing = database.setting("client_id"), !existing.isEmpty {
            return existing
        }
        let value = UUID().uuidString
        database.setSetting(key: "client_id", value: value)
        return value
    }

    private func webCookies(for url: URL) async -> [HTTPCookie] {
        await withCheckedContinuation { continuation in
            WKWebsiteDataStore.default().httpCookieStore.getAllCookies { cookies in
                continuation.resume(returning: cookies.filter { cookie in
                    guard let host = url.host else { return false }
                    let domain = cookie.domain.trimmingCharacters(in: CharacterSet(charactersIn: ".")).lowercased()
                    return host.lowercased().hasSuffix(domain) || domain.contains("hkdijital.com.tr")
                })
            }
        }
    }
}

enum SyncError: LocalizedError {
    case failed(String)

    var errorDescription: String? {
        switch self {
        case .failed(let message): return message
        }
    }
}
