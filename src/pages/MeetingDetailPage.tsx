import { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  Play,
  Pause,
  Loader2,
  Wand2,
  Sparkles,
  Upload,
  AlertCircle,
  Check,
  Folder,
  UserRound,
} from "lucide-react";
import { useNotesStore } from "@/stores/notesStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useThemeStore } from "@/stores/themeStore";
import { formatDuration, formatDateTime } from "@/lib/utils";
import { transcribeAudio, toTranscriptionSegments } from "@/lib/api/transcribe";
import { summarize } from "@/lib/api/summarize";
import { readFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from "react-markdown";
import type { TranscriptionSegment, ActionItem, KeyDecision } from "@/types";
import { VOICE_COLORS } from "@/lib/theme";
import type { Theme } from "@/lib/theme";

type Tab = "transcript" | "summary" | "actions" | "decisions";

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, dark: dk } = useThemeStore();
  const {
    notes,
    transcriptions,
    summaries,
    actionItems,
    keyDecisions,
    updateNote,
    loadTranscriptions,
    setTranscriptions,
    loadSummary,
    setSummary,
    loadActionItems,
    toggleActionItem,
    loadKeyDecisions,
  } = useNotesStore();
  const settings = useSettingsStore((s) => s.settings);

  const note = notes.find((n) => n.id === id);
  const segments = id ? (transcriptions[id] ?? []) : [];
  const summary = id ? (summaries[id] ?? null) : null;
  const actions = id ? (actionItems[id] ?? []) : [];
  const decisions = id ? (keyDecisions[id] ?? []) : [];

  const [activeTab, setActiveTab] = useState<Tab>("transcript");
  const [processing, setProcessing] = useState<"transcribing" | "summarizing" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSegmentIdx, setActiveSegmentIdx] = useState<number>(-1);

  // Audio player
  const audioRef = useRef<HTMLAudioElement>(null);
  const scrubberRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioDurationMs, setAudioDurationMs] = useState(0);

  // Speaker color map
  const speakerColors = useMemo(() => {
    const map: Record<string, string> = {};
    let ci = 0;
    for (const seg of segments) {
      if (seg.speaker && !(seg.speaker in map)) {
        map[seg.speaker] = VOICE_COLORS[ci % VOICE_COLORS.length];
        ci++;
      }
    }
    return map;
  }, [segments]);

  // Load data on mount
  useEffect(() => {
    if (!id) return;
    loadTranscriptions(id);
    loadSummary(id);
    loadActionItems(id);
    loadKeyDecisions(id);
  }, [id]);

  // Load audio from local file
  useEffect(() => {
    if (!note?.filePath) return;
    let url: string | null = null;
    readFile(note.filePath)
      .then((data) => {
        const blob = new Blob([data], { type: "audio/mpeg" });
        url = URL.createObjectURL(blob);
        setAudioUrl(url);
      })
      .catch(() => setAudioUrl(null));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
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
    const durationHandler = () => {
      if (audioRef.current && audioRef.current.duration && isFinite(audioRef.current.duration)) {
        setAudioDurationMs(audioRef.current.duration * 1000);
      }
    };
    audioRef.current.addEventListener("timeupdate", handler);
    audioRef.current.addEventListener("loadedmetadata", durationHandler);
    audioRef.current.addEventListener("durationchange", durationHandler);
    return () => {
      audioRef.current?.removeEventListener("timeupdate", handler);
      audioRef.current?.removeEventListener("loadedmetadata", durationHandler);
      audioRef.current?.removeEventListener("durationchange", durationHandler);
    };
  }, [segments]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const seekToSegment = (seg: TranscriptionSegment) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = seg.beginMs / 1000;
    audioRef.current.play();
    setPlaying(true);
  };

  const seekToPosition = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !scrubberRef.current) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const totalMs = note?.durationMs || audioDurationMs;
    if (totalMs > 0) {
      audioRef.current.currentTime = (frac * totalMs) / 1000;
    }
  };

  const runTranscription = async () => {
    if (!note || !id) return;
    if (!settings.openaiApiKey) {
      setError("OpenAI API key not set in Settings");
      return;
    }
    setError(null);
    setProcessing("transcribing");
    await updateNote(id, { state: "transcribing" });
    try {
      let audioPath = note.filePath;
      let audioFilename = note.filename;
      if (note.filename.endsWith(".hda")) {
        audioPath = await invoke<string>("convert_hda_to_mp3", { filePath: note.filePath });
        audioFilename = note.filename.replace(/\.hda$/i, ".mp3");
      }
      const data = await readFile(audioPath);
      const whisperSegments = await transcribeAudio(
        settings.openaiApiKey,
        data,
        audioFilename,
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
    if (!apiKey) {
      setError(`${settings.defaultSummaryProvider} API key not set in Settings`);
      return;
    }
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
      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          background: t.bg,
          color: t.txM,
          fontSize: 15,
        }}
      >
        Meeting not found
      </div>
    );
  }

  const totalDurationMs = note.durationMs || audioDurationMs;
  const scrubFraction = totalDurationMs > 0 ? currentMs / totalDurationMs : 0;

  const hasSentiment =
    note.sentimentPositive != null &&
    note.sentimentNeutral != null &&
    note.sentimentNegative != null;

  const tabs: { key: Tab; label: string }[] = [
    { key: "transcript", label: "Transcript" },
    { key: "summary", label: "Summary" },
    { key: "actions", label: "Action Items" },
    { key: "decisions", label: "Decisions" },
  ];

  return (
    <div style={{ display: "flex", flex: 1, flexDirection: "column", overflow: "hidden" }}>
      {/* ─── Header Section ────────────────────────────────────────────── */}
      <div style={{ padding: "20px 28px 0 28px" }}>
        {/* Back link */}
        <button
          onClick={() => navigate("/meetings")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: t.lk,
            fontSize: 13,
            fontWeight: 500,
            padding: 0,
            marginBottom: 12,
          }}
        >
          <ChevronLeft size={16} />
          Back
        </button>

        {/* Title + processing buttons row */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: t.tx,
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {note.title || note.filename}
            </h1>

            {/* Metadata row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 8,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 13, color: t.tx2 }}>
                {formatDateTime(note.recordedAt ?? note.createdAt)}
              </span>
              {note.durationMs && (
                <span style={{ fontSize: 13, color: t.tx2 }}>
                  {formatDuration(note.durationMs)}
                </span>
              )}
              {note.folderId && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 500,
                    color: t.tx2,
                    background: t.tanL,
                    borderRadius: 9999,
                    padding: "2px 10px",
                  }}
                >
                  <Folder size={12} />
                  {note.folderId}
                </span>
              )}
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: t.tx2,
                    background: t.tanL,
                    borderRadius: 9999,
                    padding: "2px 10px",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Processing buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {segments.length === 0 && (
              <button
                onClick={runTranscription}
                disabled={!!processing}
                className="btn-gradient"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  padding: "7px 14px",
                  cursor: processing ? "not-allowed" : "pointer",
                  opacity: processing ? 0.5 : 1,
                }}
              >
                {processing === "transcribing" ? (
                  <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <Wand2 size={15} />
                )}
                Transcribe
              </button>
            )}
            {segments.length > 0 && !summary && (
              <button
                onClick={runSummary}
                disabled={!!processing}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 600,
                  color: t.acT,
                  background: t.lk,
                  border: "none",
                  borderRadius: 8,
                  padding: "7px 14px",
                  cursor: processing ? "not-allowed" : "pointer",
                  opacity: processing ? 0.5 : 1,
                }}
              >
                {processing === "summarizing" ? (
                  <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <Sparkles size={15} />
                )}
                Summarize
              </button>
            )}
          </div>
        </div>

        {/* Sentiment bar */}
        {hasSentiment && (
          <div style={{ marginTop: 14 }}>
            <div
              style={{
                display: "flex",
                height: 8,
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${note.sentimentPositive}%`,
                  background: t.ok,
                }}
              />
              <div
                style={{
                  width: `${note.sentimentNeutral}%`,
                  background: t.tan,
                }}
              />
              <div
                style={{
                  width: `${note.sentimentNegative}%`,
                  background: t.err,
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                gap: 16,
                marginTop: 4,
                fontSize: 11,
                color: t.txM,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: t.ok, display: "inline-block" }} />
                Positive {note.sentimentPositive}%
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: t.tan, display: "inline-block" }} />
                Neutral {note.sentimentNeutral}%
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: t.err, display: "inline-block" }} />
                Negative {note.sentimentNegative}%
              </span>
            </div>
          </div>
        )}

        {/* Export buttons row */}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          {["PDF", "Markdown", "Notion"].map((label) => (
            <button
              key={label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 500,
                color: t.tx2,
                background: t.bgC,
                border: `1px solid ${t.bd}`,
                borderRadius: 7,
                padding: "6px 12px",
                cursor: "pointer",
              }}
            >
              <Upload size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 12,
              padding: "8px 12px",
              background: t.errL,
              borderRadius: 8,
              fontSize: 13,
              color: t.err,
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{error}</span>
            <button
              onClick={() => setError(null)}
              style={{
                background: "none",
                border: "none",
                color: t.err,
                cursor: "pointer",
                fontSize: 12,
                textDecoration: "underline",
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* ─── Tab Bar ──────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            gap: 0,
            marginTop: 20,
            borderBottom: `1px solid ${t.bd}`,
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: "none",
                border: "none",
                borderBottom: activeTab === tab.key ? `2px solid ${t.ac}` : "2px solid transparent",
                padding: "10px 18px",
                fontSize: 13,
                fontWeight: activeTab === tab.key ? 600 : 500,
                color: activeTab === tab.key ? t.tx : t.tx2,
                cursor: "pointer",
                transition: "color 0.15s, border-color 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Tab Content ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {activeTab === "transcript" && (
          <TranscriptTab
            segments={segments}
            noteId={id!}
            activeSegmentIdx={activeSegmentIdx}
            speakerColors={speakerColors}
            processing={processing}
            onSeek={seekToSegment}
            t={t}
          />
        )}

        {activeTab === "summary" && (
          <SummaryTab summary={summary} processing={processing} segments={segments} t={t} dk={dk} />
        )}

        {activeTab === "actions" && (
          <ActionItemsTab
            items={actions}
            noteId={id!}
            toggleActionItem={toggleActionItem}
            t={t}
          />
        )}

        {activeTab === "decisions" && <KeyDecisionsTab decisions={decisions} t={t} />}
      </div>

      {/* ─── Audio Player (always visible when audio loaded) ─────────── */}
      {audioUrl && activeTab === "transcript" && (
        <div
          style={{
            borderTop: `1px solid ${t.bd}`,
            padding: "12px 28px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: t.bgC,
          }}
        >
          <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} />

          {/* Play/Pause button */}
          <button
            onClick={togglePlay}
            className="btn-gradient"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {playing ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}
          </button>

          {/* Current time */}
          <span
            style={{
              fontSize: 12,
              fontVariantNumeric: "tabular-nums",
              color: t.tx2,
              minWidth: 42,
              textAlign: "right",
            }}
          >
            {formatDuration(currentMs)}
          </span>

          {/* Scrubber */}
          <div
            ref={scrubberRef}
            onClick={seekToPosition}
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              background: t.bdL,
              cursor: "pointer",
              position: "relative",
            }}
          >
            <div
              className="gradient-storage"
              style={{
                height: "100%",
                borderRadius: 3,
                width: `${Math.min(scrubFraction * 100, 100)}%`,
                transition: "width 0.1s linear",
              }}
            />
            {/* Thumb */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: `${Math.min(scrubFraction * 100, 100)}%`,
                transform: "translate(-50%, -50%)",
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: t.ac,
                border: `2px solid ${t.bgC}`,
                boxShadow: t.sh,
              }}
            />
          </div>

          {/* Duration */}
          <span
            style={{
              fontSize: 12,
              fontVariantNumeric: "tabular-nums",
              color: t.txM,
              minWidth: 42,
            }}
          >
            {totalDurationMs > 0 ? formatDuration(totalDurationMs) : "--:--"}
          </span>
        </div>
      )}

      {/* Spin animation keyframes */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Transcript Tab ────────────────────────────────────────────────────────────

function TranscriptTab({
  segments,
  noteId,
  activeSegmentIdx,
  speakerColors,
  processing,
  onSeek,
  t,
}: {
  segments: TranscriptionSegment[];
  noteId: string;
  activeSegmentIdx: number;
  speakerColors: Record<string, string>;
  processing: "transcribing" | "summarizing" | null;
  onSeek: (seg: TranscriptionSegment) => void;
  t: Theme;
}) {
  const updateSegmentSpeaker = useNotesStore((s) => s.updateSegmentSpeaker);
  const [hoveredIdx, setHoveredIdx] = useState<number>(-1);
  const [editingIdx, setEditingIdx] = useState<number>(-1);
  const [speakerInput, setSpeakerInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Collect existing speaker names from all segments for quick-pick
  const existingSpeakers = useMemo(() => {
    const set = new Set<string>();
    for (const seg of segments) {
      if (seg.speaker) set.add(seg.speaker);
    }
    return Array.from(set).sort();
  }, [segments]);

  const openEditor = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingIdx(idx);
    setSpeakerInput(segments[idx]?.speaker || "");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commitSpeaker = async (idx: number, name: string) => {
    const seg = segments[idx];
    if (!seg) return;
    const speaker = name.trim() || null;
    if (speaker !== seg.speaker) {
      await updateSegmentSpeaker(noteId, seg.id, speaker);
    }
    setEditingIdx(-1);
    setSpeakerInput("");
  };

  const handleInputKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitSpeaker(idx, speakerInput);
    } else if (e.key === "Escape") {
      setEditingIdx(-1);
      setSpeakerInput("");
    }
  };

  if (segments.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: t.txM,
          fontSize: 14,
        }}
      >
        {processing === "transcribing" ? (
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            Transcribing...
          </span>
        ) : (
          "No transcript yet. Click Transcribe to start."
        )}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px 28px" }}>
      {segments.map((seg, i) => {
        const isActive = i === activeSegmentIdx;
        const isHovered = i === hoveredIdx;
        const isEditing = i === editingIdx;
        const speakerColor = seg.speaker ? speakerColors[seg.speaker] || t.lk : t.lk;

        return (
          <div
            key={seg.id}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(-1)}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              width: "100%",
              textAlign: "left",
              background: isActive ? t.acL : isHovered ? t.bgH : "transparent",
              borderRadius: 8,
              padding: "10px 12px",
              cursor: "pointer",
              transition: "background 0.15s",
              marginBottom: 2,
            }}
          >
            {/* Timestamp */}
            <span
              onClick={() => onSeek(seg)}
              style={{
                fontSize: 12,
                fontVariantNumeric: "tabular-nums",
                color: t.txM,
                flexShrink: 0,
                marginTop: 2,
                minWidth: 40,
              }}
            >
              {formatDuration(seg.beginMs)}
            </span>

            {/* Speaker color bar */}
            <div
              style={{
                width: 3,
                alignSelf: "stretch",
                borderRadius: 2,
                background: speakerColor,
                flexShrink: 0,
                minHeight: 20,
              }}
            />

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }} onClick={() => onSeek(seg)}>
              {/* Speaker label / editor */}
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: seg.speaker || isEditing || isHovered ? 2 : 0 }}>
                {isEditing ? (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      ref={inputRef}
                      value={speakerInput}
                      onChange={(e) => setSpeakerInput(e.target.value)}
                      onKeyDown={(e) => handleInputKeyDown(e, i)}
                      onBlur={() => commitSpeaker(i, speakerInput)}
                      placeholder="Speaker name..."
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: t.tx,
                        background: t.bgI,
                        border: `1px solid ${t.bd}`,
                        borderRadius: 4,
                        padding: "2px 6px",
                        outline: "none",
                        width: 120,
                        fontFamily: "inherit",
                      }}
                    />
                    {existingSpeakers.length > 0 && (
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                        {existingSpeakers.map((name) => (
                          <button
                            key={name}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              commitSpeaker(i, name);
                            }}
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: "2px 6px",
                              borderRadius: 4,
                              border: "none",
                              cursor: "pointer",
                              background: (speakerColors[name] || t.lk) + "20",
                              color: speakerColors[name] || t.lk,
                            }}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : seg.speaker ? (
                  <span
                    onClick={(e) => openEditor(i, e)}
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: speakerColor,
                      cursor: "pointer",
                    }}
                    title="Click to change speaker"
                  >
                    {seg.speaker}
                  </span>
                ) : isHovered ? (
                  <button
                    onClick={(e) => openEditor(i, e)}
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: t.txM,
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                      opacity: 0.7,
                      fontFamily: "inherit",
                    }}
                  >
                    <UserRound size={10} />
                    Assign speaker
                  </button>
                ) : null}
              </div>
              <span style={{ fontSize: 14, color: t.tx, lineHeight: 1.55 }}>{seg.sentence}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Summary Tab ───────────────────────────────────────────────────────────────

function SummaryTab({
  summary,
  processing,
  segments,
  t,
  dk,
}: {
  summary: { content: string; model: string } | null;
  processing: "transcribing" | "summarizing" | null;
  segments: TranscriptionSegment[];
  t: Theme;
  dk: boolean;
}) {
  if (!summary) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: t.txM,
          fontSize: 14,
        }}
      >
        {processing === "summarizing" ? (
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
            Generating summary...
          </span>
        ) : segments.length > 0 ? (
          "Transcript ready. Click Summarize to generate."
        ) : (
          "Transcribe the recording first."
        )}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
      <div
        style={{
          background: t.bgC,
          border: `1px solid ${t.bd}`,
          borderRadius: 12,
          padding: "20px 24px",
          boxShadow: t.sh,
        }}
      >
        {/* Card header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
            paddingBottom: 12,
            borderBottom: `1px solid ${t.bdL}`,
          }}
        >
          <Sparkles size={16} style={{ color: t.ac }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: t.tx }}>AI Summary</span>
          <span style={{ fontSize: 11, color: t.txM, marginLeft: "auto" }}>{summary.model}</span>
        </div>

        {/* Markdown content */}
        <div
          className={dk ? "prose prose-invert" : "prose"}
          style={{
            fontSize: 14,
            lineHeight: 1.65,
            color: t.tx,
            maxWidth: "none",
          }}
        >
          <ReactMarkdown>{summary.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

// ─── Action Items Tab ──────────────────────────────────────────────────────────

function ActionItemsTab({
  items,
  noteId,
  toggleActionItem,
  t,
}: {
  items: ActionItem[];
  noteId: string;
  toggleActionItem: (id: string, noteId: string, done: boolean) => Promise<void>;
  t: Theme;
}) {
  if (items.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: t.txM,
          fontSize: 14,
        }}
      >
        No action items yet.
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "10px 12px",
              borderRadius: 8,
              background: t.bgC,
              border: `1px solid ${t.bdL}`,
              opacity: item.done ? 0.5 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {/* Checkbox */}
            <button
              onClick={() => toggleActionItem(item.id, noteId, !item.done)}
              style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                border: `2px solid ${item.done ? t.ok : t.ok}`,
                background: item.done ? t.ok : "transparent",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              {item.done && <Check size={13} style={{ color: "#ffffff" }} />}
            </button>

            {/* Text + assignee */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 14,
                  color: t.tx,
                  textDecoration: item.done ? "line-through" : "none",
                  lineHeight: 1.5,
                }}
              >
                {item.text}
              </span>
              {item.assignee && (
                <span
                  style={{
                    display: "inline-block",
                    marginLeft: 8,
                    fontSize: 11,
                    fontWeight: 500,
                    color: t.lk,
                    background: t.lkL,
                    borderRadius: 9999,
                    padding: "1px 8px",
                  }}
                >
                  {item.assignee}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Key Decisions Tab ─────────────────────────────────────────────────────────

function KeyDecisionsTab({
  decisions,
  t,
}: {
  decisions: KeyDecision[];
  t: Theme;
}) {
  if (decisions.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: t.txM,
          fontSize: 14,
        }}
      >
        No key decisions yet.
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {decisions.map((dec, i) => (
          <div
            key={dec.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              padding: "12px 14px",
              borderRadius: 8,
              background: t.bgC,
              border: `1px solid ${t.bdL}`,
            }}
          >
            {/* Numbered circle */}
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: t.lk,
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {i + 1}
            </div>

            {/* Decision text */}
            <span style={{ fontSize: 14, color: t.tx, lineHeight: 1.55, paddingTop: 3 }}>
              {dec.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
