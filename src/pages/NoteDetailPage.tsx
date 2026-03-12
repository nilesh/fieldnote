import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Pause, Wand2, Loader2, AlertCircle } from "lucide-react";
import { useNotesStore } from "@/stores/notesStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn, formatDuration, formatDateTime } from "@/lib/utils";
import { transcribeAudio, toTranscriptionSegments } from "@/lib/api/transcribe";
import { summarize } from "@/lib/api/summarize";
import { readFile } from "@tauri-apps/plugin-fs";
import type { TranscriptionSegment } from "@/types";
import ReactMarkdown from "react-markdown";

export default function NoteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { notes, transcriptions, summaries, updateNote, loadTranscriptions, setTranscriptions, loadSummary, setSummary } =
    useNotesStore();
  const settings = useSettingsStore((s) => s.settings);

  const note = notes.find((n) => n.id === id);
  const segments = id ? (transcriptions[id] ?? []) : [];
  const summary = id ? (summaries[id] ?? null) : null;

  const [processing, setProcessing] = useState<"transcribing" | "summarizing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSegmentIdx, setActiveSegmentIdx] = useState<number>(-1);

  // Audio player
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    loadTranscriptions(id);
    loadSummary(id);
  }, [id]);

  // Load audio from local file
  useEffect(() => {
    if (!note?.filePath) return;
    // Create object URL from local file
    readFile(note.filePath)
      .then((data) => {
        const blob = new Blob([data], { type: "audio/mpeg" });
        setAudioUrl(URL.createObjectURL(blob));
      })
      .catch(() => setAudioUrl(null));
    return () => { if (audioUrl) URL.revokeObjectURL(audioUrl); };
  }, [note?.filePath]);

  // Sync audio position to active segment
  useEffect(() => {
    if (!audioRef.current) return;
    const handler = () => {
      const ms = audioRef.current!.currentTime * 1000;
      setCurrentMs(ms);
      const idx = segments.findLastIndex((s) => ms >= s.beginMs);
      setActiveSegmentIdx(idx);
    };
    audioRef.current.addEventListener("timeupdate", handler);
    return () => audioRef.current?.removeEventListener("timeupdate", handler);
  }, [segments]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  const seekToSegment = (seg: TranscriptionSegment) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = seg.beginMs / 1000;
    audioRef.current.play();
    setPlaying(true);
  };

  const runTranscription = async () => {
    if (!note || !id) return;
    if (!settings.openaiApiKey) { setError("OpenAI API key not set in Settings"); return; }
    setError(null);
    setProcessing("transcribing");
    await updateNote(id, { state: "transcribing" });
    try {
      const data = await readFile(note.filePath);
      const whisperSegments = await transcribeAudio(
        settings.openaiApiKey,
        data,
        note.filename,
        settings.defaultLanguage || undefined
      );
      const segs = toTranscriptionSegments(id, whisperSegments, settings.transcriptionModel);
      await setTranscriptions(id, segs);
      await updateNote(id, { state: "transcribed" });
    } catch (e) {
      setError(String(e));
      await updateNote(id, { state: "error" });
    } finally {
      setProcessing(null);
    }
  };

  const runSummary = async () => {
    if (!note || !id || segments.length === 0) return;
    const apiKey =
      settings.defaultSummaryProvider === "anthropic"
        ? settings.anthropicApiKey
        : settings.openaiApiKey;
    if (!apiKey) { setError(`${settings.defaultSummaryProvider} API key not set in Settings`); return; }
    setError(null);
    setProcessing("summarizing");
    await updateNote(id, { state: "summarizing" });
    try {
      const content = await summarize(
        settings.defaultSummaryProvider,
        apiKey,
        segments,
        settings.defaultSummaryModel,
        settings.summarySystemPrompt
      );
      await setSummary({
        noteId: id,
        content,
        model: settings.defaultSummaryModel,
        prompt: settings.summarySystemPrompt,
        createdAt: Date.now(),
      });
      await updateNote(id, { state: "done" });
    } catch (e) {
      setError(String(e));
      await updateNote(id, { state: "error" });
    } finally {
      setProcessing(null);
    }
  };

  if (!note) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">Note not found</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <button onClick={() => navigate("/notes")} className="rounded-md p-1.5 hover:bg-secondary transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-base font-semibold">{note.title || note.filename}</h1>
          <p className="text-xs text-muted-foreground">{formatDateTime(note.recordedAt ?? note.createdAt)}</p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={runTranscription}
            disabled={!!processing}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              "bg-secondary hover:bg-secondary/80 disabled:opacity-50"
            )}
          >
            {processing === "transcribing" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Transcribe
          </button>
          <button
            onClick={runSummary}
            disabled={!!processing || segments.length === 0}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            )}
          >
            {processing === "summarizing" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Summarize
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 border-b border-destructive/30 bg-destructive/10 px-6 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button className="ml-auto text-xs underline" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {/* Main: transcript + summary */}
      <div className="flex flex-1 overflow-hidden">
        {/* Transcript */}
        <div className="flex w-1/2 flex-col border-r border-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <span className="text-sm font-medium">Transcript</span>
            {note.durationMs && (
              <span className="text-xs text-muted-foreground">{formatDuration(note.durationMs)}</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {segments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {processing === "transcribing"
                  ? "Transcribing…"
                  : "No transcript yet. Click Transcribe to start."}
              </p>
            ) : (
              segments.map((seg, i) => (
                <TranscriptSegment
                  key={seg.id}
                  segment={seg}
                  active={i === activeSegmentIdx}
                  onClick={() => seekToSegment(seg)}
                />
              ))
            )}
          </div>

          {/* Audio player */}
          {audioUrl && (
            <div className="border-t border-border px-5 py-3 flex items-center gap-3">
              <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} />
              <button
                onClick={togglePlay}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground"
              >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
              </button>
              <div className="flex-1 text-xs text-muted-foreground">
                {formatDuration(currentMs)} / {note.durationMs ? formatDuration(note.durationMs) : "—"}
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="flex w-1/2 flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <span className="text-sm font-medium">Summary</span>
            {summary && (
              <span className="text-xs text-muted-foreground">{summary.model}</span>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {summary ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{summary.content}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {processing === "summarizing"
                  ? "Generating summary…"
                  : segments.length > 0
                  ? "Transcript ready. Click Summarize to generate."
                  : "Transcribe the recording first."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TranscriptSegment({
  segment,
  active,
  onClick,
}: {
  segment: TranscriptionSegment;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full rounded-lg px-3 py-2 text-left transition-colors",
        active ? "bg-accent" : "hover:bg-secondary/60"
      )}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] font-mono text-muted-foreground tabular-nums shrink-0">
          {formatDuration(segment.beginMs)}
        </span>
        {segment.speaker && (
          <span className="text-xs font-medium text-primary shrink-0">{segment.speaker}</span>
        )}
      </div>
      <p className="mt-0.5 text-sm leading-relaxed">{segment.sentence}</p>
    </button>
  );
}
