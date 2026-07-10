import SwiftUI

struct OfflineDashboardView: View {
    @EnvironmentObject private var database: LocalDatabase
    @EnvironmentObject private var network: NetworkMonitor
    @EnvironmentObject private var syncEngine: SyncEngine
    @Binding var section: AppSection

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("HK Dijital Admin hazırlanıyor…")
                        .font(.system(size: 30, weight: .black))
                    Text("Web admin online çalışır; internet yoksa güvenli taslaklar yerel SQLite veritabanına kaydedilir.")
                        .foregroundStyle(.secondary)
                }

                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 16), count: 4), spacing: 16) {
                    DashboardMetric(title: "Bağlantı", value: network.isOnline ? "Online" : "Offline", systemImage: network.isOnline ? "wifi" : "wifi.slash")
                    DashboardMetric(title: "Bekleyen", value: "\(database.pendingCount)", systemImage: "clock.arrow.circlepath")
                    DashboardMetric(title: "Çakışma", value: "\(database.conflictCount)", systemImage: "exclamationmark.triangle")
                    DashboardMetric(title: "Son Sync", value: database.lastSyncAt?.formatted(date: .abbreviated, time: .shortened) ?? "Yok", systemImage: "calendar")
                }

                HStack(spacing: 12) {
                    Button {
                        section = .webAdmin
                    } label: {
                        Label("Web Admin'e Git", systemImage: "globe")
                    }
                    Button {
                        section = .offlineDrafts
                    } label: {
                        Label("Offline Taslak Oluştur", systemImage: "square.and.pencil")
                    }
                    Button {
                        Task { await syncEngine.syncNow() }
                    } label: {
                        Label("Senkronize Et", systemImage: "arrow.triangle.2.circlepath")
                    }
                    .disabled(syncEngine.isSyncing)
                }
                .buttonStyle(.borderedProminent)

                InfoPanel(
                    title: "Offline güvenlik sınırı",
                    text: "Müşteri silme, ödeme silme, kullanıcı yetkisi değiştirme, auth işlemleri ve entegrasyon token işlemleri sadece online web admin üzerinden yapılır."
                )
            }
            .padding(28)
        }
    }
}

struct DashboardMetric: View {
    let title: String
    let value: String
    let systemImage: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 22, weight: .bold))
                .foregroundStyle(.cyan)
            Text(value)
                .font(.system(size: 24, weight: .black))
            Text(title)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 18))
    }
}

struct InfoPanel: View {
    let title: String
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.system(size: 16, weight: .black))
            Text(text)
                .foregroundStyle(.secondary)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.cyan.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 18))
    }
}
