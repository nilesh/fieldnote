import { create } from "zustand";
import type { Note, TranscriptionSegment, Summary } from "@/types";
import * as db from "@/lib/db";

interface NotesState {
  notes: Note[];
  activeNoteId: string | null;
  transcriptions: Record<string, TranscriptionSegment[]>;
  summaries: Record<string, Summary | null>;
  loading: boolean;

  loadNotes: () => Promise<void>;
  setActiveNote: (id: string | null) => void;
  addNote: (note: Omit<Note, "id">) => Promise<Note>;
  updateNote: (id: string, patch: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  loadTranscriptions: (noteId: string) => Promise<void>;
  setTranscriptions: (noteId: string, segments: Omit<TranscriptionSegment, "id">[]) => Promise<void>;
  loadSummary: (noteId: string) => Promise<void>;
  setSummary: (summary: Omit<Summary, "id">) => Promise<void>;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  activeNoteId: null,
  transcriptions: {},
  summaries: {},
  loading: false,

  loadNotes: async () => {
    set({ loading: true });
    const notes = await db.getNotes();
    set({ notes, loading: false });
  },

  setActiveNote: (id) => set({ activeNoteId: id }),

  addNote: async (note) => {
    const created = await db.insertNote(note);
    set((s) => ({ notes: [created, ...s.notes] }));
    return created;
  },

  updateNote: async (id, patch) => {
    await db.updateNote(id, patch);
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    }));
  },

  deleteNote: async (id) => {
    await db.deleteNote(id);
    set((s) => ({
      notes: s.notes.filter((n) => n.id !== id),
      activeNoteId: s.activeNoteId === id ? null : s.activeNoteId,
    }));
  },

  loadTranscriptions: async (noteId) => {
    const segments = await db.getTranscriptions(noteId);
    set((s) => ({ transcriptions: { ...s.transcriptions, [noteId]: segments } }));
  },

  setTranscriptions: async (noteId, segments) => {
    await db.deleteTranscriptions(noteId);
    await db.insertTranscriptions(segments);
    const saved = await db.getTranscriptions(noteId);
    set((s) => ({ transcriptions: { ...s.transcriptions, [noteId]: saved } }));
  },

  loadSummary: async (noteId) => {
    const summary = await db.getLatestSummary(noteId);
    set((s) => ({ summaries: { ...s.summaries, [noteId]: summary } }));
  },

  setSummary: async (summary) => {
    const saved = await db.insertSummary(summary);
    set((s) => ({ summaries: { ...s.summaries, [summary.noteId]: saved } }));
  },
}));
