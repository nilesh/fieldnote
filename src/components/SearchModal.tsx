import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { useThemeStore } from "@/stores/themeStore";
import { useNotesStore } from "@/stores/notesStore";
import { searchNotes } from "@/lib/db";
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
  const { t, dark: dk } = useThemeStore();
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

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "15vh",
        zIndex: 1000,
        backdropFilter: "blur(6px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560,
          background: t.bgC,
          borderRadius: 16,
          border: `1px solid ${t.bd}`,
          boxShadow: dk
            ? "0 8px 24px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.03)"
            : "0 24px 80px rgba(25,31,69,0.25)",
          overflow: "hidden",
        }}
      >
        {/* Search input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 18px",
            borderBottom: `1px solid ${t.bd}`,
          }}
        >
          <Search style={{ color: t.txM, width: 18, height: 18, flexShrink: 0 }} />
          <input
            ref={inputRef}
            autoFocus
            placeholder="Search meetings, transcripts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: 15,
              background: "transparent",
              color: t.tx,
              fontFamily: "inherit",
            }}
          />
          <kbd
            onClick={onClose}
            style={{
              fontSize: 11,
              color: t.txM,
              background: t.bgA,
              padding: "3px 8px",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 400, overflow: "auto", padding: 8 }}>
          {results.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 48,
                color: t.txM,
                fontSize: 14,
              }}
            >
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
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = t.bgH;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "transparent";
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 500, color: t.tx }}>
                  {m.title || m.filename}
                </div>
                <div style={{ fontSize: 12, color: t.tx2, marginTop: 2 }}>
                  {formatRelDate(m.recordedAt ?? m.createdAt)}
                  {m.durationMs ? ` · ${formatDur(m.durationMs)}` : ""}
                  {m.folderId ? ` · ${m.folderId}` : ""}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
