/// SQL schema for the local SQLite database.
/// Applied on first run via tauri-plugin-sql migrations.
pub const MIGRATIONS: &[&str] = &[
    r#"
    CREATE TABLE IF NOT EXISTS notes (
        id          TEXT PRIMARY KEY,
        filename    TEXT NOT NULL,
        file_path   TEXT NOT NULL,
        signature   TEXT NOT NULL UNIQUE,
        title       TEXT,
        duration_ms INTEGER,
        created_at  INTEGER NOT NULL,
        recorded_at INTEGER,
        language    TEXT,
        state       TEXT NOT NULL DEFAULT 'imported',
        hinotes_id  TEXT,
        folder_id   TEXT,
        tags        TEXT DEFAULT '[]'
    );
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS transcriptions (
        id          TEXT PRIMARY KEY,
        note_id     TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        begin_ms    INTEGER NOT NULL,
        end_ms      INTEGER NOT NULL,
        sentence    TEXT NOT NULL,
        speaker     TEXT,
        model       TEXT,
        created_at  INTEGER NOT NULL
    );
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS summaries (
        id          TEXT PRIMARY KEY,
        note_id     TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
        content     TEXT NOT NULL,
        model       TEXT NOT NULL,
        prompt      TEXT,
        created_at  INTEGER NOT NULL
    );
    "#,
    r#"
    CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_transcriptions_note ON transcriptions(note_id, begin_ms);
    CREATE INDEX IF NOT EXISTS idx_summaries_note ON summaries(note_id);
    "#,
];
