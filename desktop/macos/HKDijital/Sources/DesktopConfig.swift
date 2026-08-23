import Foundation

struct DesktopConfig: Decodable {
    let appName: String
    let productionUrl: String
    let adminUrl: String
    let supportUrl: String
    let version: String
    let updateCheckUrl: String?
    let allowedHosts: [String]

    static func load() -> DesktopConfig {
        if let override = ProcessInfo.processInfo.environment["HK_DESKTOP_APP_URL"], !override.isEmpty {
            return DesktopConfig(
                appName: "HK Digital",
                productionUrl: override,
                adminUrl: override.replacingOccurrences(of: "/digital-center", with: "/hk-admin"),
                supportUrl: override,
                version: "1.0.0",
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
            appName: "HK Digital",
            productionUrl: "https://www.hkdijital.com.tr/digital-center",
            adminUrl: "https://www.hkdijital.com.tr/hk-admin",
            supportUrl: "https://www.hkdijital.com.tr/iletisim",
            version: "1.0.0",
            updateCheckUrl: nil,
            allowedHosts: ["hkdijital.com.tr", "www.hkdijital.com.tr"]
        )
    }
}
