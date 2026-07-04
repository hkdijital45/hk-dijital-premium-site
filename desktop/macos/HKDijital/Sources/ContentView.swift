import SwiftUI
import WebKit

struct ContentView: View {
    @EnvironmentObject private var model: WebViewModel

    var body: some View {
        ZStack {
            WebViewContainer()
                .environmentObject(model)

            if model.isLoading {
                SplashView(title: model.config.appName)
            }

            if let error = model.errorMessage {
                OfflineView(message: error, supportUrl: model.config.supportUrl) {
                    model.reload()
                }
            }
        }
        .onAppear {
            model.loadInitialPage()
        }
    }
}

struct SplashView: View {
    let title: String

    var body: some View {
        VStack(spacing: 14) {
            ProgressView()
                .scaleEffect(1.2)
            Text(title)
                .font(.system(size: 26, weight: .black))
            Text("Digital Center yükleniyor...")
                .foregroundStyle(.secondary)
        }
        .padding(34)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 24))
        .shadow(radius: 24)
    }
}

struct OfflineView: View {
    let message: String
    let supportUrl: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Text("Bağlantı kurulamadı")
                .font(.system(size: 28, weight: .black))
            Text(message)
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            HStack {
                Button("Yeniden Dene", action: retry)
                    .buttonStyle(.borderedProminent)
                if let url = URL(string: supportUrl) {
                    Link("Destek", destination: url)
                }
            }
        }
        .padding(34)
        .frame(maxWidth: 520)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 24))
        .shadow(radius: 24)
    }
}
