import Foundation

struct DesktopConfig: Decodable {
    let appName: String
    let productionUrl: String
    let supportUrl: String
    let version: String
    let updateCheckUrl: String?
    let allowedHosts: [String]

    static func load() -> DesktopConfig {
        if let override = ProcessInfo.processInfo.environment["HK_DESKTOP_APP_URL"], !override.isEmpty {
            return DesktopConfig(
                appName: "HK Dijital",
                productionUrl: override,
                supportUrl: override,
                version: "0.1.0",
                updateCheckUrl: nil,
                allowedHosts: URL(string: override).flatMap { $0.host }.map { [$0] } ?? []
            )
        }

        if let url = Bundle.main.url(forResource: "desktop-config", withExtension: "json"),
           let data = try? Data(contentsOf: url),
           let config = try? JSONDecoder().decode(DesktopConfig.self, from: data) {
            return config
        }

        return DesktopConfig(
            appName: "HK Dijital",
            productionUrl: "https://hkdijital.com.tr/digital-center",
            supportUrl: "https://hkdijital.com.tr/iletisim",
            version: "0.1.0",
            updateCheckUrl: nil,
            allowedHosts: ["hkdijital.com.tr", "www.hkdijital.com.tr"]
        )
    }
}
