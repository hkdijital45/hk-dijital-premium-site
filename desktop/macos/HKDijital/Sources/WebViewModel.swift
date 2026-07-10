import Foundation
import Combine
import AppKit
import WebKit

final class WebViewModel: ObservableObject {
    let config: DesktopConfig
    let webView: WKWebView
    @Published var isLoading = true
    @Published var errorMessage: String?
    @Published var canGoBack = false
    @Published var canGoForward = false

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
        guard webView.url == nil, let url = productionURL else {
            return
        }
        webView.load(URLRequest(url: url))
    }

    func reload() {
        errorMessage = nil
        if webView.url == nil, let url = productionURL {
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
        if let url = productionURL {
            webView.load(URLRequest(url: url))
        }
    }

    func goAdmin() {
        errorMessage = nil
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

    func isAllowed(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return false }
        return config.allowedHosts.map { $0.lowercased() }.contains(host)
    }
}
