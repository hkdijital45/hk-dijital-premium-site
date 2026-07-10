import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var model: WebViewModel
    @EnvironmentObject private var database: LocalDatabase
    @EnvironmentObject private var network: NetworkMonitor
    @EnvironmentObject private var syncEngine: SyncEngine
    @EnvironmentObject private var settings: AppSettings
    @State private var section: AppSection = .dashboard

    var body: some View {
        HStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 10) {
                Text("HK Dijital Admin")
                    .font(.system(size: 18, weight: .black))
                    .padding(.horizontal, 14)
                    .padding(.top, 16)

                ForEach(AppSection.allCases) { item in
                    Button {
                        section = item
                    } label: {
                        Label(item.rawValue, systemImage: item.symbol)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .buttonStyle(.plain)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(section == item ? Color.cyan.opacity(0.16) : Color.clear)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal, 8)
                }

                Spacer()
            }
            .frame(width: 240)
            .background(.regularMaterial)

            Divider()

            VStack(spacing: 0) {
                NativeToolbar(section: $section)
                Divider()
                Group {
                    switch section {
                    case .dashboard:
                        OfflineDashboardView(section: $section)
                    case .webAdmin:
                        WebShellView()
                    case .offlineDrafts:
                        OfflineDraftsView()
                    case .syncCenter:
                        SyncCenterView()
                    case .settings:
                        SettingsView()
                    }
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .background(Color(nsColor: .windowBackgroundColor))
        .onAppear {
            model.loadInitialPage()
            database.reload()
        }
    }
}

struct NativeToolbar: View {
    @EnvironmentObject private var model: WebViewModel
    @EnvironmentObject private var database: LocalDatabase
    @EnvironmentObject private var network: NetworkMonitor
    @EnvironmentObject private var syncEngine: SyncEngine
    @Binding var section: AppSection

    var body: some View {
        HStack(spacing: 12) {
            Text("HK Dijital Admin")
                .font(.system(size: 15, weight: .black))

            StatusPill(isOnline: network.isOnline)

            if let lastSyncAt = database.lastSyncAt {
                Text("Son sync: \(lastSyncAt.formatted(date: .omitted, time: .shortened))")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.secondary)
            } else {
                Text("Henüz sync yok")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Button {
                section = .webAdmin
                model.goAdmin()
            } label: {
                Label("Web Admin'e Git", systemImage: "globe")
            }

            Button {
                model.reload()
            } label: {
                Image(systemName: "arrow.clockwise")
            }
            .help("Yenile")

            Button {
                Task { await syncEngine.syncNow() }
            } label: {
                Label(syncEngine.isSyncing ? "Senkronize ediliyor..." : "Senkronize Et", systemImage: "arrow.triangle.2.circlepath")
            }
            .disabled(syncEngine.isSyncing)
            .buttonStyle(.borderedProminent)
        }
        .buttonStyle(.bordered)
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .background(.regularMaterial)
    }
}

struct StatusPill: View {
    let isOnline: Bool

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(isOnline ? Color.green : Color.red)
                .frame(width: 8, height: 8)
            Text(isOnline ? "Online" : "Offline")
                .font(.system(size: 12, weight: .bold))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(isOnline ? Color.green.opacity(0.12) : Color.red.opacity(0.12))
        .clipShape(Capsule())
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
            Text("HK Dijital Admin hazırlanıyor...")
                .foregroundStyle(.secondary)
        }
        .padding(34)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 24))
        .shadow(radius: 24)
    }
}
