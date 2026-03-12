import { useState } from "react";
import { Usb, RefreshCw, Download, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { useNotesStore } from "@/stores/notesStore";
import { cn, formatDuration, parseHdaFilename } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";
import type { DeviceFile, Note } from "@/types";

// HiDock P1 USB identifiers
const HIDOCK_VENDOR_ID = 0x33C3;   // Update with actual VID from device
const HIDOCK_PRODUCT_ID = 0x0001;  // Update with actual PID from device

export default function DevicePage() {
  const addNote = useNotesStore((s) => s.addNote);
  const notes = useNotesStore((s) => s.notes);

  const [device, setDevice] = useState<USBDevice | null>(null);
  const [files, setFiles] = useState<DeviceFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [connecting, setConnecting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  const existingSignatures = new Set(notes.map((n) => n.signature));

  const connectDevice = async () => {
    setError(null);
    setConnecting(true);
    try {
      const dev = await navigator.usb.requestDevice({
        filters: [{ vendorId: HIDOCK_VENDOR_ID }],
      });
      await dev.open();
      setDevice(dev);
      await scanFiles(dev);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "NotFoundError") {
        setError(String(e));
      }
    } finally {
      setConnecting(false);
    }
  };

  const scanFiles = async (dev: USBDevice) => {
    setScanning(true);
    setError(null);
    try {
      // Read directory listing from device
      // NOTE: The exact USB protocol for HiDock P1 needs to be reverse-engineered.
      // The device likely uses USB Mass Storage (MSC) or a custom protocol.
      // For now this is a placeholder that reads using MTP-like commands.
      const discovered = await readDeviceFiles(dev);
      // Mark already imported files
      const withStatus = discovered.map((f) => ({
        ...f,
        alreadyImported: f.signature ? existingSignatures.has(f.signature) : false,
      }));
      setFiles(withStatus);
    } catch (e) {
      setError(`Failed to scan device: ${e}`);
    } finally {
      setScanning(false);
    }
  };

  const toggleSelect = (filename: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  };

  const selectAll = () => {
    const importable = files.filter((f) => !f.alreadyImported).map((f) => f.name);
    setSelected(new Set(importable));
  };

  const importSelected = async () => {
    if (!device) return;
    setImportedCount(0);
    for (const filename of selected) {
      const file = files.find((f) => f.name === filename);
      if (!file) continue;
      setImporting(filename);
      try {
        const data = await readFileFromDevice(device, filename);
        const signature: string = await invoke("compute_md5", { data: Array.from(data) });
        const savedPath: string = await invoke("save_recording", {
          filename,
          data: Array.from(data),
        });
        const recordedAt = parseHdaFilename(filename)?.getTime() ?? null;
        await addNote({
          filename,
          filePath: savedPath,
          signature,
          title: null,
          durationMs: file.durationMs,
          createdAt: Date.now(),
          recordedAt,
          language: null,
          state: "imported",
          hinotesId: null,
          folderId: null,
          tags: [],
        });
        setImportedCount((c) => c + 1);
        setFiles((prev) =>
          prev.map((f) => (f.name === filename ? { ...f, alreadyImported: true } : f))
        );
      } catch (e) {
        setError(`Failed to import ${filename}: ${e}`);
      }
    }
    setImporting(null);
    setSelected(new Set());
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold">Device</h1>
        {device && (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
            Connected
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {device && (
            <button
              onClick={() => scanFiles(device)}
              disabled={scanning}
              className="flex items-center gap-1.5 rounded-md bg-secondary px-3 py-1.5 text-sm hover:bg-secondary/80 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-4 w-4", scanning && "animate-spin")} />
              Refresh
            </button>
          )}
          {!device && (
            <button
              onClick={connectDevice}
              disabled={connecting}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Usb className="h-4 w-4" />}
              Connect Device
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="border-b border-destructive/30 bg-destructive/10 px-6 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Content */}
      {!device ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <div className="rounded-full bg-secondary p-6">
            <Usb className="h-12 w-12 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-lg font-medium">No device connected</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect your HiDock P1 via USB, then click Connect Device
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Toolbar */}
          {files.length > 0 && (
            <div className="flex items-center gap-3 border-b border-border px-6 py-3">
              <button onClick={selectAll} className="text-sm text-primary hover:underline">
                Select new
              </button>
              <span className="text-xs text-muted-foreground">
                {selected.size} selected · {files.filter((f) => !f.alreadyImported).length} new
              </span>
              <div className="ml-auto">
                <button
                  onClick={importSelected}
                  disabled={selected.size === 0 || !!importing}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {importing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Import {selected.size > 0 ? `(${selected.size})` : ""}
                </button>
              </div>
            </div>
          )}

          {/* File list */}
          <div className="flex-1 overflow-y-auto">
            {scanning ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : files.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <p className="text-muted-foreground">No recordings found on device</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {files.map((file) => (
                  <FileRow
                    key={file.name}
                    file={file}
                    selected={selected.has(file.name)}
                    importing={importing === file.name}
                    onToggle={() => toggleSelect(file.name)}
                  />
                ))}
              </div>
            )}
          </div>

          {importedCount > 0 && (
            <div className="border-t border-border bg-green-50 px-6 py-2 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-300">
              {importedCount} recording{importedCount > 1 ? "s" : ""} imported successfully
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FileRow({
  file,
  selected,
  importing,
  onToggle,
}: {
  file: DeviceFile;
  selected: boolean;
  importing: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 px-6 py-3 transition-colors",
        !file.alreadyImported && "cursor-pointer hover:bg-secondary/40",
        selected && "bg-accent/50"
      )}
      onClick={() => !file.alreadyImported && onToggle()}
    >
      <div className="shrink-0">
        {importing ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : file.alreadyImported ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : (
          <div className={cn(
            "flex h-5 w-5 items-center justify-center rounded-full border-2",
            selected ? "border-primary bg-primary" : "border-border"
          )}>
            {selected && <div className="h-2 w-2 rounded-full bg-white" />}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium">{file.name}</p>
        {file.recordedAt && (
          <p className="text-xs text-muted-foreground">{file.recordedAt}</p>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {file.durationMs && <span>{formatDuration(file.durationMs)}</span>}
        {file.alreadyImported && (
          <span className="rounded-full bg-secondary px-2 py-0.5">Imported</span>
        )}
      </div>
    </div>
  );
}

// ─── Device USB protocol stubs ────────────────────────────────────────────────
// These need to be implemented based on HiDock P1's USB protocol.
// The device likely uses USB Mass Storage (UMS) class, which means
// we may be able to access it as a filesystem via the File System Access API
// or through Tauri's fs plugin once mounted.

async function readDeviceFiles(_dev: USBDevice): Promise<DeviceFile[]> {
  // TODO: Implement actual USB protocol
  // Option 1: If device uses Mass Storage, read as filesystem
  // Option 2: Use custom HiDock protocol commands
  // For now returns empty — actual implementation pending USB protocol discovery
  console.warn("USB file listing not yet implemented — needs protocol discovery");
  return [];
}

async function readFileFromDevice(_dev: USBDevice, _filename: string): Promise<Uint8Array> {
  // TODO: Implement actual file read via USB
  throw new Error("USB file reading not yet implemented");
}
