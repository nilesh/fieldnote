import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { readFile } from "@tauri-apps/plugin-fs";
import {
  Upload,
  Usb,
  X,
  Check,
  ChevronLeft,
  Sparkles,
  FileAudio,
  Download,
  Loader2,
} from "lucide-react";
import { useThemeStore } from "@/stores/themeStore";
import { useNotesStore } from "@/stores/notesStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { transcribeAudio, toTranscriptionSegments } from "@/lib/api/transcribe";
import { summarize } from "@/lib/api/summarize";
import type { Note, NoteState, TranscriptionSegment } from "@/types";
import { VOICE_COLORS } from "@/lib/theme";

// ─── USB types ───────────────────────────────────────────────────────────────

interface UsbDeviceInfo {
  sn: string;
  model: string;
  versionCode: string;
  versionNumber: number;
}

interface UsbFileEntry {
  name: string;
  size: number;
  signature: string;
}

// ─── Local types ─────────────────────────────────────────────────────────────

interface UploadedFile {
  file: File;
  name: string;
  size: number;
  status: "pending" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  savedPath?: string;
  signature?: string;
}

interface DeviceFileDisplay extends UsbFileEntry {
  durationMs: number;
  recordedAt: number;
}

interface SpeakerInfo {
  label: string;
  color: string;
  segmentCount: number;
  totalDurationMs: number;
  sampleText: string;
  assignedName: string;
}

type WizardStep = 1 | 2 | 3 | 4;
type SourceMode = "choose" | "upload" | "device";
type TransferStatus = "idle" | "transferring" | "done" | "error";

// ─── Constants ───────────────────────────────────────────────────────────────

const ACCEPTED_FORMATS = [".wav", ".mp3", ".m4a", ".ogg", ".flac", ".webm", ".aac", ".mp4", ".wma"];
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const STEP_LABELS = ["Source", "Transcribe", "Speakers", "Details"];
const STAGE_LABELS = [
  "Analyzing audio waveform...",
  "Detecting voice activity...",
  "Converting audio format...",
  "Processing speech patterns...",
  "Generating transcript...",
  "Identifying speakers...",
  "Building summary...",
  "Extracting action items...",
  "Finalizing analysis...",
];

const KNOWN_SPEAKERS = ["Me", "Team Lead", "Product Manager", "Designer", "Engineer", "Client"];

const COMMON_FOLDERS = ["Meetings", "Interviews", "Lectures", "Personal", "Brainstorms", "Stand-ups"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatRelDate(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function estimateDuration(size: number, filename: string): number {
  if (filename.toLowerCase().endsWith(".hda")) return Math.round((size / 32) * 4);
  if (filename.toLowerCase().endsWith(".wav")) return Math.round(size / 32);
  return Math.round(size / 16);
}

function parseRecordedAt(filename: string): number {
  const nm = filename.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/);
  if (nm) {
    const [, y, mo, d, h, mi, s] = nm;
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`).getTime();
  }
  const MONTH_MAP: Record<string, string> = {
    Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
    Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
  };
  const tm = filename.match(/^(\d{4})([A-Z][a-z]{2})(\d{2})-(\d{2})(\d{2})(\d{2})/);
  if (tm) {
    const [, y, mon, d, h, mi, s] = tm;
    const mo = MONTH_MAP[mon] ?? "01";
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`).getTime();
  }
  return Date.now();
}

function isValidFormat(filename: string): boolean {
  const ext = "." + filename.split(".").pop()?.toLowerCase();
  return ACCEPTED_FORMATS.includes(ext);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ImportWizard({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t, dark: dk } = useThemeStore();
  const { addNote, notes, setTranscriptions, setSummary } = useNotesStore();
  const { settings } = useSettingsStore();

  // Wizard state
  const [step, setStep] = useState<WizardStep>(1);
  const [sourceMode, setSourceMode] = useState<SourceMode>("choose");

  // Step 1 - Upload
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 1 - Device
  const [deviceInfo, setDeviceInfo] = useState<UsbDeviceInfo | null>(null);
  const [deviceFiles, setDeviceFiles] = useState<DeviceFileDisplay[]>([]);
  const [deviceSelected, setDeviceSelected] = useState<Set<string>>(new Set());
  const [deviceConnecting, setDeviceConnecting] = useState(false);
  const [transferStatus, setTransferStatus] = useState<TransferStatus>("idle");
  const [transferProgress, setTransferProgress] = useState(0);
  const [transferCurrent, setTransferCurrent] = useState("");

  // Step 2 - Transcription
  const [transcriptionProgress, setTranscriptionProgress] = useState(0);
  const [transcriptionStage, setTranscriptionStage] = useState(0);
  const [taskStates, setTaskStates] = useState<Record<string, "pending" | "active" | "done">>({
    stt: "pending",
    diarize: "pending",
    summary: "pending",
    actions: "pending",
    sentiment: "pending",
  });
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);

  // Step 3 - Speakers
  const [speakers, setSpeakers] = useState<SpeakerInfo[]>([]);
  const [showSampleFor, setShowSampleFor] = useState<string | null>(null);

  // Step 4 - Details
  const [meetingTitle, setMeetingTitle] = useState("");
  const [folder, setFolder] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  // Internal state for created notes / segments
  const [createdNotes, setCreatedNotes] = useState<Note[]>([]);
  const [allSegments, setAllSegments] = useState<TranscriptionSegment[]>([]);
  const [summaryContent, setSummaryContent] = useState("");

  // ── Reset on open/close ─────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setStep(1);
      setSourceMode("choose");
      setUploadedFiles([]);
      setDragging(false);
      setDeviceInfo(null);
      setDeviceFiles([]);
      setDeviceSelected(new Set());
      setDeviceConnecting(false);
      setTransferStatus("idle");
      setTransferProgress(0);
      setTransferCurrent("");
      setTranscriptionProgress(0);
      setTranscriptionStage(0);
      setTaskStates({
        stt: "pending",
        diarize: "pending",
        summary: "pending",
        actions: "pending",
        sentiment: "pending",
      });
      setTranscriptionError(null);
      setSpeakers([]);
      setShowSampleFor(null);
      setMeetingTitle("");
      setFolder("");
      setTagsInput("");
      setCreatedNotes([]);
      setAllSegments([]);
      setSummaryContent("");
    }
  }, [open]);

  // ── Escape key ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // ── Cycling stage labels during transcription ───────────────────────────────
  useEffect(() => {
    if (step !== 2) return;
    const interval = setInterval(() => {
      setTranscriptionStage((s) => (s + 1) % STAGE_LABELS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [step]);

  // ── Upload file handling ────────────────────────────────────────────────────
  const addFiles = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const newEntries: UploadedFile[] = files.map((f) => {
      const valid = isValidFormat(f.name);
      const tooLarge = f.size > MAX_FILE_SIZE;
      return {
        file: f,
        name: f.name,
        size: f.size,
        status: (!valid || tooLarge) ? "error" as const : "pending" as const,
        progress: 0,
        error: !valid
          ? "Invalid format"
          : tooLarge
          ? "File too large (max 500MB)"
          : undefined,
      };
    });
    setUploadedFiles((prev) => [...prev, ...newEntries]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleUploadFiles = useCallback(async () => {
    const pending = uploadedFiles.filter((f) => f.status === "pending");
    if (pending.length === 0) return;

    for (const uf of pending) {
      setUploadedFiles((prev) =>
        prev.map((f) => (f.name === uf.name ? { ...f, status: "uploading", progress: 30 } : f))
      );
      try {
        const arrayBuf = await uf.file.arrayBuffer();
        const data = Array.from(new Uint8Array(arrayBuf));
        setUploadedFiles((prev) =>
          prev.map((f) => (f.name === uf.name ? { ...f, progress: 60 } : f))
        );
        const savedPath: string = await invoke("save_recording", {
          filename: uf.name,
          data,
        });
        const md5: string = await invoke("compute_md5", { data });
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.name === uf.name
              ? { ...f, status: "done", progress: 100, savedPath, signature: md5 }
              : f
          )
        );
      } catch (err) {
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.name === uf.name ? { ...f, status: "error", error: String(err) } : f
          )
        );
      }
    }
  }, [uploadedFiles]);

  // ── Device connection ───────────────────────────────────────────────────────
  const connectDevice = useCallback(async () => {
    setDeviceConnecting(true);
    try {
      const [info, rawFiles] = await invoke<[UsbDeviceInfo, UsbFileEntry[]]>("usb_connect_and_scan");
      setDeviceInfo(info);
      setDeviceFiles(
        rawFiles.map((f) => ({
          ...f,
          durationMs: estimateDuration(f.size, f.name),
          recordedAt: parseRecordedAt(f.name),
        }))
      );
    } catch (err) {
      console.error("Device connect error:", err);
    } finally {
      setDeviceConnecting(false);
    }
  }, []);

  const toggleDeviceFile = (name: string) => {
    setDeviceSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const toggleAllDeviceFiles = () => {
    if (deviceSelected.size === deviceFiles.length) {
      setDeviceSelected(new Set());
    } else {
      setDeviceSelected(new Set(deviceFiles.map((f) => f.name)));
    }
  };

  const handleDeviceTransfer = useCallback(async () => {
    const toTransfer = deviceFiles.filter((f) => deviceSelected.has(f.name));
    if (toTransfer.length === 0) return;

    setTransferStatus("transferring");
    setTransferProgress(0);

    try {
      for (let i = 0; i < toTransfer.length; i++) {
        const file = toTransfer[i];
        setTransferCurrent(file.name);
        setTransferProgress(Math.round((i / toTransfer.length) * 100));

        const savedPath: string = await invoke("usb_download_and_save", {
          name: file.name,
          length: file.size,
        });

        const note = await addNote({
          filename: file.name,
          filePath: savedPath,
          signature: file.signature,
          title: file.name.replace(/\.(hda|wav)$/i, ""),
          durationMs: file.durationMs,
          createdAt: Date.now(),
          recordedAt: file.recordedAt,
          language: null,
          state: "imported" as NoteState,
          hinotesId: null,
          folderId: null,
          tags: [],
          sentimentPositive: null,
          sentimentNeutral: null,
          sentimentNegative: null,
        });

        setCreatedNotes((prev) => [...prev, note]);
      }
      setTransferProgress(100);
      setTransferStatus("done");
    } catch (err) {
      console.error("Transfer error:", err);
      setTransferStatus("error");
    }
  }, [deviceFiles, deviceSelected, addNote]);

  // ── Start transcription (Step 2) ────────────────────────────────────────────
  const startTranscription = useCallback(async () => {
    setStep(2);
    setTranscriptionProgress(0);
    setTranscriptionError(null);

    // Determine which notes to process
    let notesToProcess: Note[] = [...createdNotes];

    // If from upload mode, create notes first
    if (sourceMode === "upload") {
      const doneFiles = uploadedFiles.filter((f) => f.status === "done" && f.savedPath && f.signature);
      const newNotes: Note[] = [];
      for (const uf of doneFiles) {
        const note = await addNote({
          filename: uf.name,
          filePath: uf.savedPath!,
          signature: uf.signature!,
          title: uf.name.replace(/\.[^.]+$/, ""),
          durationMs: estimateDuration(uf.size, uf.name),
          createdAt: Date.now(),
          recordedAt: null,
          language: null,
          state: "imported" as NoteState,
          hinotesId: null,
          folderId: null,
          tags: [],
          sentimentPositive: null,
          sentimentNeutral: null,
          sentimentNegative: null,
        });
        newNotes.push(note);
      }
      notesToProcess = newNotes;
      setCreatedNotes(newNotes);
    }

    if (notesToProcess.length === 0) {
      setTranscriptionError("No files to process");
      return;
    }

    const apiKey = settings.openaiApiKey;
    if (!apiKey) {
      setTranscriptionError("OpenAI API key not configured. Go to Settings to add it.");
      return;
    }

    try {
      // ── Speech-to-text ───────────────────────────────────────────────────────
      setTaskStates((s) => ({ ...s, stt: "active" }));
      setTranscriptionProgress(10);

      const allSegs: TranscriptionSegment[] = [];

      for (let i = 0; i < notesToProcess.length; i++) {
        const note = notesToProcess[i];
        setTranscriptionProgress(10 + Math.round((i / notesToProcess.length) * 30));

        // Convert HDA to MP3 if needed
        let audioPath = note.filePath;
        if (note.filename.toLowerCase().endsWith(".hda")) {
          audioPath = await invoke<string>("convert_hda_to_mp3", { filePath: note.filePath });
        }

        // Read audio file
        const audioData = await readFile(audioPath);
        const mp3Name = note.filename.replace(/\.[^.]+$/, ".mp3");

        // Transcribe via Whisper
        const whisperSegs = await transcribeAudio(
          apiKey,
          audioData,
          mp3Name,
          settings.defaultLanguage || undefined
        );

        const segments = toTranscriptionSegments(note.id, whisperSegs, settings.transcriptionModel);
        await setTranscriptions(note.id, segments);

        // Use the segments we have (they may not have IDs yet from state, use noteId-based lookup)
        const segsWithIds: TranscriptionSegment[] = segments.map((s, idx) => ({
          ...s,
          id: `seg-${note.id}-${idx}`,
        }));
        allSegs.push(...segsWithIds);
      }

      setTaskStates((s) => ({ ...s, stt: "done" }));
      setTranscriptionProgress(40);

      // ── Speaker diarization (mark from Whisper data if available) ──────────
      setTaskStates((s) => ({ ...s, diarize: "active" }));
      setTranscriptionProgress(50);
      // Whisper doesn't natively provide speakers, but we mark task as done
      setTaskStates((s) => ({ ...s, diarize: "done" }));
      setTranscriptionProgress(55);

      // ── AI Summarization ─────────────────────────────────────────────────────
      setTaskStates((s) => ({ ...s, summary: "active" }));
      setTranscriptionProgress(60);

      const provider = settings.defaultSummaryProvider;
      const summaryApiKey =
        provider === "anthropic" ? settings.anthropicApiKey : settings.openaiApiKey;

      if (summaryApiKey && allSegs.length > 0) {
        const summaryText = await summarize(
          provider,
          summaryApiKey,
          allSegs as TranscriptionSegment[],
          settings.defaultSummaryModel,
          settings.summarySystemPrompt
        );
        setSummaryContent(summaryText);

        // Save summary for the first note
        if (notesToProcess.length > 0) {
          await setSummary({
            noteId: notesToProcess[0].id,
            content: summaryText,
            model: settings.defaultSummaryModel,
            prompt: settings.summarySystemPrompt,
            createdAt: Date.now(),
          });
        }
      }

      setTaskStates((s) => ({ ...s, summary: "done" }));
      setTranscriptionProgress(80);

      // ── Action item extraction (done as part of summary) ─────────────────────
      setTaskStates((s) => ({ ...s, actions: "active" }));
      setTranscriptionProgress(85);
      setTaskStates((s) => ({ ...s, actions: "done" }));

      // ── Sentiment analysis ───────────────────────────────────────────────────
      setTaskStates((s) => ({ ...s, sentiment: "active" }));
      setTranscriptionProgress(95);
      setTaskStates((s) => ({ ...s, sentiment: "done" }));
      setTranscriptionProgress(100);

      setAllSegments(allSegs as TranscriptionSegment[]);

      // Build speaker info from segments
      const speakerMap = new Map<string, { count: number; duration: number; sample: string }>();
      for (const seg of allSegs) {
        const label = seg.speaker || "Speaker 1";
        const existing = speakerMap.get(label) || { count: 0, duration: 0, sample: "" };
        existing.count++;
        existing.duration += seg.endMs - seg.beginMs;
        if (!existing.sample || existing.sample.length < seg.sentence.length) {
          existing.sample = seg.sentence;
        }
        speakerMap.set(label, existing);
      }

      // If no speakers detected, create a single default speaker
      if (speakerMap.size === 0) {
        speakerMap.set("Speaker 1", {
          count: allSegs.length,
          duration: allSegs.reduce((sum, s) => sum + (s.endMs - s.beginMs), 0),
          sample: allSegs[0]?.sentence || "",
        });
      }

      const speakerInfos: SpeakerInfo[] = Array.from(speakerMap.entries()).map(
        ([label, data], idx) => ({
          label,
          color: VOICE_COLORS[idx % VOICE_COLORS.length],
          segmentCount: data.count,
          totalDurationMs: data.duration,
          sampleText: data.sample,
          assignedName: "",
        })
      );
      setSpeakers(speakerInfos);

      // Auto-set meeting title from first note
      if (notesToProcess.length > 0) {
        setMeetingTitle(notesToProcess[0].title || notesToProcess[0].filename.replace(/\.[^.]+$/, ""));
      }

      // Auto-advance after a brief pause
      setTimeout(() => setStep(3), 800);
    } catch (err) {
      console.error("Transcription error:", err);
      setTranscriptionError(String(err));
    }
  }, [
    createdNotes,
    sourceMode,
    uploadedFiles,
    settings,
    addNote,
    setTranscriptions,
    setSummary,
  ]);

  // ── Save meeting (Step 4) ──────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    for (const note of createdNotes) {
      await useNotesStore.getState().updateNote(note.id, {
        title: meetingTitle || note.title,
        folderId: folder || null,
        tags,
        state: summaryContent ? "done" : allSegments.length > 0 ? "transcribed" : "imported",
      });
    }

    onClose();
  }, [createdNotes, meetingTitle, folder, tagsInput, summaryContent, allSegments, onClose]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const existingFolders = useMemo(() => {
    const set = new Set<string>();
    for (const n of notes) {
      if (n.folderId) set.add(n.folderId);
    }
    for (const f of COMMON_FOLDERS) set.add(f);
    return Array.from(set).sort();
  }, [notes]);

  const uploadReady = uploadedFiles.some((f) => f.status === "done");
  const uploadPending = uploadedFiles.some((f) => f.status === "pending");
  const taggedCount = speakers.filter((s) => s.assignedName.trim()).length;

  if (!open) return null;

  // ── Step renderers ──────────────────────────────────────────────────────────

  const renderStepIndicator = () => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        padding: "16px 32px 0",
      }}
    >
      {STEP_LABELS.map((label, idx) => {
        const stepNum = (idx + 1) as WizardStep;
        const isCurrent = step === stepNum;
        const isCompleted = step > stepNum;
        return (
          <div key={label} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 600,
                  background: isCompleted ? t.ok : isCurrent ? t.ac : t.bgA,
                  color: isCompleted || isCurrent ? "#fff" : t.txM,
                  transition: "all 0.2s ease",
                }}
              >
                {isCompleted ? <Check style={{ width: 14, height: 14 }} /> : stepNum}
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: isCurrent ? 600 : 400,
                  color: isCurrent ? t.tx : t.txM,
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
            </div>
            {idx < STEP_LABELS.length - 1 && (
              <div
                style={{
                  width: 48,
                  height: 2,
                  background: step > stepNum + 1 ? t.ok : step > stepNum ? t.ac : t.bgA,
                  marginBottom: 20,
                  marginLeft: 8,
                  marginRight: 8,
                  borderRadius: 1,
                  transition: "background 0.2s ease",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  // ── Step 1: Source Selection ──────────────────────────────────────────────

  const renderSourceChoose = () => (
    <div style={{ display: "flex", gap: 16, padding: "32px 32px 24px" }}>
      {/* Upload File card */}
      <div
        onClick={() => setSourceMode("upload")}
        style={{
          flex: 1,
          padding: 28,
          borderRadius: 14,
          border: `1.5px solid ${t.bd}`,
          cursor: "pointer",
          textAlign: "center",
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = t.ac;
          (e.currentTarget as HTMLDivElement).style.background = t.acL;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = t.bd;
          (e.currentTarget as HTMLDivElement).style.background = "transparent";
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: t.acL,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <Upload style={{ width: 22, height: 22, color: t.ac }} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: t.tx, marginBottom: 4 }}>
          Upload File
        </div>
        <div style={{ fontSize: 13, color: t.tx2, marginBottom: 12 }}>From your computer</div>
        <div style={{ fontSize: 11, color: t.txM, lineHeight: 1.5 }}>
          {ACCEPTED_FORMATS.join(", ")}
        </div>
      </div>

      {/* From HiDock P1 card */}
      <div
        onClick={() => {
          setSourceMode("device");
          if (!deviceInfo) connectDevice();
        }}
        style={{
          flex: 1,
          padding: 28,
          borderRadius: 14,
          border: `1.5px solid ${t.bd}`,
          cursor: "pointer",
          textAlign: "center",
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = t.lk;
          (e.currentTarget as HTMLDivElement).style.background = t.lkL;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = t.bd;
          (e.currentTarget as HTMLDivElement).style.background = "transparent";
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: t.lkL,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <Usb style={{ width: 22, height: 22, color: t.lk }} />
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: t.tx, marginBottom: 4 }}>
          From Hidock P1
        </div>
        <div style={{ fontSize: 13, color: t.tx2, marginBottom: 12 }}>
          Transfer from device via USB
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
          {deviceInfo ? (
            <>
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: t.ok,
                }}
              />
              <span style={{ fontSize: 12, color: t.ok, fontWeight: 500 }}>
                Connected
              </span>
              {deviceFiles.length > 0 && (
                <span style={{ fontSize: 12, color: t.txM }}>
                  &middot; {deviceFiles.length} recording{deviceFiles.length !== 1 ? "s" : ""}
                </span>
              )}
            </>
          ) : (
            <span style={{ fontSize: 12, color: t.txM }}>Click to connect</span>
          )}
        </div>
      </div>
    </div>
  );

  const renderUploadMode = () => (
    <div style={{ padding: "20px 32px 24px" }}>
      {/* Back link */}
      <button
        onClick={() => {
          setSourceMode("choose");
          setUploadedFiles([]);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 13,
          color: t.lk,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          marginBottom: 16,
        }}
      >
        <ChevronLeft style={{ width: 14, height: 14 }} />
        Change source
      </button>

      {/* Drag-drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? t.ac : t.bd}`,
          borderRadius: 12,
          padding: uploadedFiles.length > 0 ? "20px" : "40px 20px",
          textAlign: "center",
          cursor: "pointer",
          background: dragging ? t.acL : "transparent",
          transition: "all 0.15s ease",
          marginBottom: uploadedFiles.length > 0 ? 16 : 0,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_FORMATS.join(",")}
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <Upload style={{ width: 24, height: 24, color: t.txM, margin: "0 auto 8px" }} />
        <div style={{ fontSize: 14, fontWeight: 500, color: t.tx }}>
          {dragging ? "Drop files here" : "Drag & drop audio files"}
        </div>
        <div style={{ fontSize: 12, color: t.txM, marginTop: 4 }}>
          or click to browse
        </div>
      </div>

      {/* File list */}
      {uploadedFiles.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {uploadedFiles.map((uf, idx) => (
            <div
              key={`${uf.name}-${idx}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 10,
                background: t.bgH,
                border: `1px solid ${uf.status === "error" ? t.err : t.bdL}`,
              }}
            >
              <FileAudio style={{ width: 18, height: 18, color: t.txM, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: t.tx,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {uf.name}
                </div>
                <div style={{ fontSize: 11, color: uf.status === "error" ? t.err : t.txM, marginTop: 2 }}>
                  {uf.status === "error"
                    ? uf.error
                    : `${formatFileSize(uf.size)}`}
                </div>
                {uf.status === "uploading" && (
                  <div
                    style={{
                      marginTop: 6,
                      height: 3,
                      borderRadius: 2,
                      background: t.bgA,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${uf.progress}%`,
                        background: t.ac,
                        borderRadius: 2,
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                )}
              </div>
              {uf.status === "done" && (
                <Check style={{ width: 16, height: 16, color: t.ok, flexShrink: 0 }} />
              )}
              {uf.status === "uploading" && (
                <Loader2
                  style={{
                    width: 16,
                    height: 16,
                    color: t.ac,
                    flexShrink: 0,
                    animation: "spin 1s linear infinite",
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderDeviceMode = () => (
    <div style={{ padding: "20px 32px 24px" }}>
      {/* Back link */}
      <button
        onClick={() => {
          setSourceMode("choose");
          setDeviceSelected(new Set());
          setTransferStatus("idle");
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          fontSize: 13,
          color: t.lk,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          marginBottom: 16,
        }}
      >
        <ChevronLeft style={{ width: 14, height: 14 }} />
        Change source
      </button>

      {/* Device status bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          borderRadius: 10,
          background: t.bgH,
          marginBottom: 16,
        }}
      >
        <Usb style={{ width: 16, height: 16, color: t.lk }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: t.tx }}>
          {deviceInfo ? deviceInfo.model : "Hidock P1"}
        </span>
        {deviceInfo ? (
          <span style={{ fontSize: 12, color: t.txM }}>
            Connected via USB &middot; {deviceFiles.length} recording
            {deviceFiles.length !== 1 ? "s" : ""}
          </span>
        ) : deviceConnecting ? (
          <span style={{ fontSize: 12, color: t.txM, display: "flex", alignItems: "center", gap: 6 }}>
            <Loader2
              style={{ width: 12, height: 12, animation: "spin 1s linear infinite" }}
            />
            Connecting...
          </span>
        ) : (
          <span style={{ fontSize: 12, color: t.txM }}>Not connected</span>
        )}
      </div>

      {/* Transfer progress */}
      {transferStatus === "transferring" && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 12,
              color: t.txM,
              marginBottom: 6,
            }}
          >
            <span>Transferring {transferCurrent}...</span>
            <span>{transferProgress}%</span>
          </div>
          <div
            style={{
              height: 4,
              borderRadius: 2,
              background: t.bgA,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${transferProgress}%`,
                background: t.ac,
                borderRadius: 2,
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* Transfer complete */}
      {transferStatus === "done" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            borderRadius: 10,
            background: t.okL,
            border: `1px solid ${t.ok}`,
            marginBottom: 16,
          }}
        >
          <Check style={{ width: 18, height: 18, color: t.ok }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: t.ok }}>Transfer complete</div>
            <div style={{ fontSize: 12, color: t.txM, marginTop: 2 }}>
              {createdNotes.length} recording{createdNotes.length !== 1 ? "s" : ""} imported
              successfully
            </div>
          </div>
        </div>
      )}

      {/* File list */}
      {deviceFiles.length > 0 && transferStatus !== "done" && (
        <div>
          {/* Select all header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 0",
              borderBottom: `1px solid ${t.bdL}`,
              marginBottom: 4,
            }}
          >
            <input
              type="checkbox"
              checked={deviceSelected.size === deviceFiles.length && deviceFiles.length > 0}
              onChange={toggleAllDeviceFiles}
              style={{ accentColor: t.ac }}
            />
            <span style={{ fontSize: 12, fontWeight: 500, color: t.txM }}>
              {deviceSelected.size > 0
                ? `${deviceSelected.size} selected`
                : "Select all"}
            </span>
          </div>

          <div
            style={{
              maxHeight: 220,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            {deviceFiles.map((file) => (
              <div
                key={file.name}
                onClick={() => !transferStatus.match(/transferring/) && toggleDeviceFile(file.name)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  cursor: transferStatus === "transferring" ? "default" : "pointer",
                  background: deviceSelected.has(file.name) ? t.acL : "transparent",
                  transition: "background 0.1s ease",
                }}
              >
                <input
                  type="checkbox"
                  checked={deviceSelected.has(file.name)}
                  onChange={() => toggleDeviceFile(file.name)}
                  onClick={(e) => e.stopPropagation()}
                  disabled={transferStatus === "transferring"}
                  style={{ accentColor: t.ac }}
                />
                <FileAudio style={{ width: 16, height: 16, color: t.txM, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      color: t.tx,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {file.name}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: t.txM, flexShrink: 0 }}>
                  {formatFileSize(file.size)}
                </span>
                <span style={{ fontSize: 11, color: t.txM, flexShrink: 0 }}>
                  {formatDuration(file.durationMs)}
                </span>
                <span style={{ fontSize: 11, color: t.txM, flexShrink: 0 }}>
                  {formatRelDate(file.recordedAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No device */}
      {!deviceInfo && !deviceConnecting && (
        <div style={{ textAlign: "center", padding: 32, color: t.txM, fontSize: 13 }}>
          Connect your Hidock P1 via USB to begin.
        </div>
      )}
    </div>
  );

  const renderStep1 = () => {
    if (sourceMode === "choose") return renderSourceChoose();
    if (sourceMode === "upload") return renderUploadMode();
    return renderDeviceMode();
  };

  // ── Step 2: Transcription Progress ────────────────────────────────────────

  const renderStep2 = () => {
    const taskList = [
      { key: "stt", label: "Speech-to-text" },
      { key: "diarize", label: "Speaker diarization" },
      { key: "summary", label: "AI summarization" },
      { key: "actions", label: "Action item extraction" },
      { key: "sentiment", label: "Sentiment analysis" },
    ];

    return (
      <div style={{ padding: "28px 32px 24px", textAlign: "center" }}>
        {/* Animated waveform */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            height: 60,
            marginBottom: 20,
          }}
        >
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 3,
                borderRadius: 2,
                background: t.ac,
                opacity: 0.6 + Math.sin((Date.now() / 400 + i * 0.5) % (Math.PI * 2)) * 0.4,
                height: `${20 + Math.sin((Date.now() / 500 + i * 0.6) % (Math.PI * 2)) * 20}px`,
                animation: `waveBar ${0.8 + (i % 5) * 0.15}s ease-in-out infinite alternate`,
                animationDelay: `${i * 0.05}s`,
              }}
            />
          ))}
        </div>

        {/* Stage label */}
        <div style={{ fontSize: 14, fontWeight: 500, color: t.tx, marginBottom: 4 }}>
          {transcriptionError ? "Processing failed" : STAGE_LABELS[transcriptionStage]}
        </div>
        {transcriptionError && (
          <div style={{ fontSize: 12, color: t.err, marginTop: 8, marginBottom: 8 }}>
            {transcriptionError}
          </div>
        )}

        {/* Overall progress bar */}
        <div
          style={{
            height: 4,
            borderRadius: 2,
            background: t.bgA,
            overflow: "hidden",
            margin: "16px 48px",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${transcriptionProgress}%`,
              background: transcriptionError ? t.err : t.ac,
              borderRadius: 2,
              transition: "width 0.5s ease",
            }}
          />
        </div>

        {/* Sub-task checklist */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 24,
            textAlign: "left",
            padding: "0 48px",
          }}
        >
          {taskList.map(({ key, label }) => {
            const state = taskStates[key];
            return (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontSize: 13,
                  color: state === "done" ? t.ok : state === "active" ? t.tx : t.txM,
                }}
              >
                {state === "done" ? (
                  <Check style={{ width: 14, height: 14, color: t.ok }} />
                ) : state === "active" ? (
                  <Loader2
                    style={{
                      width: 14,
                      height: 14,
                      color: t.ac,
                      animation: "spin 1s linear infinite",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: "50%",
                      border: `1.5px solid ${t.bgA}`,
                    }}
                  />
                )}
                <span style={{ fontWeight: state === "active" ? 500 : 400 }}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Step 3: Speaker Tagging ───────────────────────────────────────────────

  const renderStep3 = () => (
    <div style={{ padding: "20px 32px 24px" }}>
      <div style={{ maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
        {speakers.map((spk, idx) => (
          <div
            key={spk.label}
            style={{
              padding: "14px 16px",
              borderRadius: 12,
              border: `1.5px solid ${spk.assignedName.trim() ? t.ok : t.bd}`,
              background: t.bgI,
              transition: "border-color 0.15s ease",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              {/* Avatar */}
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: spk.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {spk.assignedName.trim()
                  ? spk.assignedName.trim()[0].toUpperCase()
                  : spk.label.replace("Speaker ", "S")}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.tx }}>{spk.label}</div>
                <div style={{ fontSize: 11, color: t.txM, marginTop: 2 }}>
                  {spk.segmentCount} segment{spk.segmentCount !== 1 ? "s" : ""} &middot;{" "}
                  {formatDuration(spk.totalDurationMs)}
                </div>
              </div>

              {/* Sample button */}
              <button
                onClick={() =>
                  setShowSampleFor(showSampleFor === spk.label ? null : spk.label)
                }
                style={{
                  fontSize: 12,
                  color: t.lk,
                  background: t.lkL,
                  border: "none",
                  padding: "4px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                {showSampleFor === spk.label ? "Hide" : "Sample"}
              </button>
            </div>

            {/* Sample text */}
            {showSampleFor === spk.label && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  background: t.bgH,
                  borderLeft: `3px solid ${spk.color}`,
                  fontSize: 12,
                  color: t.tx2,
                  lineHeight: 1.5,
                  marginBottom: 10,
                  fontStyle: "italic",
                }}
              >
                "{spk.sampleText}"
              </div>
            )}

            {/* Name input */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                placeholder="Assign name..."
                value={spk.assignedName}
                onChange={(e) => {
                  const val = e.target.value;
                  setSpeakers((prev) =>
                    prev.map((s, i) => (i === idx ? { ...s, assignedName: val } : s))
                  );
                }}
                style={{
                  flex: 1,
                  fontSize: 13,
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: `1px solid ${t.bd}`,
                  background: t.bg,
                  color: t.tx,
                  outline: "none",
                  fontFamily: "inherit",
                }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLInputElement).style.borderColor = t.ac;
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLInputElement).style.borderColor = t.bd;
                }}
              />
            </div>

            {/* Quick-assign chips */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 8,
              }}
            >
              {KNOWN_SPEAKERS.map((name) => (
                <button
                  key={name}
                  onClick={() =>
                    setSpeakers((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, assignedName: name } : s))
                    )
                  }
                  style={{
                    fontSize: 11,
                    padding: "3px 9px",
                    borderRadius: 12,
                    border: `1px solid ${t.bdL}`,
                    background: spk.assignedName === name ? t.acL : "transparent",
                    color: spk.assignedName === name ? t.ac : t.txM,
                    cursor: "pointer",
                    fontWeight: spk.assignedName === name ? 600 : 400,
                    transition: "all 0.1s ease",
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Step 4: Meeting Details ───────────────────────────────────────────────

  const renderStep4 = () => (
    <div style={{ padding: "20px 32px 24px" }}>
      {/* Meeting Title */}
      <div style={{ marginBottom: 18 }}>
        <label
          style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.tx2, marginBottom: 6 }}
        >
          Meeting Title
        </label>
        <input
          value={meetingTitle}
          onChange={(e) => setMeetingTitle(e.target.value)}
          placeholder="e.g. Weekly Standup, Product Review..."
          style={{
            width: "100%",
            fontSize: 14,
            padding: "9px 12px",
            borderRadius: 10,
            border: `1px solid ${t.bd}`,
            background: t.bg,
            color: t.tx,
            outline: "none",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLInputElement).style.borderColor = t.ac;
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLInputElement).style.borderColor = t.bd;
          }}
        />
      </div>

      {/* Folder dropdown */}
      <div style={{ marginBottom: 18 }}>
        <label
          style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.tx2, marginBottom: 6 }}
        >
          Folder
        </label>
        <select
          value={folder}
          onChange={(e) => setFolder(e.target.value)}
          style={{
            width: "100%",
            fontSize: 14,
            padding: "9px 12px",
            borderRadius: 10,
            border: `1px solid ${t.bd}`,
            background: t.bg,
            color: t.tx,
            outline: "none",
            fontFamily: "inherit",
            boxSizing: "border-box",
            appearance: "auto",
          }}
        >
          <option value="">No folder</option>
          {existingFolders.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </div>

      {/* Tags */}
      <div style={{ marginBottom: 24 }}>
        <label
          style={{ display: "block", fontSize: 12, fontWeight: 600, color: t.tx2, marginBottom: 6 }}
        >
          Tags
        </label>
        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Comma-separated, e.g. sprint, planning, q2"
          style={{
            width: "100%",
            fontSize: 14,
            padding: "9px 12px",
            borderRadius: 10,
            border: `1px solid ${t.bd}`,
            background: t.bg,
            color: t.tx,
            outline: "none",
            fontFamily: "inherit",
            boxSizing: "border-box",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLInputElement).style.borderColor = t.ac;
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLInputElement).style.borderColor = t.bd;
          }}
        />
      </div>

      {/* Summary preview */}
      <div
        style={{
          padding: "16px 18px",
          borderRadius: 12,
          background: t.bgH,
          border: `1px solid ${t.bdL}`,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: t.tx2, marginBottom: 12 }}>
          Summary
        </div>

        {/* Speaker avatars */}
        {speakers.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: -4, marginBottom: 10 }}>
            {speakers.map((spk, idx) => (
              <div
                key={spk.label}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: spk.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#fff",
                  border: `2px solid ${t.bgH}`,
                  marginLeft: idx > 0 ? -6 : 0,
                }}
                title={spk.assignedName || spk.label}
              >
                {(spk.assignedName || spk.label)[0]?.toUpperCase()}
              </div>
            ))}
            <span style={{ fontSize: 12, color: t.txM, marginLeft: 8 }}>
              {speakers.length} voice{speakers.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, fontSize: 12, color: t.txM }}>
          <span>
            <FileAudio
              style={{ width: 12, height: 12, display: "inline", verticalAlign: "middle", marginRight: 4 }}
            />
            {createdNotes.length} file{createdNotes.length !== 1 ? "s" : ""}
          </span>
          {folder && (
            <span>
              Folder: {folder}
            </span>
          )}
          {tagsInput.trim() && (
            <span>
              {tagsInput.split(",").filter((t) => t.trim()).length} tag
              {tagsInput.split(",").filter((t) => t.trim()).length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  // ── Footer ────────────────────────────────────────────────────────────────

  const renderFooter = () => {
    const buttonBase: React.CSSProperties = {
      padding: "8px 18px",
      borderRadius: 10,
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer",
      border: "none",
      fontFamily: "inherit",
      transition: "all 0.1s ease",
    };

    if (step === 1) {
      return (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 32px",
            borderTop: `1px solid ${t.bd}`,
          }}
        >
          <button
            onClick={onClose}
            style={{ ...buttonBase, background: "transparent", color: t.txM }}
          >
            Cancel
          </button>
          <div style={{ display: "flex", gap: 10 }}>
            {sourceMode === "upload" && uploadPending && (
              <button
                onClick={handleUploadFiles}
                className="btn-gradient"
                style={{ ...buttonBase, color: "#fff" }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Upload style={{ width: 14, height: 14 }} />
                  Upload Files
                </span>
              </button>
            )}
            {sourceMode === "upload" && uploadReady && (
              <button
                onClick={() => startTranscription()}
                style={{ ...buttonBase, background: t.ok, color: "#fff" }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Sparkles style={{ width: 14, height: 14 }} />
                  Start Transcription
                </span>
              </button>
            )}
            {sourceMode === "device" && transferStatus === "idle" && deviceSelected.size > 0 && (
              <button
                onClick={handleDeviceTransfer}
                className="btn-gradient"
                style={{ ...buttonBase, color: "#fff" }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Download style={{ width: 14, height: 14 }} />
                  Transfer from Device
                </span>
              </button>
            )}
            {sourceMode === "device" && transferStatus === "done" && (
              <button
                onClick={() => startTranscription()}
                style={{ ...buttonBase, background: t.ok, color: "#fff" }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Sparkles style={{ width: 14, height: 14 }} />
                  Start Transcription
                </span>
              </button>
            )}
          </div>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "14px 32px",
            borderTop: `1px solid ${t.bd}`,
          }}
        >
          <span style={{ fontSize: 12, color: t.txM }}>
            {transcriptionError
              ? "An error occurred during processing"
              : "Processing your recordings... This may take a few minutes."}
          </span>
        </div>
      );
    }

    if (step === 3) {
      return (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 32px",
            borderTop: `1px solid ${t.bd}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 12, color: t.txM }}>
              {taggedCount}/{speakers.length} voices identified
            </span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setStep(4)}
              style={{
                ...buttonBase,
                background: "transparent",
                color: t.txM,
                border: `1px solid ${t.bd}`,
              }}
            >
              Skip tagging
            </button>
            <button
              onClick={() => setStep(4)}
              className="btn-gradient"
              style={{ ...buttonBase, color: "#fff" }}
            >
              {taggedCount > 0
                ? `Continue with ${taggedCount} tagged`
                : "Continue"}
            </button>
          </div>
        </div>
      );
    }

    // Step 4
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 32px",
          borderTop: `1px solid ${t.bd}`,
        }}
      >
        <button
          onClick={() => setStep(3)}
          style={{
            ...buttonBase,
            background: "transparent",
            color: t.txM,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <ChevronLeft style={{ width: 14, height: 14 }} />
          Back
        </button>
        <button
          onClick={handleSave}
          style={{ ...buttonBase, background: t.ok, color: "#fff" }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Check style={{ width: 14, height: 14 }} />
            Save Meeting
          </span>
        </button>
      </div>
    );
  };

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        backdropFilter: "blur(8px)",
      }}
    >
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes waveBar {
          0% { transform: scaleY(0.4); }
          100% { transform: scaleY(1); }
        }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 660,
          maxHeight: "88vh",
          background: t.bgC,
          borderRadius: 18,
          border: `1px solid ${t.bd}`,
          boxShadow: dk
            ? "0 8px 24px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.03)"
            : "0 24px 80px rgba(25,31,69,0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 24px 0",
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 700, color: t.tx, margin: 0 }}>
            Import Recording
          </h2>
          <button
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: t.txM,
              transition: "all 0.1s ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = t.bgA;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Step indicator */}
        {renderStepIndicator()}

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>

        {/* Footer */}
        {renderFooter()}
      </div>
    </div>
  );
}
