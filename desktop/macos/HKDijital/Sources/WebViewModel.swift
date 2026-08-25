import Foundation
import Combine
import AppKit
import SwiftUI
import WebKit

final class WebViewModel: ObservableObject {
    let config: DesktopConfig
    let webView: WKWebView
    @Published var isLoading = true
    @Published var errorMessage: String?
    @Published var canGoBack = false
    @Published var canGoForward = false
    // Driven both by sidebar taps (ContentView) and by native menu commands
    // (HKDijitalApp's .commands, which have no direct access to ContentView's
    // own view state) — one shared source of truth for "which section is active."
    @Published var activeSection: AppSection = .webAdmin
    // Local app preference only (UserDefaults) — not a Supabase/server value,
    // so it needs no migration and has no relation to any account/customer data.
    private static let sidebarCollapsedDefaultsKey = "hk.desktop.sidebarCollapsed"
    @Published var isSidebarCollapsed: Bool = UserDefaults.standard.bool(forKey: WebViewModel.sidebarCollapsedDefaultsKey)

    init(config: DesktopConfig) {
        self.config = config

        let preferences = WKWebpagePreferences()
        preferences.allowsContentJavaScript = true

        let webConfig = WKWebViewConfiguration()
        webConfig.defaultWebpagePreferences = preferences
        webConfig.websiteDataStore = .default()
        webConfig.allowsAirPlayForMediaPlayback = true
        webConfig.mediaTypesRequiringUserActionForPlayback = []

        self.webView = WKWebView(frame: .zero, configuration: webConfig)
        self.webView.allowsBackForwardNavigationGestures = true
    }

    var productionURL: URL? {
        URL(string: config.productionUrl)
    }

    var adminURL: URL? {
        URL(string: config.adminUrl)
    }

    var websiteURL: URL? {
        guard let productionURL else { return nil }
        var components = URLComponents(url: productionURL, resolvingAgainstBaseURL: false)
        components?.path = ""
        components?.query = nil
        components?.fragment = nil
        return components?.url
    }

    func loadInitialPage() {
        // This is the admin desktop client (see DesktopConfig.appName / the
        // whole point of this shell) — it opens straight to /hk-admin, not
        // the customer-facing /digital-center that `productionUrl` (shared
        // with the Windows client's own config semantics — not repurposed
        // here) points at. "Digital Center'a Dön" in the Görünüm menu still
        // reaches it via goHome().
        guard webView.url == nil, let url = adminURL else {
            return
        }
        webView.load(URLRequest(url: url))
    }

    // Real admin-navigation.ts slugs (not guessed) — used by the app's
    // quick-navigation shortcuts (⌘⇧D/⌘⇧M/⌘⇧A) and the Dosya menu. Also
    // switches the sidebar to the web view, since these are all invoked
    // from native Commands that may fire while another section is active.
    func navigate(toSlug slug: String) {
        errorMessage = nil
        activeSection = .webAdmin
        guard let base = adminURL else { return }
        let url = slug.isEmpty ? base : base.appendingPathComponent(slug)
        webView.load(URLRequest(url: url))
    }

    func zoomIn() {
        webView.pageZoom = min(webView.pageZoom + 0.1, 3.0)
    }

    func zoomOut() {
        webView.pageZoom = max(webView.pageZoom - 0.1, 0.5)
    }

    func resetZoom() {
        webView.pageZoom = 1.0
    }

    func reload() {
        errorMessage = nil
        if webView.url == nil, let url = adminURL {
            webView.load(URLRequest(url: url))
        } else {
            webView.reload()
        }
    }

    func goBack() {
        if webView.canGoBack { webView.goBack() }
    }

    func goForward() {
        if webView.canGoForward { webView.goForward() }
    }

    func goHome() {
        errorMessage = nil
        activeSection = .webAdmin
        if let url = productionURL {
            webView.load(URLRequest(url: url))
        }
    }

    func goAdmin() {
        errorMessage = nil
        activeSection = .webAdmin
        if let url = adminURL {
            webView.load(URLRequest(url: url))
        }
    }

    func openSupport() {
        if let url = URL(string: config.supportUrl) {
            NSWorkspace.shared.open(url)
        }
    }

    func openWebsiteInBrowser() {
        if let url = websiteURL {
            NSWorkspace.shared.open(url)
        }
    }

    func refreshNavigationState() {
        canGoBack = webView.canGoBack
        canGoForward = webView.canGoForward
    }

    func toggleSidebar() {
        withAnimation(.easeInOut(duration: 0.22)) {
            isSidebarCollapsed.toggle()
        }
        UserDefaults.standard.set(isSidebarCollapsed, forKey: Self.sidebarCollapsedDefaultsKey)
    }

    func isAllowed(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return false }
        return config.allowedHosts.map { $0.lowercased() }.contains(host)
    }
}
