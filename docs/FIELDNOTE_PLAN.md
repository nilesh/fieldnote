# FieldNote Implementation Plan

> Handoff doc for Claude Code. Reference mockup: `fieldnote-app.jsx` (uploaded separately).
> Read `CLAUDE.md` for Jensen USB protocol details and current architecture.

---

## Current State

**Stack**: Tauri v2 + React + TypeScript + Tailwind + shadcn/ui + SQLite (tauri-plugin-sql)
**App name**: "Dock Notes" → rename to "FieldNote"
**Working**: USB connection to HiDock P1 (patched libusb1-sys), file listing, download, delete, HDA→MP3 conversion via ffmpeg, basic notes list/detail UI.

### Existing Files (Frontend)
```
src/App.tsx                    — Router, layout shell
src/components/Layout.tsx      — Sidebar + header layout
src/pages/DevicePage.tsx       — USB device connection UI
src/pages/NotesPage.tsx        — Notes list
src/pages/NoteDetailPage.tsx   — Single note view
src/pages/SettingsPage.tsx     — Settings form
src/stores/notesStore.ts       — Zustand store for notes
src/stores/settingsStore.ts    — Zustand store for settings
src/lib/db/index.ts            — SQLite schema + CRUD
src/lib/api/hinotes.ts         — HiNotes cloud API (optional)
src/lib/api/transcribe.ts      — Whisper transcription
src/lib/api/summarize.ts       — LLM summarization
src/types/index.ts             — TypeScript types
```

### Existing DB Schema
- `notes` — id, filename, file_path, signature, title, duration_ms, state, folder_id, tags (JSON string)
- `transcriptions` — id, note_id, begin_ms, end_ms, sentence, speaker, model
- `summaries` — id, note_id, content, model, prompt

---

## Target State (from Mockup)

The mockup defines a Notion-style app with dark sidebar, MP250 color palette, and these views:

1. **Dashboard** — stat cards (total meetings, hours, action items, pending), folder/tag filters, meeting cards with speaker avatars + sentiment + summary preview
2. **Meeting Detail** — 4 tabs (Transcript, Summary, Action Items, Decisions), audio player with scrubber, speaker-colored transcript, sentiment bar, export buttons (PDF/Markdown/Notion)
3. **Import Wizard** — modal, 4 steps: Source (upload file / transfer from device) → Transcribe (animated progress with stages) → Speaker Tagging (voice samples, name assignment, quick-assign from known speakers) → Details (title, folder, tags, preview)
4. **Device Manager** — device status card (storage bar), file table with checkboxes, bulk transfer/delete, per-file status
5. **Settings** — sections: Device (auto-transfer, save location), AI Processing (model picker, speaker detection, language), Integrations (Google Calendar, Slack, Notion placeholders), Notifications
6. **Search Modal** — ⌘K trigger, search across meetings/transcripts/tags
7. **Dark/Light Theme** — toggle in sidebar, MP250 palette for both modes

---

## Phase 1: Rename + Data Model Expansion

### 1A. Rename Dock Notes → FieldNote

Files to update:
- `src-tauri/Cargo.toml` — package name
- `src-tauri/tauri.conf.json` — productName, identifier, window title
- `src/lib/db/index.ts` — DB_PATH from "dock-notes.db" to "fieldnote.db"
- `src/components/Layout.tsx` — branding text
- `CLAUDE.md` — project name references
- `package.json` — name field

### 1B. Expand Database Schema

The mockup introduces: speakers, action items, key decisions, sentiment, and richer meeting metadata. Add migration tables:

```sql
-- Speaker registry (persists across meetings for quick-assign)
CREATE TABLE IF NOT EXISTS speakers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Action items (extracted from summaries or manually added)
CREATE TABLE IF NOT EXISTS action_items (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  text TEXT NOT NULL,
  assignee TEXT,
  done INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

-- Key decisions
CREATE TABLE IF NOT EXISTS key_decisions (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);
```

Add columns to `notes`:
```sql
ALTER TABLE notes ADD COLUMN sentiment_positive INTEGER;
ALTER TABLE notes ADD COLUMN sentiment_neutral INTEGER;
ALTER TABLE notes ADD COLUMN sentiment_negative INTEGER;
```

Update `src/types/index.ts`:

```typescript
export interface Speaker {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface ActionItem {
  id: string;
  noteId: string;
  text: string;
  assignee: string | null;
  done: boolean;
  createdAt: number;
}

export interface KeyDecision {
  id: string;
  noteId: string;
  text: string;
  createdAt: number;
}

export interface Sentiment {
  positive: number;
  neutral: number;
  negative: number;
}
```

Extend `Note` interface with `sentiment?: Sentiment`.

Add CRUD functions in `src/lib/db/index.ts` for speakers, action_items, key_decisions.

Handle migration gracefully: use `ALTER TABLE IF NOT EXISTS`-style checks or a migration version table.

---

## Phase 2: Theme System + Layout

### 2A. MP250 Theme Tokens

Create `src/lib/theme.ts` with the exact color tokens from the mockup:

```typescript
// MP250 Palette
// Bauhaus Tan #CCC4AE | Konkikyo Blue #191F45 | Funky Monkey #AD4E1A
// Bunny Hop #F3ECEA | Angel Falls #A3BDD3 | Blueberry Twist #24547D

export const lightTheme = {
  bg: "#F3ECEA",      // Bunny Hop — main background
  bgSb: "#191F45",    // Konkikyo Blue — sidebar
  bgC: "#ffffff",      // card backgrounds
  bgH: "#efe8e4",     // hover state
  bgA: "#E6DDD6",     // active/muted background
  bgI: "#ffffff",      // input fields
  tx: "#191F45",       // primary text (Konkikyo Blue)
  tx2: "#586178",      // secondary text
  txM: "#8b8f9e",      // muted text
  txS: "#A3BDD3",      // sidebar text (Angel Falls)
  txSA: "#ffffff",     // sidebar active text
  bd: "#d9cfC5",       // border
  bdL: "#ebe4dd",      // light border
  ac: "#AD4E1A",       // accent (Funky Monkey)
  acH: "#933f12",      // accent hover
  acL: "#faeee5",      // accent light bg
  acT: "#ffffff",      // accent text (on accent bg)
  lk: "#24547D",       // link color (Blueberry Twist)
  lkL: "#dae8f3",      // link light bg
  sec: "#A3BDD3",      // secondary (Angel Falls)
  secL: "#e4eef5",     // secondary light bg
  tan: "#CCC4AE",      // Bauhaus Tan
  tanL: "#e2ddd2",     // tan light bg
  ok: "#3d7a4a",       // success
  okL: "#e2f2e6",      // success light
  warn: "#AD4E1A",     // warning
  warnL: "#faeee5",    // warning light
  err: "#b83a3a",      // error
  errL: "#fce4e4",     // error light
  sh: "0 1px 3px rgba(25,31,69,0.06),0 1px 2px rgba(25,31,69,0.04)",
  shL: "0 4px 12px rgba(25,31,69,0.08)",
};

export const darkTheme = {
  bg: "#141517",
  bgSb: "#0e0f12",
  bgC: "#1c1d21",
  bgH: "#252629",
  bgA: "#2a2b30",
  bgI: "#1c1d21",
  tx: "#F3ECEA",
  tx2: "#b5ada5",
  txM: "#706b65",
  txS: "#8a8379",
  txSA: "#F3ECEA",
  bd: "#2e2f34",
  bdL: "#232427",
  ac: "#D4693A",
  acH: "#c05a2d",
  acL: "#2d201a",
  acT: "#ffffff",
  lk: "#8bb8d6",
  lkL: "#1a2530",
  sec: "#8bb8d6",
  secL: "#1a2530",
  tan: "#CCC4AE",
  tanL: "#2a2824",
  ok: "#6dbd7a",
  okL: "#1a261c",
  warn: "#D4693A",
  warnL: "#2d201a",
  err: "#e06060",
  errL: "#2d1a1a",
  sh: "0 1px 3px rgba(0,0,0,0.4),0 0 0 1px rgba(255,255,255,0.03)",
  shL: "0 8px 24px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.03)",
};
```

Speaker voice colors palette:
```typescript
export const VOICE_COLORS = [
  "#AD4E1A", "#24547D", "#A3BDD3", "#8B6D3F",
  "#6dbd7a", "#D4693A", "#CCC4AE", "#b83a3a"
];
```

### 2B. Theme Context

Create `src/stores/themeStore.ts` — Zustand store with `dark: boolean` and `toggle()`. Persist to tauri-plugin-store.

### 2C. Sidebar Layout (Notion-style)

Rewrite `src/components/Layout.tsx`:
- 230px fixed sidebar with Konkikyo Blue background (light) or `#0e0f12` (dark)
- FieldNote logo + "Hidock P1 Edition" subtitle at top
- Search bar (⌘K) below logo
- Nav items: Meetings, Device, Settings — with active highlight
- Bottom section: device status indicator (green dot + "Hidock P1" + USB icon)
- Dark/light mode toggle at very bottom
- Main content area: scrollable, max-width 960px centered, 24px 32px padding

### 2D. Page Header

Each page gets a header row with:
- Page title (24px, 700 weight)
- Right-aligned action button ("Import Recording" on dashboard)

---

## Phase 3: Dashboard (Meetings List)

Replace `src/pages/NotesPage.tsx` → `src/pages/DashboardPage.tsx`

### 3A. Stats Cards Row

4-column grid at top:
- Total Meetings (mic icon, accent color)
- Recorded Hours (clock icon, link color)
- Action Items (check icon, ok color)
- Pending (clock icon, warn color)

Calculate from DB on load.

### 3B. Folder + Tag Filters

- Folder tabs: "All", plus folders from notes. Style: pill buttons, accent bg when active.
- Tag chips: pulled from all notes' tags. Toggle filter. Link-colored border when active.

### 3C. Meeting Cards

Each card shows:
- Title (15px, 600 weight)
- Metadata row: relative date, duration, speaker count with icon
- Tags (right-aligned, tan background pills)
- Summary preview (2-line clamp)
- Bottom row: speaker avatar stack (overlapping circles with initials + speaker color) and action item progress (done/total)
- Hover: accent border + elevated shadow

Click → navigate to meeting detail.

### 3D. Empty State

"No meetings match your filters." centered text when list is empty.

---

## Phase 4: Import Wizard

Create `src/components/ImportWizard.tsx` — modal overlay (fixed, centered, backdrop blur).

### 4A. Modal Shell

- 660px wide, max 88vh height
- Header: "Import Recording" title + X close + step indicator (4 circles with labels: Source → Transcribe → Speakers → Details)
- Footer: context-dependent buttons (Cancel/Upload/Transfer/Start Transcription/Skip/Continue/Save)

### 4B. Step 1 — Source Selection

Initial state: two cards side by side:
- **Upload File** — upload icon, "From your computer", accepted formats list. Click → switch to drag-drop zone.
- **From Hidock P1** — USB icon, "Transfer from device via USB", green "Connected" dot + recording count. Click → switch to device file list.

Upload mode:
- Drag-drop zone with file validation (extension check, 500MB limit)
- File list with progress bars, error states, uploaded checkmarks
- "Upload Files" button triggers simulated/real upload

Device mode:
- Device status bar (icon, name, recording count)
- Select-all checkbox + file list with checkboxes
- Each file: waveform icon, filename, size, duration, relative date
- "Transfer from Device" button → transfer progress bar → "transferred" confirmation
- Transfer complete → enable "Start Transcription"

### 4C. Step 2 — Transcription Progress

- Animated waveform visualization (24 bars)
- Stage labels cycling through: "Analyzing audio waveform...", "Detecting voice activity...", "Running speech-to-text...", "Identifying speaker segments...", "Generating AI summary...", "Extracting action items..."
- Overall progress bar
- Sub-task checklist: Speech-to-text, Speaker diarization, AI summarization, Action item extraction, Sentiment analysis — each with own progress indicator

**Real implementation**: Call `convert_hda_to_mp3` → Whisper API → LLM summary (extract action items + decisions + sentiment in structured JSON). Update progress via state.

### 4D. Step 3 — Speaker Tagging

For each detected voice:
- Avatar circle with color + speaker label
- Segment count + total duration
- "Sample" button → plays audio snippet, shows sample text quote + mini waveform
- Name input field
- Quick-assign chips from known speakers in DB
- Green border when named

Footer: "{N}/{total} voices identified — unnamed voices will appear as Speaker N"

### 4E. Step 4 — Meeting Details

Form fields:
- Meeting Title (text input, placeholder "e.g. Quarterly Planning Session")
- Folder (dropdown from existing folders)
- Tags (comma-separated text input)
- Preview section: speaker avatars, file count, folder, tag count

"Save Meeting" button → writes to DB, closes wizard, refreshes dashboard.

---

## Phase 5: Meeting Detail Page

Replace `src/pages/NoteDetailPage.tsx` → `src/pages/MeetingDetailPage.tsx`

### 5A. Header Section

- Back button ("← Back" link)
- Title (22px, 700 weight)
- Metadata row: full date, duration, folder pill, tag pills
- Speaker row: avatar + name for each speaker
- Sentiment bar: green (positive) + tan (neutral) + red (negative) stacked horizontal bar with percentages

### 5B. Export Buttons

Row of 3 buttons: PDF, Markdown, Notion — each with export icon. Wire up later; just render the buttons for now.

### 5C. Tab Bar

4 tabs: Transcript | Summary | Action Items | Decisions. Accent underline on active tab.

### 5D. Transcript Tab

- Each line: timestamp (tabular-nums) | speaker color bar (3px) | speaker name (colored) + text
- Click a line → seek audio player to that timestamp
- Active line (matching current playback time) gets accent-light background
- Hover highlights with bgH color

### 5E. Summary Tab

- Card with AI sparkle icon + "AI Summary" label
- Summary text in paragraph form (14px, 1.65 line height)

### 5F. Action Items Tab

- Each item: checkbox (green when done, border when not) + text + assignee
- Done items: line-through + reduced opacity
- Click checkbox to toggle done state → update DB

### 5G. Key Decisions Tab

- Each decision: numbered circle (link color bg) + text
- Simple list layout

### 5H. Audio Player

- Fixed at bottom of transcript tab only
- Play/pause button (accent circle), time display, scrubber bar with thumb, duration
- Wire to actual audio file playback using HTML5 Audio API

---

## Phase 6: Device Manager + Settings + Search

### 6A. Device Manager

Rewrite `src/pages/DevicePage.tsx`:
- Device status card: icon, "Hidock P1 Device", connection status, storage bar (used / 512 MB)
- Bulk action bar: appears when files selected — "{N} selected" + Transfer + Delete buttons
- File table: checkbox | filename with icon | size | date | duration | status column
- Status: "Processed" (green, clickable → goes to meeting), "Transfer" button, "Transferring..." state
- Wire to existing USB commands: `usb_connect_and_scan`, `usb_download_and_save`, `usb_delete_file`

### 6B. Settings

Rewrite `src/pages/SettingsPage.tsx`:
- Section cards with rounded corners + shadow
- **Device section**: auto-transfer toggle, save location with "Change" button (file dialog)
- **AI Processing section**: model dropdown (Claude Sonnet 4, GPT-4o, Whisper Large v3), speaker detection toggle, language dropdown (English, Hindi, Spanish, Auto-detect), accepted formats info
- **Integrations section**: Google Calendar, Slack, Notion — each with "Connect" button (placeholders)
- **Notifications section**: desktop notifications toggle
- Custom toggle component matching mockup style (44x24px, accent color when on)

### 6C. Search Modal (⌘K)

Create `src/components/SearchModal.tsx`:
- Fixed overlay with backdrop blur
- 560px wide modal at 15vh from top
- Input with search icon + ESC kbd hint
- Search across: meeting titles, transcript text, tags, summaries
- Results list: grouped by type, each result shows meeting title + matched snippet
- Click result → navigate to meeting detail
- ESC or click outside → close

---

## Phase 7: AI Pipeline Enhancements

### 7A. Structured Summary Extraction

Update `src/lib/api/summarize.ts` to request structured JSON output from the LLM:

```typescript
interface MeetingSummaryResult {
  summary: string;
  actionItems: { text: string; assignee: string | null }[];
  keyDecisions: string[];
  sentiment: { positive: number; neutral: number; negative: number };
}
```

System prompt should instruct the LLM to extract all four components from the transcript.

### 7B. Speaker Diarization

This needs a diarization model (pyannote, or a service). For MVP:
- Use Whisper's speaker turn hints if available
- Or use a separate diarization API call
- Fall back to "Speaker 1", "Speaker 2" etc. if no diarization available

Store speaker assignments in transcriptions table (already has `speaker` column).

---

## Build Order (Recommended Sequence)

```
Phase 1A → 1B → 2A → 2B → 2C → 2D → 3A → 3B → 3C → 4A → 4B → 4C → 4D → 4E
→ 5A → 5B → 5C → 5D → 5E → 5F → 5G → 5H → 6A → 6B → 6C → 7A → 7B
```

Phases 1–2 are foundational. Phases 3–6 can be built in any order after that, but the recommended sequence minimizes rework. Phase 7 can be deferred — the UI should work with mock/placeholder data first.

---

## File Impact Summary

### New Files
- `src/lib/theme.ts` — theme tokens + types
- `src/stores/themeStore.ts` — dark mode state
- `src/pages/DashboardPage.tsx` — replaces NotesPage
- `src/pages/MeetingDetailPage.tsx` — replaces NoteDetailPage
- `src/components/ImportWizard.tsx` — import modal
- `src/components/SearchModal.tsx` — ⌘K search
- `src/components/SentimentBar.tsx` — reusable sentiment visualization
- `src/components/AudioPlayer.tsx` — playback controls
- `src/components/Toggle.tsx` — custom toggle switch

### Major Rewrites
- `src/components/Layout.tsx` — new sidebar layout
- `src/pages/DevicePage.tsx` — new device manager design
- `src/pages/SettingsPage.tsx` — new settings design
- `src/App.tsx` — new routing for renamed pages
- `src/types/index.ts` — extended types
- `src/lib/db/index.ts` — new tables + migration
- `src/stores/notesStore.ts` — support new data model

### Config Updates
- `src-tauri/Cargo.toml` — package name
- `src-tauri/tauri.conf.json` — app name, identifier
- `package.json` — name
- `CLAUDE.md` — updated context

### Files to Delete (replaced)
- `src/pages/NotesPage.tsx` → replaced by DashboardPage
- `src/pages/NoteDetailPage.tsx` → replaced by MeetingDetailPage

---

## Important Notes

1. **Don't use Tailwind classes for the theme colors.** The mockup uses inline styles with theme tokens. Follow this pattern: pass `t` (theme object) to components and reference `t.bg`, `t.ac`, etc. This matches the mockup exactly and makes the dark/light toggle work without CSS class swapping.

2. **Font**: `'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` — set on the root element.

3. **The sidebar is always Konkikyo Blue (`#191F45`) in light mode**, not the page background color. In dark mode it's `#0e0f12`.

4. **USB commands are already working.** Don't touch `src-tauri/src/usb.rs` or `src-tauri/src/commands.rs` unless adding new Rust commands. The existing commands are: `usb_connect_and_scan`, `usb_get_file`, `usb_download_and_save`, `usb_delete_file`, `compute_md5`, `save_recording`, `get_app_data_dir`, `convert_hda_to_mp3`.

5. **HiNotes cloud sync is optional.** Keep `src/lib/api/hinotes.ts` but don't make it prominent in the UI. The app is local-first.

6. **Accepted audio formats**: `.wav, .mp3, .m4a, .ogg, .flac, .webm, .aac, .mp4, .wma` — max 500MB per file.
