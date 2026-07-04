import Foundation
import Combine
import WebKit

final class WebViewModel: ObservableObject {
    let config: DesktopConfig
    let webView: WKWebView
    @Published var isLoading = true
    @Published var errorMessage: String?

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

    func isAllowed(_ url: URL) -> Bool {
        guard let host = url.host?.lowercased() else { return false }
        return config.allowedHosts.map { $0.lowercased() }.contains(host)
    }
}
