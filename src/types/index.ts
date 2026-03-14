// ─── Local DB models ──────────────────────────────────────────────────────────

export type NoteState =
  | "imported"       // on device, not yet processed
  | "transcribing"   // Whisper in progress
  | "transcribed"    // transcript ready, no summary yet
  | "summarizing"    // LLM summary in progress
  | "done"           // transcript + summary complete
  | "error";

export interface Note {
  id: string;
  filename: string;
  filePath: string;
  signature: string;         // MD5 of the .hda file
  title: string | null;
  durationMs: number | null;
  createdAt: number;         // unix ms
  recordedAt: number | null;
  language: string | null;
  state: NoteState;
  hinotesId: string | null;  // set if uploaded to HiNotes
  folderId: string | null;
  tags: string[];
  sentimentPositive: number | null;
  sentimentNeutral: number | null;
  sentimentNegative: number | null;
}

export interface Sentiment {
  positive: number;
  neutral: number;
  negative: number;
}

export interface Speaker {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface ActionItem {
  id: string;
  noteId: string;
  text: string;
  assignee: string | null;
  done: boolean;
  createdAt: number;
}

export interface KeyDecision {
  id: string;
  noteId: string;
  text: string;
  createdAt: number;
}

export interface TranscriptionSegment {
  id: string;
  noteId: string;
  beginMs: number;
  endMs: number;
  sentence: string;
  speaker: string | null;
  model: string | null;
  createdAt: number;
}

export interface Summary {
  id: string;
  noteId: string;
  content: string;           // markdown
  model: string;
  prompt: string | null;
  createdAt: number;
}

// ─── Device models ────────────────────────────────────────────────────────────

export interface DeviceFile {
  name: string;              // e.g. "20260309-141851-Rec25.hda"
  size: number;
  signature: string | null;  // MD5, computed after read
  durationMs: number | null;
  recordedAt: string | null;
  alreadyImported: boolean;
}

// ─── HiNotes API models ───────────────────────────────────────────────────────

export interface HiNotesNote {
  id: string;
  state: string;
  title: string;
  language: string | null;
  createTime: number;
  type: string | null;
  markdown: string | null;
  html: string | null;
  conciseSummary: string | null;
  duration: number;
  tags: string;
  folderId: string | null;
  task: string | null;
  sessionId: string;
  hasAudio: boolean | null;
  error: string | null;
  level: string | null;
}

export interface HiNotesTranscriptionSegment {
  id: string | null;
  beginTime: number;
  endTime: number;
  duration: number;
  sentence: string;
  highlighted: boolean;
  speaker: string | null;
  voiceMark: boolean;
}

export interface HiNotesFileInfo {
  signature: string;
  title: string;
  noteId: string;
  state: string;
  language: string;
  template: string;
  task: string;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export type LLMProvider = "openai" | "anthropic";
export type TranscriptionModel = "whisper-1" | "whisper-large-v3";
export type SummaryModel = "gpt-4o" | "gpt-4o-mini" | "claude-opus-4" | "claude-sonnet-4-5";

export interface AppSettings {
  // API keys
  openaiApiKey: string;
  anthropicApiKey: string;

  // Model selection
  defaultSummaryProvider: LLMProvider;
  defaultSummaryModel: SummaryModel;
  transcriptionModel: TranscriptionModel;

  // Processing
  autoTranscribeOnImport: boolean;
  autoSummarizeAfterTranscript: boolean;
  defaultLanguage: string;
  speakerDetection: boolean;

  // System prompt for summaries
  summarySystemPrompt: string;

  // Device
  autoTransferOnConnect: boolean;

  // Notifications
  desktopNotifications: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  openaiApiKey: "",
  anthropicApiKey: "",
  defaultSummaryProvider: "anthropic",
  defaultSummaryModel: "claude-sonnet-4-5",
  transcriptionModel: "whisper-1",
  autoTranscribeOnImport: false,
  autoSummarizeAfterTranscript: false,
  defaultLanguage: "en",
  speakerDetection: true,
  summarySystemPrompt:
    "You are a meeting notes assistant. Summarize the following transcript into clear, structured markdown with: a brief overview, key decisions, action items, and important discussion points.",
  autoTransferOnConnect: false,
  desktopNotifications: true,
};
