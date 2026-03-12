# Dock Notes

A local-first desktop app for managing, transcribing, and summarising recordings from the **HiDock P1** voice recorder.

Replaces the HiNotes companion web app with a native desktop experience — all recordings stored locally, processed with your own API keys.

---

## Features

- Import recordings from HiDock P1 via USB (WebUSB)
- Store `.hda` recordings locally (they're just MP3s)
- Transcribe with **OpenAI Whisper** using your own API key
- Summarise with **Claude** or **GPT-4o** using your own API keys
- Synced audio player — click any transcript segment to seek
- Optional: use **HiNotes cloud API** for processing instead
- Fully offline-capable after setup

---

## Tech stack

| Layer | Tech |
|---|---|
| Desktop shell | [Tauri v2](https://tauri.app) (Rust) |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| State | Zustand + TanStack Query |
| Local DB | SQLite via `tauri-plugin-sql` |
| Settings | `tauri-plugin-store` (JSON file) |

---

## Prerequisites

1. **Rust** — install via [rustup](https://rustup.rs):
   ```sh
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Node.js 18+** — install via [nvm](https://github.com/nvm-sh/nvm) or [brew](https://brew.sh):
   ```sh
   brew install node
   ```

3. **Tauri CLI prerequisites** (macOS):
   ```sh
   xcode-select --install
   ```

---

## Setup

```sh
# Clone
git clone <your-repo-url>
cd dock-notes

# Install JS dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

---

## Configuration

Open **Settings** in the app and fill in:

- **OpenAI API key** — for Whisper transcription (and optionally GPT-4o summarisation)
- **Anthropic API key** — for Claude summarisation
- **Default language** — leave blank for Whisper auto-detection
- **Summary system prompt** — customise how the LLM summarises your notes

All settings are stored locally in `~/.dock-notes/settings.json` (no cloud sync).

---

## USB / Device notes

The app uses the **WebUSB API** to communicate directly with the HiDock P1.

Current status:
- Connection and device detection: ✅
- File listing and import: 🚧 stub — USB protocol not yet implemented

The HiDock P1 likely exposes recordings via **USB Mass Storage** (UMS), which means files may also appear as a mounted drive in Finder once connected. As an interim workaround you can copy `.hda` files manually from the mounted drive — the app can't open them from the filesystem yet, but direct USB import is the planned path.

To find the real Vendor ID / Product ID, run while connected:
```sh
system_profiler SPUSBDataType | grep -A5 HiDock
```
Then update `HIDOCK_VENDOR_ID` / `HIDOCK_PRODUCT_ID` in `src/pages/DevicePage.tsx`.

---

## HiNotes API (optional)

If you want to use HiNotes cloud processing instead of your own keys:

1. Open [hinotes.hidock.com](https://hinotes.hidock.com) in Chrome
2. Open DevTools → Network
3. Log in and look for any request with an `AccessToken` header
4. Copy that token into Settings → HiNotes → Access Token

Note: the token expires — you may need to refresh it periodically.

---

## Project structure

```
dock-notes/
├── src/                      # React frontend
│   ├── pages/
│   │   ├── NotesPage.tsx     # Note library (grid + list views)
│   │   ├── NoteDetailPage.tsx# Transcript + summary + audio player
│   │   ├── DevicePage.tsx    # USB device connection & import
│   │   └── SettingsPage.tsx  # API keys & preferences
│   ├── lib/
│   │   ├── api/
│   │   │   ├── hinotes.ts    # HiNotes cloud API client
│   │   │   ├── transcribe.ts # OpenAI Whisper
│   │   │   └── summarize.ts  # Claude / GPT-4o
│   │   ├── db/               # SQLite helpers
│   │   └── utils.ts
│   ├── stores/
│   │   ├── notesStore.ts
│   │   └── settingsStore.ts
│   └── types/index.ts
└── src-tauri/                # Rust backend
    ├── src/
    │   ├── lib.rs            # Plugin registration + commands
    │   ├── commands.rs       # compute_md5, save_recording
    │   └── db.rs             # SQL schema
    └── tauri.conf.json
```
