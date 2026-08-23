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

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
        private let model: WebViewModel
        // WKDownload doesn't carry a stable id of its own — map each live
        // download object to the DownloadManager entry it's tracked under.
        private var downloadIds: [ObjectIdentifier: UUID] = [:]

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
            // A download that got cancelled/interrupted mid-navigation also
            // lands here as a navigation error (NSURLErrorDomain -999 etc.)
            // — not a real "can't reach HK Dijital" failure, so don't show
            // the offline notice for it.
            if (error as NSError).code == NSURLErrorCancelled { model.isLoading = false; return }
            model.isLoading = false
            model.errorMessage = "İnternet bağlantınızı veya HK Dijital adresini kontrol edin."
            model.refreshNavigationState()
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            if (error as NSError).code == NSURLErrorCancelled { model.isLoading = false; return }
            model.isLoading = false
            model.errorMessage = "İnternet bağlantınızı veya HK Dijital adresini kontrol edin."
            model.refreshNavigationState()
        }

        // Content process crashed/was terminated by the system (memory
        // pressure etc.) — reload instead of leaving a dead, blank webview.
        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            webView.reload()
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

        // Real downloads (Word/PDF/PowerPoint exports etc.): the server
        // marks these Content-Disposition: attachment, and/or WebKit can't
        // render the MIME type inline either way — either signal routes the
        // response to WKDownload instead of trying to navigate to it.
        func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
            let isAttachment = (navigationResponse.response as? HTTPURLResponse)?
                .value(forHTTPHeaderField: "Content-Disposition")?
                .lowercased()
                .contains("attachment") ?? false

            if isAttachment || (!navigationResponse.canShowMIMEType && navigationResponse.isForMainFrame) {
                decisionHandler(.download)
                return
            }
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
            download.delegate = self
            let suggested = navigationResponse.response.suggestedFilename ?? "hk-dijital-dosya"
            let id = DownloadManager.shared.beginTracking(suggestedFileName: suggested)
            downloadIds[ObjectIdentifier(download)] = id
        }

        func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
            download.delegate = self
            let suggested = navigationAction.request.url?.lastPathComponent ?? "hk-dijital-dosya"
            let id = DownloadManager.shared.beginTracking(suggestedFileName: suggested)
            downloadIds[ObjectIdentifier(download)] = id
        }

        func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
            guard let id = downloadIds[ObjectIdentifier(download)] else {
                completionHandler(nil)
                return
            }
            completionHandler(DownloadManager.shared.resolveDestination(for: id, suggestedFileName: suggestedFilename))
        }

        func downloadDidFinish(_ download: WKDownload) {
            guard let id = downloadIds[ObjectIdentifier(download)] else { return }
            DownloadManager.shared.markCompleted(id: id)
            downloadIds.removeValue(forKey: ObjectIdentifier(download))
        }

        func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
            guard let id = downloadIds[ObjectIdentifier(download)] else { return }
            DownloadManager.shared.markFailed(id: id, message: error.localizedDescription)
            downloadIds.removeValue(forKey: ObjectIdentifier(download))
        }

        // window.open(...) / target="_blank": internal HK Dijital links stay
        // in this same window (no second, undelegated, permanently-blank
        // WKWebView left behind); anything else opens in the default
        // browser. Always returns nil — this app never spawns a real second
        // window for web content.
        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
            guard let url = navigationAction.request.url else { return nil }
            if ["http", "https"].contains(url.scheme?.lowercased() ?? ""), model.isAllowed(url) {
                webView.load(navigationAction.request)
            } else {
                NSWorkspace.shared.open(url)
            }
            return nil
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

        // alert()/confirm() from the web app rendered as real native macOS
        // dialogs rather than left unhandled (WKWebView doesn't show
        // anything for these by default without a UIDelegate implementation).
        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            let alert = NSAlert()
            alert.messageText = message
            alert.addButton(withTitle: "Tamam")
            alert.runModal()
            completionHandler()
        }

        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            let alert = NSAlert()
            alert.messageText = message
            alert.addButton(withTitle: "Tamam")
            alert.addButton(withTitle: "Vazgeç")
            completionHandler(alert.runModal() == .alertFirstButtonReturn)
        }

        @available(macOS 12.0, *)
        func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            decisionHandler(.prompt)
        }
    }
}
