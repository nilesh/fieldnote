import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useNotesStore } from "@/stores/notesStore";
import { searchNotes } from "@/lib/db";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import type { Note } from "@/types";

function formatRelDate(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function formatDur(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function SearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const notes = useNotesStore((s) => s.notes);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Note[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(notes.slice(0, 10));
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, notes]);

  useEffect(() => {
    if (!open) return;
    if (!query.trim()) {
      setResults(notes.slice(0, 10));
      return;
    }
    const timer = setTimeout(async () => {
      const found = await searchNotes(query);
      setResults(found);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, open, notes]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent
        className="top-[15vh] translate-y-0 max-w-[560px] gap-0 overflow-hidden rounded-2xl border bg-card p-0 shadow-lg data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-top-[48%] [&>button]:hidden"
      >
        <VisuallyHidden.Root>
          <DialogTitle>Search</DialogTitle>
        </VisuallyHidden.Root>

        {/* Search input */}
        <div className="flex items-center gap-2.5 border-b px-[18px] py-3.5">
          <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
          <Input
            ref={inputRef}
            autoFocus
            placeholder="Search meetings, transcripts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-auto border-none bg-transparent p-0 text-[15px] text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
          />
          <kbd
            onClick={onClose}
            className="cursor-pointer shrink-0 rounded bg-muted px-2 py-[3px] text-[11px] text-muted-foreground"
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <ScrollArea className="max-h-[400px]">
          <div className="p-2">
            {results.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No results found
              </div>
            ) : (
              results.map((m) => (
                <div
                  key={m.id}
                  onClick={() => {
                    navigate(`/meetings/${m.id}`);
                    onClose();
                    setQuery("");
                  }}
                  className="cursor-pointer rounded-lg px-3.5 py-2.5 hover:bg-accent hover:text-accent-foreground"
                >
                  <div className="text-sm font-medium text-foreground">
                    {m.title || m.filename}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {formatRelDate(m.recordedAt ?? m.createdAt)}
                    {m.durationMs ? ` · ${formatDur(m.durationMs)}` : ""}
                    {m.folderId ? ` · ${m.folderId}` : ""}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
