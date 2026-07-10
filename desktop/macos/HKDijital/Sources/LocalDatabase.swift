import Foundation
import SQLite3

final class LocalDatabase: ObservableObject {
    static let shared = LocalDatabase()

    @Published private(set) var drafts: [LocalDraft] = []
    @Published private(set) var logs: [SyncLogItem] = []
    @Published private(set) var conflicts: [SyncConflict] = []
    @Published private(set) var lastSyncAt: Date?

    private var db: OpaquePointer?

    private init() {
        open()
        migrate()
        reload()
    }

    deinit {
        sqlite3_close(db)
    }

    var pendingCount: Int {
        drafts.filter { $0.syncStatus == .pending || $0.syncStatus == .failed }.count
    }

    var conflictCount: Int {
        drafts.filter { $0.syncStatus == .conflict }.count + conflicts.count
    }

    func addDraft(type: DraftType, customerName: String, title: String, body: String) {
        let now = Date()
        let draft = LocalDraft(
            id: UUID().uuidString,
            remoteId: nil,
            entityType: type,
            customerName: customerName,
            title: title.isEmpty ? type.title : title,
            body: body,
            syncStatus: .pending,
            createdAt: now,
            updatedAt: now,
            lastError: nil
        )
        execute(
            """
            insert into local_drafts(local_id, remote_id, entity_type, customer_name, title, body, sync_status, created_at, updated_at, last_error)
            values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [draft.id, draft.remoteId ?? "", draft.entityType.rawValue, draft.customerName, draft.title, draft.body, draft.syncStatus.rawValue, isoString(draft.createdAt), isoString(draft.updatedAt), ""]
        )
        addLog(direction: "local", entityType: draft.entityType.rawValue, status: "pending", message: "\(draft.entityType.title) yerelde kaydedildi.")
        reload()
    }

    func deleteDraft(_ draft: LocalDraft) {
        execute("delete from local_drafts where local_id = ?", [draft.id])
        addLog(direction: "local", entityType: draft.entityType.rawValue, status: "deleted", message: "Yerel taslak silindi.")
        reload()
    }

    func pendingChanges() -> [DesktopSyncChange] {
        drafts
            .filter { $0.syncStatus == .pending || $0.syncStatus == .failed }
            .map {
                DesktopSyncChange(
                    localId: $0.id,
                    remoteId: $0.remoteId,
                    entityType: $0.entityType.rawValue,
                    payload: $0.payload,
                    updatedAt: isoString($0.updatedAt)
                )
            }
    }

    func applySyncResponse(_ response: DesktopSyncResponse) {
        for accepted in response.acceptedChanges {
            guard let localId = accepted.localId else { continue }
            execute(
                "update local_drafts set remote_id = ?, sync_status = ?, updated_at = ?, last_error = ? where local_id = ?",
                [accepted.remoteId ?? "", SyncStatus.synced.rawValue, accepted.updatedAt ?? response.serverTime, "", localId]
            )
        }

        for rejected in response.rejectedChanges {
            guard let localId = rejected.localId else { continue }
            execute(
                "update local_drafts set sync_status = ?, last_error = ? where local_id = ?",
                [SyncStatus.failed.rawValue, rejected.message ?? "Senkronizasyon reddedildi.", localId]
            )
        }

        for conflict in response.conflicts {
            let localId = conflict.localId ?? UUID().uuidString
            execute(
                "update local_drafts set sync_status = ?, last_error = ? where local_id = ?",
                [SyncStatus.conflict.rawValue, conflict.message ?? "Çakışma var.", localId]
            )
            execute(
                "insert into sync_conflicts(conflict_id, entity_type, local_id, remote_id, message, created_at) values(?, ?, ?, ?, ?, ?)",
                [UUID().uuidString, conflict.entityType ?? "draft", localId, conflict.remoteId ?? "", conflict.message ?? "Manuel çözüm gerekiyor.", response.serverTime]
            )
        }

        for pulled in response.pulledChanges {
            addLog(direction: "pull", entityType: pulled.entityType ?? "draft", status: pulled.status ?? "pulled", message: pulled.message ?? "Webden güncel kayıt alındı.")
        }

        setSetting(key: "last_sync_at", value: response.serverTime)
        addLog(direction: "sync", entityType: "all", status: "completed", message: "Senkronizasyon tamamlandı.")
        reload()
    }

    func addLog(direction: String, entityType: String, status: String, message: String) {
        execute(
            "insert into sync_log(log_id, direction, entity_type, status, message, created_at) values(?, ?, ?, ?, ?, ?)",
            [UUID().uuidString, direction, entityType, status, message, isoString(Date())]
        )
    }

    func setting(_ key: String) -> String? {
        guard let db else { return nil }
        var statement: OpaquePointer?
        defer { sqlite3_finalize(statement) }
        sqlite3_prepare_v2(db, "select value from app_settings where key = ? limit 1", -1, &statement, nil)
        sqlite3_bind_text(statement, 1, key, -1, SQLITE_TRANSIENT)
        if sqlite3_step(statement) == SQLITE_ROW, let value = sqlite3_column_text(statement, 0) {
            return String(cString: value)
        }
        return nil
    }

    func setSetting(key: String, value: String) {
        execute("insert or replace into app_settings(key, value, updated_at) values(?, ?, ?)", [key, value, isoString(Date())])
    }

    func reload() {
        drafts = fetchDrafts()
        logs = fetchLogs()
        conflicts = fetchConflicts()
        if let rawLastSync = setting("last_sync_at"), !rawLastSync.isEmpty {
            lastSyncAt = dateFromIso(rawLastSync)
        } else {
            lastSyncAt = nil
        }
    }

    private func open() {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let folder = support.appendingPathComponent("HKDijitalAdmin", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let path = folder.appendingPathComponent("admin.sqlite").path
        sqlite3_open(path, &db)
    }

    private func migrate() {
        execute("""
        create table if not exists local_drafts(
          local_id text primary key,
          remote_id text,
          entity_type text not null,
          customer_name text,
          title text not null,
          body text,
          sync_status text not null,
          created_at text not null,
          updated_at text not null,
          last_error text
        )
        """)
        execute("""
        create table if not exists sync_queue(
          queue_id text primary key,
          local_id text,
          entity_type text,
          payload_json text,
          sync_status text,
          created_at text,
          updated_at text,
          last_error text
        )
        """)
        execute("create table if not exists sync_state(key text primary key, value text, updated_at text)")
        execute("""
        create table if not exists sync_log(
          log_id text primary key,
          direction text,
          entity_type text,
          status text,
          message text,
          created_at text
        )
        """)
        execute("""
        create table if not exists sync_conflicts(
          conflict_id text primary key,
          entity_type text,
          local_id text,
          remote_id text,
          message text,
          created_at text
        )
        """)
        execute("create table if not exists app_settings(key text primary key, value text, updated_at text)")
    }

    private func fetchDrafts() -> [LocalDraft] {
        query("select local_id, remote_id, entity_type, customer_name, title, body, sync_status, created_at, updated_at, last_error from local_drafts order by updated_at desc") { row in
            LocalDraft(
                id: row[0],
                remoteId: row[1].isEmpty ? nil : row[1],
                entityType: DraftType(rawValue: row[2]) ?? .adminNote,
                customerName: row[3],
                title: row[4],
                body: row[5],
                syncStatus: SyncStatus(rawValue: row[6]) ?? .pending,
                createdAt: dateFromIso(row[7]),
                updatedAt: dateFromIso(row[8]),
                lastError: row[9].isEmpty ? nil : row[9]
            )
        }
    }

    private func fetchLogs() -> [SyncLogItem] {
        query("select log_id, direction, entity_type, status, message, created_at from sync_log order by created_at desc limit 80") { row in
            SyncLogItem(id: row[0], direction: row[1], entityType: row[2], status: row[3], message: row[4], createdAt: dateFromIso(row[5]))
        }
    }

    private func fetchConflicts() -> [SyncConflict] {
        query("select conflict_id, entity_type, local_id, remote_id, message, created_at from sync_conflicts order by created_at desc") { row in
            SyncConflict(id: row[0], entityType: row[1], localId: row[2], remoteId: row[3].isEmpty ? nil : row[3], message: row[4], createdAt: dateFromIso(row[5]))
        }
    }

    private func execute(_ sql: String, _ params: [String] = []) {
        guard let db else { return }
        var statement: OpaquePointer?
        defer { sqlite3_finalize(statement) }
        sqlite3_prepare_v2(db, sql, -1, &statement, nil)
        for (index, value) in params.enumerated() {
            sqlite3_bind_text(statement, Int32(index + 1), value, -1, SQLITE_TRANSIENT)
        }
        sqlite3_step(statement)
    }

    private func query<T>(_ sql: String, map: ([String]) -> T) -> [T] {
        guard let db else { return [] }
        var statement: OpaquePointer?
        defer { sqlite3_finalize(statement) }
        sqlite3_prepare_v2(db, sql, -1, &statement, nil)
        var rows: [T] = []
        while sqlite3_step(statement) == SQLITE_ROW {
            let count = sqlite3_column_count(statement)
            let values = (0..<count).map { index -> String in
                guard let value = sqlite3_column_text(statement, index) else { return "" }
                return String(cString: value)
            }
            rows.append(map(values))
        }
        return rows
    }
}

private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
