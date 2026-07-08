import SwiftUI
import AppKit
import WebKit

struct WebViewContainer: NSViewRepresentable {
    @EnvironmentObject private var model: WebViewModel

    func makeCoordinator() -> Coordinator {
        Coordinator(model: model)
    }

    func makeNSView(context: Context) -> WKWebView {
        model.webView.navigationDelegate = context.coordinator
        model.webView.uiDelegate = context.coordinator
        return model.webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        private let model: WebViewModel

        init(model: WebViewModel) {
            self.model = model
        }

        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            model.errorMessage = nil
            model.isLoading = true
            model.refreshNavigationState()
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            model.isLoading = false
            model.refreshNavigationState()
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            model.isLoading = false
            model.errorMessage = "İnternet bağlantınızı veya HK Dijital adresini kontrol edin."
            model.refreshNavigationState()
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            model.isLoading = false
            model.errorMessage = "İnternet bağlantınızı veya HK Dijital adresini kontrol edin."
            model.refreshNavigationState()
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            if ["http", "https"].contains(url.scheme?.lowercased() ?? ""), model.isAllowed(url) {
                decisionHandler(.allow)
                return
            }

            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
        }

        func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
            let panel = NSOpenPanel()
            panel.allowsMultipleSelection = parameters.allowsMultipleSelection
            panel.canChooseFiles = true
            panel.canChooseDirectories = false
            panel.begin { response in
                completionHandler(response == .OK ? panel.urls : nil)
            }
        }

        @available(macOS 12.0, *)
        func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            decisionHandler(.prompt)
        }
    }
}
