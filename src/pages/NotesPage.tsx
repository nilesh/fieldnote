import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, List, Search } from "lucide-react";
import { useNotesStore } from "@/stores/notesStore";
import { cn, formatDuration, formatDate } from "@/lib/utils";
import type { Note } from "@/types";

const STATE_BADGE: Record<Note["state"], { label: string; className: string }> = {
  imported:     { label: "Imported",     className: "bg-secondary text-muted-foreground" },
  transcribing: { label: "Transcribing", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  transcribed:  { label: "Transcribed",  className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
  summarizing:  { label: "Summarizing",  className: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300" },
  done:         { label: "Done",         className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
  error:        { label: "Error",        className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

export default function NotesPage() {
  const notes = useNotesStore((s) => s.notes);
  const navigate = useNavigate();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");

  const filtered = notes.filter((n) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      n.title?.toLowerCase().includes(q) ||
      n.filename.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold">Notes</h1>
        <div className="ml-auto flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-56 rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {/* View toggle */}
          <div className="flex rounded-md border border-border">
            <button
              onClick={() => setView("grid")}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-l-md transition-colors",
                view === "grid" ? "bg-secondary" : "hover:bg-secondary/50"
              )}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-r-md border-l border-border transition-colors",
                view === "list" ? "bg-secondary" : "hover:bg-secondary/50"
              )}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {filtered.length === 0 ? (
          <EmptyState hasNotes={notes.length > 0} />
        ) : view === "grid" ? (
          <GridView notes={filtered} onOpen={(id) => navigate(`/notes/${id}`)} />
        ) : (
          <ListView notes={filtered} onOpen={(id) => navigate(`/notes/${id}`)} />
        )}
      </div>
    </div>
  );
}

function EmptyState({ hasNotes }: { hasNotes: boolean }) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 rounded-full bg-secondary p-4">
        <Search className="h-8 w-8 text-muted-foreground" />
      </div>
      <p className="text-lg font-medium">
        {hasNotes ? "No notes match your search" : "No notes yet"}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">
        {hasNotes
          ? "Try a different search term"
          : "Connect your device to import recordings"}
      </p>
      {!hasNotes && (
        <button
          onClick={() => navigate("/device")}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Connect Device
        </button>
      )}
    </div>
  );
}

function GridView({ notes, onOpen }: { notes: Note[]; onOpen: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} onOpen={onOpen} />
      ))}
    </div>
  );
}

function NoteCard({ note, onOpen }: { note: Note; onOpen: (id: string) => void }) {
  const badge = STATE_BADGE[note.state];
  return (
    <button
      onClick={() => onOpen(note.id)}
      className="group flex flex-col rounded-xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", badge.className)}>
          {badge.label}
        </span>
        {note.durationMs && (
          <span className="text-xs text-muted-foreground">{formatDuration(note.durationMs)}</span>
        )}
      </div>
      <p className="flex-1 text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
        {note.title || note.filename}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        {formatDate(note.recordedAt ?? note.createdAt)}
      </p>
    </button>
  );
}

function ListView({ notes, onOpen }: { notes: Note[]; onOpen: (id: string) => void }) {
  return (
    <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
      {notes.map((note) => (
        <NoteRow key={note.id} note={note} onOpen={onOpen} />
      ))}
    </div>
  );
}

function NoteRow({ note, onOpen }: { note: Note; onOpen: (id: string) => void }) {
  const badge = STATE_BADGE[note.state];
  return (
    <button
      onClick={() => onOpen(note.id)}
      className="flex items-center gap-4 px-4 py-3 text-left hover:bg-secondary/50 transition-colors first:rounded-t-xl last:rounded-b-xl"
    >
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{note.title || note.filename}</p>
        <p className="text-xs text-muted-foreground">{formatDate(note.recordedAt ?? note.createdAt)}</p>
      </div>
      {note.durationMs && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatDuration(note.durationMs)}
        </span>
      )}
      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", badge.className)}>
        {badge.label}
      </span>
    </button>
  );
}
