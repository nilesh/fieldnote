/**
 * Local SQLite database via tauri-plugin-sql.
 * All note, transcription, summary, speaker, action item and decision data.
 */

import Database from "@tauri-apps/plugin-sql";
import type { Note, TranscriptionSegment, Summary, Speaker, ActionItem, KeyDecision } from "@/types";

let _db: Awaited<ReturnType<typeof Database.load>> | null = null;

const DB_PATH = "sqlite:fieldnote.db";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  file_path TEXT NOT NULL,
  signature TEXT NOT NULL UNIQUE,
  title TEXT,
  duration_ms INTEGER,
  created_at INTEGER NOT NULL,
  recorded_at INTEGER,
  language TEXT,
  state TEXT NOT NULL DEFAULT 'imported',
  hinotes_id TEXT,
  folder_id TEXT,
  tags TEXT DEFAULT '[]',
  sentiment_positive INTEGER,
  sentiment_neutral INTEGER,
  sentiment_negative INTEGER
);

CREATE TABLE IF NOT EXISTS transcriptions (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  begin_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  sentence TEXT NOT NULL,
  speaker TEXT,
  model TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS summaries (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  content TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS speakers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS action_items (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  text TEXT NOT NULL,
  assignee TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS key_decisions (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transcriptions_note ON transcriptions(note_id, begin_ms);
CREATE INDEX IF NOT EXISTS idx_summaries_note ON summaries(note_id);
CREATE INDEX IF NOT EXISTS idx_action_items_note ON action_items(note_id);
CREATE INDEX IF NOT EXISTS idx_key_decisions_note ON key_decisions(note_id);
`;

// Migration: add columns that may not exist in older DBs
const MIGRATIONS = [
  "ALTER TABLE notes ADD COLUMN sentiment_positive INTEGER",
  "ALTER TABLE notes ADD COLUMN sentiment_neutral INTEGER",
  "ALTER TABLE notes ADD COLUMN sentiment_negative INTEGER",
];

export async function getDb() {
  if (!_db) {
    _db = await Database.load(DB_PATH);
    for (const stmt of SCHEMA.split(";").map((s) => s.trim()).filter(Boolean)) {
      await _db.execute(stmt + ";");
    }
    // Run migrations (ignore errors for already-existing columns)
    for (const m of MIGRATIONS) {
      try { await _db.execute(m); } catch { /* column already exists */ }
    }
  }
  return _db;
}

// ─── Notes ────────────────────────────────────────────────────────────────────

function rowToNote(row: Record<string, unknown>): Note {
  return {
    id: row.id as string,
    filename: row.filename as string,
    filePath: row.file_path as string,
    signature: row.signature as string,
    title: row.title as string | null,
    durationMs: row.duration_ms as number | null,
    createdAt: row.created_at as number,
    recordedAt: row.recorded_at as number | null,
    language: row.language as string | null,
    state: row.state as Note["state"],
    hinotesId: row.hinotes_id as string | null,
    folderId: row.folder_id as string | null,
    tags: JSON.parse((row.tags as string) || "[]"),
    sentimentPositive: row.sentiment_positive as number | null,
    sentimentNeutral: row.sentiment_neutral as number | null,
    sentimentNegative: row.sentiment_negative as number | null,
  };
}

export async function insertNote(note: Omit<Note, "id">): Promise<Note> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO notes (id, filename, file_path, signature, title, duration_ms,
      created_at, recorded_at, language, state, hinotes_id, folder_id, tags,
      sentiment_positive, sentiment_neutral, sentiment_negative)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, note.filename, note.filePath, note.signature, note.title,
      note.durationMs, note.createdAt, note.recordedAt, note.language,
      note.state, note.hinotesId, note.folderId, JSON.stringify(note.tags),
      note.sentimentPositive, note.sentimentNeutral, note.sentimentNegative,
    ]
  );
  return { ...note, id };
}

export async function updateNote(id: string, patch: Partial<Note>): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (patch.title !== undefined) { fields.push("title = ?"); values.push(patch.title); }
  if (patch.state !== undefined) { fields.push("state = ?"); values.push(patch.state); }
  if (patch.hinotesId !== undefined) { fields.push("hinotes_id = ?"); values.push(patch.hinotesId); }
  if (patch.durationMs !== undefined) { fields.push("duration_ms = ?"); values.push(patch.durationMs); }
  if (patch.language !== undefined) { fields.push("language = ?"); values.push(patch.language); }
  if (patch.tags !== undefined) { fields.push("tags = ?"); values.push(JSON.stringify(patch.tags)); }
  if (patch.folderId !== undefined) { fields.push("folder_id = ?"); values.push(patch.folderId); }
  if (patch.sentimentPositive !== undefined) { fields.push("sentiment_positive = ?"); values.push(patch.sentimentPositive); }
  if (patch.sentimentNeutral !== undefined) { fields.push("sentiment_neutral = ?"); values.push(patch.sentimentNeutral); }
  if (patch.sentimentNegative !== undefined) { fields.push("sentiment_negative = ?"); values.push(patch.sentimentNegative); }

  if (fields.length === 0) return;
  values.push(id);
  await db.execute(`UPDATE notes SET ${fields.join(", ")} WHERE id = ?`, values);
}

export async function getNotes(opts: {
  folderId?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<Note[]> {
  const db = await getDb();
  let query = "SELECT * FROM notes";
  const params: unknown[] = [];
  if (opts.folderId) {
    query += " WHERE folder_id = ?";
    params.push(opts.folderId);
  }
  query += " ORDER BY created_at DESC";
  if (opts.limit) { query += " LIMIT ?"; params.push(opts.limit); }
  if (opts.offset) { query += " OFFSET ?"; params.push(opts.offset); }

  const rows = await db.select<Record<string, unknown>[]>(query, params);
  return rows.map(rowToNote);
}

export async function getNoteById(id: string): Promise<Note | null> {
  const db = await getDb();
  const rows = await db.select<Record<string, unknown>[]>(
    "SELECT * FROM notes WHERE id = ?", [id]
  );
  return rows[0] ? rowToNote(rows[0]) : null;
}

export async function getNoteBySignature(signature: string): Promise<Note | null> {
  const db = await getDb();
  const rows = await db.select<Record<string, unknown>[]>(
    "SELECT * FROM notes WHERE signature = ?", [signature]
  );
  return rows[0] ? rowToNote(rows[0]) : null;
}

export async function deleteNote(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM notes WHERE id = ?", [id]);
}

// ─── Transcriptions ───────────────────────────────────────────────────────────

export async function insertTranscriptions(
  segments: Omit<TranscriptionSegment, "id">[]
): Promise<void> {
  const db = await getDb();
  for (const s of segments) {
    await db.execute(
      `INSERT INTO transcriptions (id, note_id, begin_ms, end_ms, sentence, speaker, model, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), s.noteId, s.beginMs, s.endMs, s.sentence, s.speaker, s.model, s.createdAt]
    );
  }
}

export async function getTranscriptions(noteId: string): Promise<TranscriptionSegment[]> {
  const db = await getDb();
  const rows = await db.select<Record<string, unknown>[]>(
    "SELECT * FROM transcriptions WHERE note_id = ? ORDER BY begin_ms ASC",
    [noteId]
  );
  return rows.map((r) => ({
    id: r.id as string,
    noteId: r.note_id as string,
    beginMs: r.begin_ms as number,
    endMs: r.end_ms as number,
    sentence: r.sentence as string,
    speaker: r.speaker as string | null,
    model: r.model as string | null,
    createdAt: r.created_at as number,
  }));
}

export async function deleteTranscriptions(noteId: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM transcriptions WHERE note_id = ?", [noteId]);
}

// ─── Summaries ────────────────────────────────────────────────────────────────

export async function insertSummary(
  summary: Omit<Summary, "id">
): Promise<Summary> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO summaries (id, note_id, content, model, prompt, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, summary.noteId, summary.content, summary.model, summary.prompt, summary.createdAt]
  );
  return { ...summary, id };
}

export async function getLatestSummary(noteId: string): Promise<Summary | null> {
  const db = await getDb();
  const rows = await db.select<Record<string, unknown>[]>(
    "SELECT * FROM summaries WHERE note_id = ? ORDER BY created_at DESC LIMIT 1",
    [noteId]
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return {
    id: r.id as string,
    noteId: r.note_id as string,
    content: r.content as string,
    model: r.model as string,
    prompt: r.prompt as string | null,
    createdAt: r.created_at as number,
  };
}

// ─── Speakers ─────────────────────────────────────────────────────────────────

export async function getSpeakers(): Promise<Speaker[]> {
  const db = await getDb();
  const rows = await db.select<Record<string, unknown>[]>(
    "SELECT * FROM speakers ORDER BY created_at ASC"
  );
  return rows.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    color: r.color as string,
    createdAt: r.created_at as number,
  }));
}

export async function insertSpeaker(speaker: Omit<Speaker, "id">): Promise<Speaker> {
  const db = await getDb();
  const id = crypto.randomUUID();
  await db.execute(
    "INSERT INTO speakers (id, name, color, created_at) VALUES (?, ?, ?, ?)",
    [id, speaker.name, speaker.color, speaker.createdAt]
  );
  return { ...speaker, id };
}

// ─── Action Items ─────────────────────────────────────────────────────────────

export async function getActionItems(noteId: string): Promise<ActionItem[]> {
  const db = await getDb();
  const rows = await db.select<Record<string, unknown>[]>(
    "SELECT * FROM action_items WHERE note_id = ? ORDER BY created_at ASC",
    [noteId]
  );
  return rows.map((r) => ({
    id: r.id as string,
    noteId: r.note_id as string,
    text: r.text as string,
    assignee: r.assignee as string | null,
    done: (r.done as number) === 1,
    createdAt: r.created_at as number,
  }));
}

export async function getAllActionItems(): Promise<ActionItem[]> {
  const db = await getDb();
  const rows = await db.select<Record<string, unknown>[]>(
    "SELECT * FROM action_items ORDER BY created_at DESC"
  );
  return rows.map((r) => ({
    id: r.id as string,
    noteId: r.note_id as string,
    text: r.text as string,
    assignee: r.assignee as string | null,
    done: (r.done as number) === 1,
    createdAt: r.created_at as number,
  }));
}

export async function insertActionItems(items: Omit<ActionItem, "id">[]): Promise<void> {
  const db = await getDb();
  for (const it of items) {
    await db.execute(
      "INSERT INTO action_items (id, note_id, text, assignee, done, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [crypto.randomUUID(), it.noteId, it.text, it.assignee, it.done ? 1 : 0, it.createdAt]
    );
  }
}

export async function toggleActionItem(id: string, done: boolean): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE action_items SET done = ? WHERE id = ?", [done ? 1 : 0, id]);
}

// ─── Key Decisions ────────────────────────────────────────────────────────────

export async function getKeyDecisions(noteId: string): Promise<KeyDecision[]> {
  const db = await getDb();
  const rows = await db.select<Record<string, unknown>[]>(
    "SELECT * FROM key_decisions WHERE note_id = ? ORDER BY created_at ASC",
    [noteId]
  );
  return rows.map((r) => ({
    id: r.id as string,
    noteId: r.note_id as string,
    text: r.text as string,
    createdAt: r.created_at as number,
  }));
}

export async function insertKeyDecisions(items: Omit<KeyDecision, "id">[]): Promise<void> {
  const db = await getDb();
  for (const d of items) {
    await db.execute(
      "INSERT INTO key_decisions (id, note_id, text, created_at) VALUES (?, ?, ?, ?)",
      [crypto.randomUUID(), d.noteId, d.text, d.createdAt]
    );
  }
}

// ─── Search ───────────────────────────────────────────────────────────────────

export async function searchNotes(query: string): Promise<Note[]> {
  const db = await getDb();
  const q = `%${query}%`;
  const rows = await db.select<Record<string, unknown>[]>(
    `SELECT DISTINCT n.* FROM notes n
     LEFT JOIN transcriptions t ON t.note_id = n.id
     LEFT JOIN summaries s ON s.note_id = n.id
     WHERE n.title LIKE ? OR n.filename LIKE ? OR n.tags LIKE ?
       OR t.sentence LIKE ? OR s.content LIKE ?
     ORDER BY n.created_at DESC LIMIT 20`,
    [q, q, q, q, q]
  );
  return rows.map(rowToNote);
}
