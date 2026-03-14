import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Mic, Clock, Check, Upload, Users, ChevronRight, Folder } from "lucide-react";
import { useThemeStore } from "@/stores/themeStore";
import { useNotesStore } from "@/stores/notesStore";
import { getAllActionItems } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  label: string;
  value: string;
}) {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: iconBg }}
        >
          <Icon size={20} style={{ color: iconColor }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">
            {label}
          </p>
          <p className="text-xl font-bold tabular-nums text-foreground">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Meeting Card
// ---------------------------------------------------------------------------

function MeetingCard({ note, onClick }: { note: Note; onClick: () => void }) {
  const { t } = useThemeStore();
  const dateStr = formatRelativeDate(note.recordedAt ?? note.createdAt);
  const duration = note.durationMs ? formatDurationHm(note.durationMs) : "--";
  const tags = note.tags ?? [];

  return (
    <Card
      className="hover:border-primary hover:shadow-md transition-all cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="flex w-full flex-col p-5 text-left">
        {/* Title + tags row */}
        <div className="flex items-start justify-between gap-3">
          <p className="line-clamp-1 text-[15px] font-semibold text-foreground">
            {note.title || note.filename}
          </p>
          {tags.length > 0 && (
            <div className="flex shrink-0 flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="rounded-full">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Metadata row */}
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {dateStr}
          </span>
          <span className="flex items-center gap-1">
            <Mic size={12} />
            {duration}
          </span>
          <span className="flex items-center gap-1">
            <Users size={12} />
            --
          </span>
        </div>

        {/* Summary preview */}
        <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
          {statePreviewText(note.state)}
        </p>

        {/* Bottom row */}
        <div className="mt-4 flex items-center justify-between">
          {/* Speaker avatar placeholders */}
          <div className="flex -space-x-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium"
                style={{
                  background: t.tanL,
                  border: `2px solid ${t.bgC}`,
                  color: t.txM,
                }}
              >
                ?
              </div>
            ))}
          </div>

          {/* Action item progress placeholder + chevron */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>--</span>
            <ChevronRight size={14} style={{ color: t.ac }} />
          </div>
        </div>
      </CardContent>
    </Card>
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

  useEffect(() => {
    getAllActionItems().then(setAllActions).catch(() => {});
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
    return (totalMs / 3_600_000).toFixed(1);
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
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* -- Header -------------------------------------------------------- */}
      <div className="flex items-center justify-between border-b px-6 py-5">
        <h1 className="text-2xl font-bold text-foreground">Meetings</h1>
        <Button variant="gradient" onClick={handleImport}>
          <Upload size={16} />
          Import Recording
        </Button>
      </div>

      {/* -- Scrollable content -------------------------------------------- */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* -- Stats row --------------------------------------------------- */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            icon={Mic}
            iconColor={t.ac}
            iconBg={t.acL}
            label="Total Meetings"
            value={String(notes.length)}
          />
          <StatCard
            icon={Clock}
            iconColor={t.lk}
            iconBg={t.lkL}
            label="Recorded Hours"
            value={totalHours}
          />
          <StatCard
            icon={Check}
            iconColor={t.ok}
            iconBg={t.okL}
            label="Action Items"
            value={String(allActions.length)}
          />
          <StatCard
            icon={Clock}
            iconColor={t.warn}
            iconBg={t.warnL}
            label="Pending"
            value={String(allActions.filter((a) => !a.done).length)}
          />
        </div>

        {/* -- Folder + Tag filters ---------------------------------------- */}
        {(folders.length > 0 || allTags.length > 0) && (
          <div className="mt-6 space-y-3">
            {/* Folder tabs */}
            {folders.length > 0 && (
              <div className="flex items-center gap-2">
                <Folder size={14} className="text-muted-foreground" />
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveFolder(null)}
                    style={
                      activeFolder === null
                        ? { background: t.ac, color: t.acT }
                        : undefined
                    }
                  >
                    All
                  </Button>
                  {folders.map((f) => (
                    <Button
                      key={f}
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveFolder(activeFolder === f ? null : f)}
                      style={
                        activeFolder === f
                          ? { background: t.ac, color: t.acT }
                          : undefined
                      }
                    >
                      {f}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Tag chips */}
            {allTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => {
                  const isActive = activeTags.has(tag);
                  return (
                    <Badge
                      key={tag}
                      variant={isActive ? "default" : "outline"}
                      className="cursor-pointer rounded-full"
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* -- Meeting cards ----------------------------------------------- */}
        <div className="mt-6">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <p className="text-sm text-muted-foreground">
                No meetings match your filters.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {filtered.map((note) => (
                <MeetingCard
                  key={note.id}
                  note={note}
                  onClick={() => navigate(`/meetings/${note.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
