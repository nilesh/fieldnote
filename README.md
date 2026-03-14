# FieldNote

Desktop companion app for the **HiDock P1** voice recorder. Import recordings via USB, transcribe with Whisper, and generate AI-powered meeting summaries — all locally on your machine.

## Features

- **USB Import** — Automatically detects HiDock P1 devices and transfers recordings via the Jensen binary protocol
- **Transcription** — Speech-to-text powered by OpenAI Whisper with speaker detection
- **AI Summaries** — Generate meeting summaries, action items, and key decisions using GPT-4o or Claude
- **Local-first** — All data stored in a local SQLite database; nothing leaves your machine unless you choose to transcribe/summarize
- **Organize** — Folders, tags, and full-text search across transcripts and summaries

## Tech Stack

| Layer | Tech |
|---|---|
| Desktop shell | [Tauri v2](https://tauri.app) (Rust) |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS + shadcn/ui |
| State | Zustand |
| Local DB | SQLite via `tauri-plugin-sql` |
| USB | rusb / libusb (Jensen protocol) |

## Getting Started

### Prerequisites

- Node.js 18+
- Rust toolchain via [rustup](https://rustup.rs)
- `brew install libusb` (macOS)
- `xcode-select --install` (macOS)

### Development

```bash
git clone git@github.com:nilesh/fieldnote.git
cd fieldnote
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

### Type checking

```bash
npx tsc --noEmit            # frontend
cd src-tauri && cargo check  # backend
```

## Configuration

Open **Settings** in the app to configure:

- **OpenAI API key** — for Whisper transcription and GPT-4o summaries
- **Anthropic API key** — for Claude summaries
- **Default language** — or leave on auto-detect
- **Summary system prompt** — customise LLM instructions

All settings are stored locally via `tauri-plugin-store`.

## License

Private — all rights reserved.
