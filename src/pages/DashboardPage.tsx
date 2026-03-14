import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Clock, Check, Upload, Users, ChevronRight, Folder } from "lucide-react";
import { useThemeStore } from "@/stores/themeStore";
import { useNotesStore } from "@/stores/notesStore";
import { getAllActionItems, getActionItems, getLatestSummary } from "@/lib/db";
import { Button } from "@/components/ui/button";
import type { Theme } from "@/lib/theme";
import type { Note, ActionItem } from "@/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDurationHm(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatRelativeDate(unixMs: number): string {
  const now = Date.now();
  const diff = now - unixMs;
  const days = Math.floor(diff / 86_400_000);

  if (days < 0) return new Date(unixMs).toLocaleDateString();
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return new Date(unixMs).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function statePreviewText(state: Note["state"]): string {
  switch (state) {
    case "imported":
      return "Recording imported. Start transcription to generate a summary.";
    case "transcribing":
      return "Transcription in progress...";
    case "transcribed":
      return "Transcription complete. Ready for summarization.";
    case "summarizing":
      return "Generating summary...";
    case "done":
      return "Meeting fully processed with transcript and summary.";
    case "error":
      return "An error occurred during processing.";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Stat Card (matches mockup)
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  iconColor,
  label,
  value,
  t,
}: {
  icon: React.ElementType;
  iconColor: string;
  label: string;
  value: string;
  t: Theme;
}) {
  return (
    <div
      style={{
        padding: "18px 20px",
        background: t.bgC,
        borderRadius: 12,
        border: `1px solid ${t.bd}`,
        boxShadow: t.sh,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 10,
          color: t.tx2,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: iconColor + "18",
            color: iconColor,
          }}
        >
          <Icon size={18} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 500 }}>{label}</span>
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: t.tx,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meeting Card (matches mockup — full-width list item)
// ---------------------------------------------------------------------------

function MeetingCard({
  note,
  summary,
  actionItems,
  onClick,
  t,
}: {
  note: Note;
  summary: string | null;
  actionItems: ActionItem[];
  onClick: () => void;
  t: Theme;
}) {
  const dateStr = formatRelativeDate(note.recordedAt ?? note.createdAt);
  const duration = note.durationMs ? formatDurationHm(note.durationMs) : "--";
  const tags = note.tags ?? [];
  const doneCount = actionItems.filter((a) => a.done).length;
  const previewText = summary || statePreviewText(note.state);

  return (
    <div
      onClick={onClick}
      style={{
        padding: "16px 20px",
        background: t.bgC,
        borderRadius: 12,
        border: `1px solid ${t.bd}`,
        cursor: "pointer",
        boxShadow: t.sh,
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = t.ac;
        e.currentTarget.style.boxShadow = t.shL;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = t.bd;
        e.currentTarget.style.boxShadow = t.sh;
      }}
    >
      {/* Title + tags */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 8,
        }}
      >
        <div>
          <h3
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: t.tx,
              margin: 0,
            }}
          >
            {note.title || note.filename}
          </h3>
          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 4,
              fontSize: 12,
              color: t.tx2,
            }}
          >
            <span>{dateStr}</span>
            <span>{duration}</span>
            <span
              style={{ display: "flex", alignItems: "center", gap: 4 }}
            >
              <Users size={12} /> --
            </span>
          </div>
        </div>
        {tags.length > 0 && (
          <div style={{ display: "flex", gap: 4 }}>
            {tags.map((tag) => (
              <span
                key={tag}
                style={{
                  padding: "2px 8px",
                  borderRadius: 10,
                  fontSize: 11,
                  fontWeight: 500,
                  background: t.tanL,
                  color: t.tx2,
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Summary preview */}
      <p
        style={{
          fontSize: 13,
          color: t.tx2,
          margin: "8px 0 10px",
          lineHeight: 1.5,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {previewText}
      </p>

      {/* Bottom row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        {/* Speaker avatars — placeholder until speakers are loaded */}
        <div style={{ display: "flex" }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: t.tanL,
                border: `2px solid ${t.bgC}`,
                marginLeft: i > 0 ? -6 : 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 600,
                color: t.txM,
              }}
            >
              ?
            </div>
          ))}
        </div>

        {/* Action items + chevron */}
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            fontSize: 12,
            color: t.tx2,
          }}
        >
          {actionItems.length > 0 && (
            <span
              style={{ display: "flex", alignItems: "center", gap: 4 }}
            >
              <Check size={12} /> {doneCount}/{actionItems.length}
            </span>
          )}
          <ChevronRight size={14} style={{ color: t.txM }} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { t } = useThemeStore();
  const notes = useNotesStore((s) => s.notes);
  const navigate = useNavigate();

  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [allActions, setAllActions] = useState<ActionItem[]>([]);
  const [noteActions, setNoteActions] = useState<Record<string, ActionItem[]>>({});
  const [noteSummaries, setNoteSummaries] = useState<Record<string, string | null>>({});

  // Load global action items + per-note data
  useEffect(() => {
    getAllActionItems().then(setAllActions).catch(() => {});

    // Load per-note action items and summaries
    (async () => {
      const actions: Record<string, ActionItem[]> = {};
      const summaries: Record<string, string | null> = {};
      for (const note of notes) {
        const [items, summary] = await Promise.all([
          getActionItems(note.id).catch(() => [] as ActionItem[]),
          getLatestSummary(note.id).catch(() => null),
        ]);
        actions[note.id] = items;
        summaries[note.id] = summary?.content ?? null;
      }
      setNoteActions(actions);
      setNoteSummaries(summaries);
    })();
  }, [notes]);

  // Derived data
  const folders = useMemo(() => {
    const set = new Set<string>();
    for (const n of notes) {
      if (n.folderId) set.add(n.folderId);
    }
    return Array.from(set).sort();
  }, [notes]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const n of notes) {
      for (const tag of n.tags ?? []) set.add(tag);
    }
    return Array.from(set).sort();
  }, [notes]);

  const totalHours = useMemo(() => {
    const totalMs = notes.reduce((sum, n) => sum + (n.durationMs ?? 0), 0);
    return `${(totalMs / 3_600_000).toFixed(1)}h`;
  }, [notes]);

  // Filter
  const filtered = useMemo(() => {
    let result = notes;
    if (activeFolder !== null) {
      result = result.filter((n) => n.folderId === activeFolder);
    }
    if (activeTags.size > 0) {
      result = result.filter((n) =>
        (n.tags ?? []).some((tag) => activeTags.has(tag))
      );
    }
    return result;
  }, [notes, activeFolder, activeTags]);

  function toggleTag(tag: string) {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function handleImport() {
    window.dispatchEvent(new CustomEvent("open-import"));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 24px",
        }}
      >
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: t.tx,
            margin: 0,
            letterSpacing: "-0.025em",
          }}
        >
          Meetings
        </h1>
        <Button variant="gradient" onClick={handleImport}>
          <Upload size={16} />
          Import Recording
        </Button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 24px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            <StatCard icon={Mic} iconColor={t.ac} label="Total Meetings" value={String(notes.length)} t={t} />
            <StatCard icon={Clock} iconColor={t.lk} label="Recorded Hours" value={totalHours} t={t} />
            <StatCard icon={Check} iconColor={t.ok} label="Action Items" value={String(allActions.length)} t={t} />
            <StatCard icon={Clock} iconColor={t.warn} label="Pending" value={String(allActions.filter((a) => !a.done).length)} t={t} />
          </div>

          {/* Folder + Tag filters */}
          {(folders.length > 0 || allTags.length > 0) && (
            <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
              {folders.length > 0 && (
                <>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button
                      onClick={() => setActiveFolder(null)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 6,
                        border: "none",
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                        background: activeFolder === null ? t.ac : "transparent",
                        color: activeFolder === null ? t.acT : t.tx2,
                      }}
                    >
                      <Folder
                        size={12}
                        style={{ marginRight: 4, verticalAlign: -2 }}
                      />{" "}
                      All
                    </button>
                    {folders.map((f) => (
                      <button
                        key={f}
                        onClick={() =>
                          setActiveFolder(activeFolder === f ? null : f)
                        }
                        style={{
                          padding: "6px 14px",
                          borderRadius: 6,
                          border: "none",
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: "pointer",
                          background: activeFolder === f ? t.ac : "transparent",
                          color: activeFolder === f ? t.acT : t.tx2,
                        }}
                      >
                        <Folder
                          size={12}
                          style={{ marginRight: 4, verticalAlign: -2 }}
                        />{" "}
                        {f}
                      </button>
                    ))}
                  </div>
                  {allTags.length > 0 && (
                    <div
                      style={{ width: 1, height: 20, background: t.bd }}
                    />
                  )}
                </>
              )}
              {allTags.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {allTags.map((tag) => {
                    const isActive = activeTags.has(tag);
                    return (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 12,
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: "pointer",
                          border: `1px solid ${isActive ? t.lk : t.bd}`,
                          background: isActive ? t.lkL : "transparent",
                          color: isActive ? t.lk : t.tx2,
                        }}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Meeting list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: 48,
                  color: t.txM,
                  fontSize: 14,
                }}
              >
                No meetings match your filters.
              </div>
            ) : (
              filtered.map((note) => (
                <MeetingCard
                  key={note.id}
                  note={note}
                  summary={noteSummaries[note.id] ?? null}
                  actionItems={noteActions[note.id] ?? []}
                  onClick={() => navigate(`/meetings/${note.id}`)}
                  t={t}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
