import SwiftUI

struct OfflineDraftsView: View {
    @EnvironmentObject private var database: LocalDatabase
    @EnvironmentObject private var syncEngine: SyncEngine
    @State private var draftType: DraftType = .customerNote
    @State private var customerName = ""
    @State private var title = ""
    @State private var bodyText = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Text("Offline Taslaklar")
                    .font(.system(size: 28, weight: .black))
                Text("Müşteri notları, görevler, teklif/rapor/reklam yorumu ve paket notları offline kaydedilir. Kritik canlı işlemler offline yapılmaz.")
                    .foregroundStyle(.secondary)

                VStack(alignment: .leading, spacing: 14) {
                    Picker("Taslak tipi", selection: $draftType) {
                        ForEach(DraftType.allCases) { type in
                            Text(type.title).tag(type)
                        }
                    }
                    .pickerStyle(.menu)
                    TextField("Müşteri / firma adı", text: $customerName)
                    TextField("Başlık", text: $title)
                    TextEditor(text: $bodyText)
                        .frame(minHeight: 110)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.secondary.opacity(0.25)))
                    Button {
                        database.addDraft(type: draftType, customerName: customerName, title: title, body: bodyText)
                        customerName = ""
                        title = ""
                        bodyText = ""
                    } label: {
                        Label("Yerelde Kaydet", systemImage: "tray.and.arrow.down")
                    }
                    .disabled(bodyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
                .textFieldStyle(.roundedBorder)
                .buttonStyle(.borderedProminent)
                .padding(18)
                .background(.regularMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 18))

                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Text("Bekleyen ve kayıtlı taslaklar")
                            .font(.system(size: 18, weight: .black))
                        Spacer()
                        Button("Senkronize Et") {
                            Task { await syncEngine.syncNow() }
                        }
                        .disabled(syncEngine.isSyncing)
                    }

                    ForEach(database.drafts) { draft in
                        DraftRow(draft: draft)
                    }
                    if database.drafts.isEmpty {
                        VStack(spacing: 8) {
                            Image(systemName: "tray")
                                .font(.system(size: 26, weight: .bold))
                                .foregroundStyle(.secondary)
                            Text("Taslak yok")
                                .font(.system(size: 16, weight: .black))
                            Text("Offline oluşturulan güvenli taslaklar burada görünür.")
                                .foregroundStyle(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(24)
                        .background(.regularMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                    }
                }
            }
            .padding(28)
        }
    }
}

struct DraftRow: View {
    @EnvironmentObject private var database: LocalDatabase
    let draft: LocalDraft

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 6) {
                Text(draft.title)
                    .font(.system(size: 15, weight: .black))
                Text("\(draft.entityType.title) · \(draft.customerName.isEmpty ? "Müşteri belirtilmedi" : draft.customerName)")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.secondary)
                Text(draft.body)
                    .lineLimit(2)
                    .foregroundStyle(.secondary)
            }
            Spacer()
            Text(draft.syncStatus.title)
                .font(.system(size: 11, weight: .black))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(statusColor.opacity(0.14))
                .clipShape(Capsule())
            Button(role: .destructive) {
                database.deleteDraft(draft)
            } label: {
                Image(systemName: "trash")
            }
        }
        .padding(14)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var statusColor: Color {
        switch draft.syncStatus {
        case .pending: return .orange
        case .synced: return .green
        case .failed: return .red
        case .conflict: return .purple
        }
    }
}

struct SyncCenterView: View {
    @EnvironmentObject private var database: LocalDatabase
    @EnvironmentObject private var syncEngine: SyncEngine

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    VStack(alignment: .leading) {
                        Text("Senkronizasyon Merkezi")
                            .font(.system(size: 28, weight: .black))
                        Text(syncEngine.message)
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    Button {
                        Task { await syncEngine.syncNow() }
                    } label: {
                        Label(syncEngine.isSyncing ? "Çalışıyor" : "Tekrar Dene", systemImage: "arrow.triangle.2.circlepath")
                    }
                    .disabled(syncEngine.isSyncing)
                    .buttonStyle(.borderedProminent)
                }

                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                    InfoPanel(title: "Webden çekilenler", text: "Sunucudan gelen değişiklikler log listesinde pull yönüyle görünür.")
                    InfoPanel(title: "Webe gönderilenler", text: "Yerel pending taslaklar kabul edilirse synced durumuna alınır.")
                    InfoPanel(title: "Başarısız olanlar", text: "Yetki, oturum veya ağ hataları failed olarak saklanır ve tekrar denenebilir.")
                    InfoPanel(title: "Çakışmalar", text: "Aynı kayıt iki tarafta değişirse otomatik ezilmez; manuel çözüm bekler.")
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("Çakışmalar")
                        .font(.system(size: 18, weight: .black))
                    ForEach(database.conflicts) { conflict in
                        Text("\(conflict.entityType): \(conflict.message)")
                            .padding(12)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.purple.opacity(0.12))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    if database.conflicts.isEmpty {
                        Text("Aktif çakışma yok.")
                            .foregroundStyle(.secondary)
                    }
                }

                VStack(alignment: .leading, spacing: 12) {
                    Text("Log")
                        .font(.system(size: 18, weight: .black))
                    ForEach(database.logs) { log in
                        HStack {
                            Text(log.direction.uppercased())
                                .font(.system(size: 11, weight: .black))
                                .frame(width: 62, alignment: .leading)
                            VStack(alignment: .leading) {
                                Text(log.message)
                                Text(log.createdAt.formatted(date: .abbreviated, time: .shortened))
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(log.status)
                                .font(.caption.bold())
                        }
                        .padding(12)
                        .background(.regularMaterial)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
            }
            .padding(28)
        }
    }
}

struct SettingsView: View {
    @EnvironmentObject private var settings: AppSettings

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Text("Ayarlar")
                    .font(.system(size: 28, weight: .black))
                VStack(alignment: .leading, spacing: 12) {
                    Text("Adresler")
                        .font(.headline)
                TextField("Canlı web adresi", text: $settings.productionUrl)
                TextField("Admin adresi", text: $settings.adminUrl)
                }
                VStack(alignment: .leading, spacing: 12) {
                    Text("Cihaz")
                        .font(.headline)
                TextField("Cihaz adı", text: $settings.deviceName)
                Toggle("Otomatik senkronizasyon açık", isOn: $settings.autoSyncEnabled)
                Toggle("Çıkarken senkronize etmeyi sor", isOn: $settings.askSyncOnQuit)
                }
            Button("Ayarları Kaydet") {
                settings.save()
            }
            .buttonStyle(.borderedProminent)
            }
            .textFieldStyle(.roundedBorder)
            .padding(28)
        }
    }
}
