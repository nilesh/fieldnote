# Dock Notes — Development Context

## What This Is
Local-first Tauri v2 + React desktop app for the **HiDock P1** voice recorder. Imports recordings from the device via USB, stores them locally, and manages transcription/summarization.

## Architecture
- **Frontend**: React + TypeScript + Tailwind + shadcn/ui, Vite bundler
- **Backend**: Tauri v2, Rust, SQLite (via tauri-plugin-sql)
- **USB**: Custom binary protocol ("Jensen protocol") reverse-engineered from HiNotes web app

## Jensen USB Protocol
Reverse-engineered from `https://hinotes.hidock.com/chunks/jensen.0f31d61a.js` (3.9MB JS bundle). Internal name is "Jensen".

### Wire Format
Both directions use the same packet structure:
```
[0x12, 0x34]          2 bytes  magic
[cmd_hi, cmd_lo]      2 bytes  command ID (big-endian u16)
[s3,s2,s1,s0]         4 bytes  sequence number (big-endian u32)
[l3,l2,l1,l0]         4 bytes  high byte = padding count, low 3 bytes = body length
[...body]             N bytes  payload
[...padding]          P bytes  (P = high byte of length field)
```

### USB Setup (from WebUSB JS)
1. `selectConfiguration(1)`
2. `claimInterface(0)`
3. `selectAlternateInterface(0, 0)`
- Bulk OUT endpoint: 0x01
- Bulk IN endpoint: 0x82

### Command IDs
- QUERY_DEVICE_INFO = 1
- QUERY_FILE_LIST = 4
- TRANSFER_FILE = 5
- QUERY_FILE_COUNT = 6
- DELETE_FILE = 7
- GET_FILE_BLOCK = 13
- FACTORY_RESET = 61451
- GET_BATTERY_STATUS = 4100

### Device Info Response
- Bytes 0-3: u32 BE version number (display as bytes[1].bytes[2].bytes[3])
- Bytes 4-19: serial number ASCII (null-terminated)

### File List Response
Multi-packet: device sends multiple packets for CMD 4; empty body = end.
Optional 0xFF 0xFF header + 4-byte count at start.
Per file: 1 byte version + 3 bytes name_len + N bytes filename + 4 bytes size + 6 bytes unknown + 16 bytes MD5.

### Known VIDs/PIDs
- VID 0x10D6: PIDs 0xB00C (H1), 0xB00D (H1E), 0xB00E (P1), 0xB00F (P1 Mini)
- VID 0x388F: PIDs 0x0100-0x0103, 0x0240

## Current USB Issue (ACTIVE BUG)
On macOS 15 (Sequoia), `accessoryd` (MFi authenticator daemon) holds the USB device.
- `ioreg` shows `"iAPAuthenticator" = "pid 61532, accessoryd"` on the HiDock_P1 node
- `nusb` crate uses `IOUSBDeviceOpen()` — fails with exclusive access error
- Switched to `rusb` (libusb) which uses `IOUSBDeviceOpenSeize()` — STILL failing
- Need to determine: does the error come from `open()` or `claim_interface()`?
- Error messages now tagged with `USB_OPEN_FAILED` / `USB_CLAIM_FAILED` / `USB_ALT_FAILED` for diagnosis

### Possible next steps
1. If `open()` succeeds but `claim_interface(0)` fails: try interface 1 or 2 instead (iAP may be on 0)
2. If `open()` fails: may need to go lower-level with IOKit FFI, or find a way to tell accessoryd to release
3. Consider listing the device's configuration descriptor to see which interfaces and endpoints exist
4. Try `handle.reset()` after open and before claim
5. Check if a different libusb version / build fixes the macOS 15 issue

### Useful debug command
```bash
ioreg -p IOUSB -l -n "HiDock*"
system_profiler SPUSBDataType | grep -A20 "HiDock"
```

## Key Files
- `src-tauri/src/usb.rs` — Jensen protocol implementation (rusb-based, synchronous)
- `src-tauri/src/commands.rs` — Tauri commands (USB ops wrapped in spawn_blocking)
- `src-tauri/src/lib.rs` — Tauri app setup, command registration
- `src-tauri/entitlements.plist` — macOS USB entitlement
- `src/pages/DevicePage.tsx` — Device connection UI, file listing, import flow
- `src/pages/SettingsPage.tsx` — App settings
- `src/lib/db.ts` — SQLite database operations
- `src/stores/notesStore.ts` — Zustand store for notes

## Build
```bash
npm run tauri dev     # development
npm run tauri build   # production
npx tsc --noEmit      # typecheck frontend
cargo check           # typecheck backend (run from src-tauri/)
```

## Dependencies
- Rust: rusb 0.9, md5 0.7, serde, tokio, tauri 2
- System: `brew install libusb` (for rusb)
- Node: React 18, Tailwind, Vite
