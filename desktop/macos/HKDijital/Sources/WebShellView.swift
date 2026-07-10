import SwiftUI

struct WebShellView: View {
    @EnvironmentObject private var model: WebViewModel
    @EnvironmentObject private var network: NetworkMonitor

    var body: some View {
        ZStack {
            WebViewContainer()
                .environmentObject(model)

            if model.isLoading {
                SplashView(title: model.config.appName)
            }

            if !network.isOnline || model.errorMessage != nil {
                OfflineWebNotice(message: model.errorMessage ?? "İnternet bağlantısı yok.") {
                    model.reload()
                }
            }
        }
    }
}

struct OfflineWebNotice: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Text("Web Admin'e ulaşılamıyor")
                .font(.system(size: 28, weight: .black))
            Text("Offline modda taslak oluşturabilir, bağlantı gelince senkronize edebilirsiniz.\n\(message)")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            Button("Tekrar Dene", action: retry)
                .buttonStyle(.borderedProminent)
        }
        .padding(34)
        .frame(maxWidth: 560)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 24))
        .shadow(radius: 24)
    }
}
