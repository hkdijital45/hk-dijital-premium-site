import Foundation

enum AppSection: String, CaseIterable, Identifiable {
    case dashboard = "Dashboard"
    case webAdmin = "Web Admin"
    case offlineDrafts = "Offline Taslaklar"
    case syncCenter = "Senkronizasyon Merkezi"
    case settings = "Ayarlar"

    var id: String { rawValue }

    var symbol: String {
        switch self {
        case .dashboard: return "gauge.with.dots.needle.67percent"
        case .webAdmin: return "globe"
        case .offlineDrafts: return "tray.and.arrow.down"
        case .syncCenter: return "arrow.triangle.2.circlepath"
        case .settings: return "gearshape"
        }
    }
}

enum DraftType: String, CaseIterable, Identifiable, Codable {
    case customerNote = "customer_note"
    case task = "task"
    case proposalDraft = "proposal_draft"
    case reportDraft = "report_draft"
    case adCommentDraft = "ad_comment_draft"
    case packagePriceNote = "package_price_note"
    case adminNote = "admin_note"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .customerNote: return "Müşteri Notu"
        case .task: return "Görev"
        case .proposalDraft: return "Teklif Taslağı"
        case .reportDraft: return "Rapor Taslağı"
        case .adCommentDraft: return "Reklam Yorumu Taslağı"
        case .packagePriceNote: return "Paket/Fiyat Notu"
        case .adminNote: return "Genel Admin Notu"
        }
    }
}

enum SyncStatus: String, Codable {
    case pending
    case synced
    case failed
    case conflict

    var title: String {
        switch self {
        case .pending: return "Senkronizasyon Bekliyor"
        case .synced: return "Senkronize"
        case .failed: return "Başarısız"
        case .conflict: return "Çakışma"
        }
    }
}

struct LocalDraft: Identifiable, Codable, Equatable {
    var id: String
    var remoteId: String?
    var entityType: DraftType
    var customerName: String
    var title: String
    var body: String
    var syncStatus: SyncStatus
    var createdAt: Date
    var updatedAt: Date
    var lastError: String?

    var payload: [String: String] {
        [
            "customerName": customerName,
            "title": title,
            "body": body
        ]
    }
}

struct SyncLogItem: Identifiable, Codable, Equatable {
    var id: String
    var direction: String
    var entityType: String
    var status: String
    var message: String
    var createdAt: Date
}

struct SyncConflict: Identifiable, Codable, Equatable {
    var id: String
    var entityType: String
    var localId: String
    var remoteId: String?
    var message: String
    var createdAt: Date
}

struct DesktopSyncChange: Codable {
    let localId: String
    let remoteId: String?
    let entityType: String
    let payload: [String: String]
    let updatedAt: String
}

struct DesktopSyncRequest: Codable {
    let clientId: String
    let deviceName: String
    let lastSyncAt: String?
    let localChanges: [DesktopSyncChange]
    let appVersion: String
}

struct DesktopSyncResponse: Codable {
    struct Change: Codable {
        let localId: String?
        let remoteId: String?
        let entityType: String?
        let status: String?
        let message: String?
        let updatedAt: String?
        let payload: [String: String]?
    }

    let serverTime: String
    let pulledChanges: [Change]
    let acceptedChanges: [Change]
    let rejectedChanges: [Change]
    let conflicts: [Change]
    let nextSyncToken: String?
}

let isoDateFormatter: ISO8601DateFormatter = {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter
}()

func isoString(_ date: Date) -> String {
    isoDateFormatter.string(from: date)
}

func dateFromIso(_ value: String?) -> Date {
    guard let value, let date = isoDateFormatter.date(from: value) else { return Date() }
    return date
}
