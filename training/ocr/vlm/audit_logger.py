"""
Audit Logger — HIPAA/Kuwait Compliance Trail
=============================================
Every OCR action is logged to a local SQLite database.
Records: User, Timestamp, Action, File Path, File Hash (SHA-256).

This meets the 2026 HIPAA Security Rule requirement for:
  - Access logging
  - Integrity verification (file hashes)
  - Non-repudiation (user attribution)

The database is local-only. No data leaves the machine.
"""

import sqlite3
from datetime import datetime, timezone
from pathlib import Path


class AuditLogger:
    """Thread-safe SQLite audit logger for medical OCR actions."""

    SCHEMA = """
    CREATE TABLE IF NOT EXISTS audit_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp   TEXT NOT NULL,
        user        TEXT NOT NULL,
        action      TEXT NOT NULL,
        file_path   TEXT,
        file_hash   TEXT,
        details     TEXT,
        created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_audit_file_hash ON audit_log(file_hash);
    """

    def __init__(self, db_path):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self):
        conn = sqlite3.connect(str(self.db_path))
        conn.execute("PRAGMA journal_mode=WAL")
        conn.executescript(self.SCHEMA)
        conn.close()

    def log_action(self, user, action, file_path="", file_hash="", details=""):
        """Log an OCR action to the audit trail."""
        timestamp = datetime.now(timezone.utc).isoformat()
        conn = sqlite3.connect(str(self.db_path))
        try:
            conn.execute(
                "INSERT INTO audit_log (timestamp, user, action, file_path, file_hash, details) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (timestamp, user, action, file_path, file_hash, details),
            )
            conn.commit()
        finally:
            conn.close()

    def query_by_user(self, user, limit=100):
        """Retrieve audit entries for a specific user."""
        conn = sqlite3.connect(str(self.db_path))
        try:
            cursor = conn.execute(
                "SELECT * FROM audit_log WHERE user = ? ORDER BY timestamp DESC LIMIT ?",
                (user, limit),
            )
            return cursor.fetchall()
        finally:
            conn.close()

    def query_by_file(self, file_hash, limit=100):
        """Retrieve audit entries for a specific file (by hash)."""
        conn = sqlite3.connect(str(self.db_path))
        try:
            cursor = conn.execute(
                "SELECT * FROM audit_log WHERE file_hash = ? ORDER BY timestamp DESC LIMIT ?",
                (file_hash, limit),
            )
            return cursor.fetchall()
        finally:
            conn.close()

    def query_recent(self, limit=50):
        """Retrieve most recent audit entries."""
        conn = sqlite3.connect(str(self.db_path))
        try:
            cursor = conn.execute(
                "SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT ?",
                (limit,),
            )
            return cursor.fetchall()
        finally:
            conn.close()

    def export_json(self, output_path):
        """Export full audit log as JSON for compliance review."""
        import json
        conn = sqlite3.connect(str(self.db_path))
        try:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("SELECT * FROM audit_log ORDER BY timestamp")
            rows = [dict(row) for row in cursor.fetchall()]
            Path(output_path).write_text(
                json.dumps(rows, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
            return len(rows)
        finally:
            conn.close()

    def count(self):
        """Total number of audit entries."""
        conn = sqlite3.connect(str(self.db_path))
        try:
            cursor = conn.execute("SELECT COUNT(*) FROM audit_log")
            return cursor.fetchone()[0]
        finally:
            conn.close()
