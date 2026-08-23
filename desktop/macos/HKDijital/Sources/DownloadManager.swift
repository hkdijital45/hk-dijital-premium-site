import Foundation
import AppKit
import SwiftUI
import WebKit
import UserNotifications

enum DownloadStatus: Equatable {
    case downloading
    case completed
    case failed(String)
}

struct DownloadItem: Identifiable {
    let id = UUID()
    var fileName: String
    var destinationURL: URL?
    var status: DownloadStatus
    let startedAt: Date = Date()
}

/// Minimal native download manager (section 37: "aşırı karmaşık yapma") —
/// tracks what WKDownload hands us, resolves a safe destination in
/// ~/Downloads with real duplicate-filename handling, and exposes
/// Aç/Finder'da Göster. Server-provided filenames are sanitized against
/// path traversal before ever touching the filesystem.
final class DownloadManager: NSObject, ObservableObject {
    static let shared = DownloadManager()

    @Published private(set) var items: [DownloadItem] = []

    private override init() {
        super.init()
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    /// Strips path components and any character that isn't safe in a single
    /// filesystem path segment — a server-provided name containing "../" or
    /// an absolute path can never escape the Downloads folder this way.
    private func sanitizedFileName(_ raw: String) -> String {
        let base = (raw as NSString).lastPathComponent
        let cleaned = base.replacingOccurrences(of: "..", with: "")
        let trimmed = cleaned.trimmingCharacters(in: .whitespacesAndNewlines)
        return trimmed.isEmpty ? "hk-dijital-dosya" : trimmed
    }

    private func uniqueDestination(for fileName: String, in directory: URL) -> URL {
        let safeName = sanitizedFileName(fileName)
        let ext = (safeName as NSString).pathExtension
        let base = ext.isEmpty ? safeName : String(safeName.dropLast(ext.count + 1))
        var candidate = directory.appendingPathComponent(safeName)
        var counter = 2
        while FileManager.default.fileExists(atPath: candidate.path) {
            let numbered = ext.isEmpty ? "\(base) \(counter)" : "\(base) \(counter).\(ext)"
            candidate = directory.appendingPathComponent(numbered)
            counter += 1
        }
        return candidate
    }

    func downloadsDirectory() -> URL {
        FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask).first
            ?? FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Downloads")
    }

    @discardableResult
    func beginTracking(suggestedFileName: String) -> UUID {
        let item = DownloadItem(fileName: sanitizedFileName(suggestedFileName), destinationURL: nil, status: .downloading)
        DispatchQueue.main.async { self.items.insert(item, at: 0) }
        return item.id
    }

    func resolveDestination(for id: UUID, suggestedFileName: String) -> URL {
        let directory = downloadsDirectory()
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let destination = uniqueDestination(for: suggestedFileName, in: directory)
        DispatchQueue.main.async {
            guard let index = self.items.firstIndex(where: { $0.id == id }) else { return }
            self.items[index].destinationURL = destination
            self.items[index].fileName = destination.lastPathComponent
        }
        return destination
    }

    func markCompleted(id: UUID) {
        DispatchQueue.main.async {
            guard let index = self.items.firstIndex(where: { $0.id == id }) else { return }
            self.items[index].status = .completed
            self.notifyCompletion(fileName: self.items[index].fileName)
        }
    }

    func markFailed(id: UUID, message: String) {
        DispatchQueue.main.async {
            guard let index = self.items.firstIndex(where: { $0.id == id }) else { return }
            self.items[index].status = .failed(message)
            let content = UNMutableNotificationContent()
            content.title = "İndirme başarısız"
            content.body = "\(self.items[index].fileName) indirilemedi."
            UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil))
        }
    }

    private func notifyCompletion(fileName: String) {
        let content = UNMutableNotificationContent()
        content.title = "İndirme tamamlandı"
        content.body = "\(fileName) indirildi."
        UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil))
    }

    func open(_ item: DownloadItem) {
        guard let url = item.destinationURL else { return }
        NSWorkspace.shared.open(url)
    }

    func reveal(_ item: DownloadItem) {
        guard let url = item.destinationURL else { return }
        NSWorkspace.shared.activateFileViewerSelecting([url])
    }

    func openDownloadsFolder() {
        NSWorkspace.shared.open(downloadsDirectory())
    }
}

/// Minimum viable "İndirilenler" screen (section 37): file name, status,
/// location, Aç / Finder'da Göster. Nothing more elaborate.
struct DownloadsView: View {
    @ObservedObject private var manager = DownloadManager.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("İndirilenler")
                    .font(.system(size: 20, weight: .black))
                Spacer()
                Button("İndirilenler Klasörünü Aç") { manager.openDownloadsFolder() }
            }
            .padding(16)

            Divider()

            if manager.items.isEmpty {
                VStack(spacing: 10) {
                    Image(systemName: "arrow.down.circle")
                        .font(.system(size: 34))
                        .foregroundStyle(.secondary)
                    Text("Henüz indirme yok.")
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(manager.items) { item in
                    HStack(spacing: 12) {
                        Image(systemName: iconName(for: item.status))
                            .foregroundStyle(color(for: item.status))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.fileName).font(.system(size: 13, weight: .semibold))
                            Text(statusText(item.status))
                                .font(.system(size: 11))
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        if case .completed = item.status {
                            Button("Aç") { manager.open(item) }
                            Button("Finder'da Göster") { manager.reveal(item) }
                        }
                    }
                    .padding(.vertical, 4)
                }
                .listStyle(.inset)
            }
        }
    }

    private func iconName(for status: DownloadStatus) -> String {
        switch status {
        case .downloading: return "arrow.down.circle"
        case .completed: return "checkmark.circle.fill"
        case .failed: return "xmark.circle.fill"
        }
    }

    private func color(for status: DownloadStatus) -> Color {
        switch status {
        case .downloading: return .secondary
        case .completed: return .green
        case .failed: return .red
        }
    }

    private func statusText(_ status: DownloadStatus) -> String {
        switch status {
        case .downloading: return "İndiriliyor..."
        case .completed: return "Tamamlandı"
        case .failed(let message): return "Başarısız: \(message)"
        }
    }
}
