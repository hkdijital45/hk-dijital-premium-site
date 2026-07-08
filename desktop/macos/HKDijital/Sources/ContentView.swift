import SwiftUI
import WebKit

struct ContentView: View {
    @EnvironmentObject private var model: WebViewModel

    var body: some View {
        VStack(spacing: 0) {
            NativeToolbar()

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
        }
        .background(Color(nsColor: .windowBackgroundColor))
        .onAppear {
            model.loadInitialPage()
        }
    }
}

struct NativeToolbar: View {
    @EnvironmentObject private var model: WebViewModel

    var body: some View {
        HStack(spacing: 12) {
            Text("HK Dijital")
                .font(.system(size: 15, weight: .black))
                .foregroundStyle(.primary)

            Divider()
                .frame(height: 22)

            Button {
                model.goBack()
            } label: {
                Image(systemName: "chevron.left")
            }
            .disabled(!model.canGoBack)
            .help("Geri")

            Button {
                model.goForward()
            } label: {
                Image(systemName: "chevron.right")
            }
            .disabled(!model.canGoForward)
            .help("İleri")

            Button {
                model.reload()
            } label: {
                Image(systemName: "arrow.clockwise")
            }
            .help("Yenile")

            Button {
                model.goHome()
            } label: {
                Label("Digital Center", systemImage: "house")
            }
            .help("Digital Center'a dön")

            Spacer()

            HStack(spacing: 6) {
                Circle()
                    .fill(model.errorMessage == nil ? Color.green : Color.red)
                    .frame(width: 8, height: 8)
                Text(model.errorMessage == nil ? "Çevrimiçi" : "Bağlantı yok")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.secondary)
            }
        }
        .buttonStyle(.bordered)
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.regularMaterial)
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
            Text("Digital Center hazırlanıyor...")
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
            Text("Bağlantı yok")
                .font(.system(size: 28, weight: .black))
            Text("İnternet bağlantınızı kontrol edin.\n\(message)")
                .multilineTextAlignment(.center)
                .foregroundStyle(.secondary)
            HStack {
                Button("Tekrar Dene", action: retry)
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
