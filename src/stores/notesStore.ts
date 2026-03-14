import { create } from "zustand";
import type { Note, TranscriptionSegment, Summary, ActionItem, KeyDecision } from "@/types";
import * as db from "@/lib/db";

interface NotesState {
  notes: Note[];
  activeNoteId: string | null;
  transcriptions: Record<string, TranscriptionSegment[]>;
  summaries: Record<string, Summary | null>;
  actionItems: Record<string, ActionItem[]>;
  keyDecisions: Record<string, KeyDecision[]>;
  loading: boolean;

  loadNotes: () => Promise<void>;
  setActiveNote: (id: string | null) => void;
  addNote: (note: Omit<Note, "id">) => Promise<Note>;
  updateNote: (id: string, patch: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  loadTranscriptions: (noteId: string) => Promise<void>;
  setTranscriptions: (noteId: string, segments: Omit<TranscriptionSegment, "id">[]) => Promise<void>;
  updateSegmentSpeaker: (noteId: string, segmentId: string, speaker: string | null) => Promise<void>;
  loadSummary: (noteId: string) => Promise<void>;
  setSummary: (summary: Omit<Summary, "id">) => Promise<void>;
  loadActionItems: (noteId: string) => Promise<void>;
  setActionItems: (noteId: string, items: Omit<ActionItem, "id">[]) => Promise<void>;
  toggleActionItem: (id: string, noteId: string, done: boolean) => Promise<void>;
  loadKeyDecisions: (noteId: string) => Promise<void>;
  setKeyDecisions: (noteId: string, items: Omit<KeyDecision, "id">[]) => Promise<void>;
}

export const useNotesStore = create<NotesState>((set, _get) => ({
  notes: [],
  activeNoteId: null,
  transcriptions: {},
  summaries: {},
  actionItems: {},
  keyDecisions: {},
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

  updateSegmentSpeaker: async (noteId, segmentId, speaker) => {
    await db.updateSegmentSpeaker(segmentId, speaker);
    // Optimistically update in store
    set((s) => ({
      transcriptions: {
        ...s.transcriptions,
        [noteId]: (s.transcriptions[noteId] ?? []).map((seg) =>
          seg.id === segmentId ? { ...seg, speaker } : seg
        ),
      },
    }));
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

  loadActionItems: async (noteId) => {
    const items = await db.getActionItems(noteId);
    set((s) => ({ actionItems: { ...s.actionItems, [noteId]: items } }));
  },

  setActionItems: async (noteId, items) => {
    await db.insertActionItems(items);
    const saved = await db.getActionItems(noteId);
    set((s) => ({ actionItems: { ...s.actionItems, [noteId]: saved } }));
  },

  toggleActionItem: async (id, noteId, done) => {
    await db.toggleActionItem(id, done);
    set((s) => ({
      actionItems: {
        ...s.actionItems,
        [noteId]: (s.actionItems[noteId] ?? []).map((a) =>
          a.id === id ? { ...a, done } : a
        ),
      },
    }));
  },

  loadKeyDecisions: async (noteId) => {
    const items = await db.getKeyDecisions(noteId);
    set((s) => ({ keyDecisions: { ...s.keyDecisions, [noteId]: items } }));
  },

  setKeyDecisions: async (noteId, items) => {
    await db.insertKeyDecisions(items);
    const saved = await db.getKeyDecisions(noteId);
    set((s) => ({ keyDecisions: { ...s.keyDecisions, [noteId]: saved } }));
  },
}));
