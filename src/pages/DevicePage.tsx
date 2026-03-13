import { useState, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Usb, RefreshCw, Download, CheckCircle2, AlertCircle, Plug, ArrowUp, ArrowDown } from "lucide-react";
import { useNotesStore } from "@/stores/notesStore";
import { getNoteBySignature } from "@/lib/db";
import { formatDuration, cn } from "@/lib/utils";
import type { NoteState } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UsbDeviceInfo {
  sn: string;
  model: string;
  versionCode: string;
  versionNumber: number;
}

interface UsbFileEntry {
  name: string;
  size: number;     // bytes on device
  signature: string; // MD5 hex from device
}

interface DisplayFile extends UsbFileEntry {
  durationMs: number;   // estimated from file size
  recordedAt: number;   // ms timestamp parsed from filename
  alreadyImported: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MONTH_MAP: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

/** Parse timestamp from filename like "2025Nov03-132512-Rec65.hda" or "20260309-141851-Rec25.hda" */
function parseRecordedAt(filename: string): number {
  // Text month format: 2025Nov03-132512
  const tm = filename.match(/^(\d{4})([A-Z][a-z]{2})(\d{2})-(\d{2})(\d{2})(\d{2})/);
  if (tm) {
    const [, y, mon, d, h, mi, s] = tm;
    const mo = MONTH_MAP[mon] ?? "01";
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`).getTime();
  }
  // Numeric format: 20260309-141851
  const nm = filename.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/);
  if (nm) {
    const [, y, mo, d, h, mi, s] = nm;
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`).getTime();
  }
  return Date.now();
}

/** Estimate duration in ms from .hda file size (4-channel OPUS at ~256kbps = 32 bytes/ms) */
function estimateDuration(size: number, filename: string): number {
  if (filename.toLowerCase().endsWith(".hda")) return Math.round((size / 32) * 4);
  if (filename.toLowerCase().endsWith(".wav")) return Math.round(size / 32);
  return 0;
}

type ImportStatus = "idle" | "importing" | "done" | "error";
type SortKey = "name" | "recordedAt" | "size" | "durationMs";
type SortDir = "asc" | "desc";

// ─── Component ────────────────────────────────────────────────────────────────

export default function DevicePage() {
  const { addNote } = useNotesStore();
  const location = useLocation();

  const [deviceInfo, setDeviceInfo] = useState<UsbDeviceInfo | null>(null);
  const [files, setFiles] = useState<DisplayFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<Record<string, ImportStatus>>({});
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("recordedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "recordedAt" ? "desc" : "asc");
    }
  };

  const sortedFiles = [...files].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    if (sortKey === "name") return mul * a.name.localeCompare(b.name);
    return mul * ((a[sortKey] ?? 0) - (b[sortKey] ?? 0));
  });

  // ── Connect & scan ──────────────────────────────────────────────────────────
  const handleConnect = useCallback(async () => {
    setError(null);
    setScanning(true);
    setFiles([]);
    setSelected(new Set());
    setImportResults({});
    setDeviceInfo(null);

    try {
      // Single USB session: connect, get info, and list files
      const [info, rawFiles] = await invoke<[UsbDeviceInfo, UsbFileEntry[]]>("usb_connect_and_scan");
      setDeviceInfo(info);

      const displayFiles: DisplayFile[] = await Promise.all(
        rawFiles.map(async (f) => {
          const existing = await getNoteBySignature(f.signature).catch(() => null);
          return {
            ...f,
            durationMs: estimateDuration(f.size, f.name),
            recordedAt: parseRecordedAt(f.name),
            alreadyImported: !!existing,
          };
        })
      );

      setFiles(displayFiles);
      setError(null); // clear any stale error from prior attempts

      setSelected(new Set());
    } catch (err) {
      setError(String(err));
    } finally {
      setScanning(false);
    }
  }, []);

  // Auto-connect when navigated from Notes page
  useEffect(() => {
    if ((location.state as any)?.autoConnect && !deviceInfo && !scanning) {
      handleConnect();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => handleConnect();

  // ── Selection helpers ───────────────────────────────────────────────────────
  const toggleFile = (name: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });

  const selectNew = () =>
    setSelected(new Set(files.filter((f) => !f.alreadyImported).map((f) => f.name)));
  const selectAll = () => setSelected(new Set(files.map((f) => f.name)));
  const clearAll  = () => setSelected(new Set());

  // ── Import ──────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);

    const toImport = files.filter((f) => selected.has(f.name));

    for (const file of toImport) {
      setImportResults((prev) => ({ ...prev, [file.name]: "importing" }));
      try {
        // 1. Check by device-provided MD5 — skip if already imported
        const existing = await getNoteBySignature(file.signature).catch(() => null);
        if (existing) {
          setImportResults((prev) => ({ ...prev, [file.name]: "done" }));
          continue;
        }

        // 2. Download from device and save to disk in one backend call
        //    (avoids serializing large byte arrays over IPC)
        const savedPath: string = await invoke("usb_download_and_save", {
          name: file.name,
          length: file.size,
        });

        // 3. Insert into DB via store (handles both DB + Zustand)
        await addNote({
          filename: file.name,
          filePath: savedPath,
          signature: file.signature,
          title: file.name.replace(/\.(hda|wav)$/i, ""),
          durationMs: file.durationMs,
          createdAt: Date.now(),
          recordedAt: file.recordedAt,
          language: null,
          state: "imported" as NoteState,
          hinotesId: null,
          folderId: null,
          tags: [],
        });

        setImportResults((prev) => ({ ...prev, [file.name]: "done" }));
      } catch (err) {
        console.error("Import failed for", file.name, err);
        setImportResults((prev) => ({ ...prev, [file.name]: "error" }));
      }
    }

    setImporting(false);
    // Refresh to reflect imported status
    if (deviceInfo) await handleConnect();
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const selectedCount = selected.size;
  const newCount = files.filter((f) => !f.alreadyImported).length;
  const connected = deviceInfo !== null;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Usb className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Device</h1>

        {connected && (
          <>
            <span className="ml-1 text-sm text-muted-foreground">
              {deviceInfo.model} · {deviceInfo.sn} · fw {deviceInfo.versionCode}
            </span>
            <button
              onClick={handleRefresh}
              disabled={scanning}
              className="ml-auto rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-40"
              title="Refresh"
            >
              <RefreshCw className={cn("h-4 w-4", scanning && "animate-spin")} />
            </button>
          </>
        )}

        {!connected && (
          <button
            onClick={handleConnect}
            disabled={scanning}
            className="ml-auto flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Plug className="h-4 w-4" />
            {scanning ? "Connecting…" : "Connect device"}
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 flex items-start gap-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Connection failed</p>
            <p className="mt-0.5 text-xs font-mono opacity-80">{error}</p>
            <p className="mt-1 text-xs opacity-70">
              Make sure HiDock P1 is connected via USB and the HiNotes app is closed.
            </p>
          </div>
        </div>
      )}

      {/* Not connected */}
      {!connected && !scanning && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-full bg-secondary p-5">
            <Usb className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">No device connected</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect your HiDock P1 via USB, then click Connect.
              <br />
              Close the HiNotes app first if it's open.
            </p>
          </div>
          <button
            onClick={handleConnect}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plug className="h-4 w-4" />
            Connect device
          </button>
        </div>
      )}

      {/* Scanning spinner */}
      {scanning && !connected && (
        <div className="flex flex-1 items-center justify-center">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* File list */}
      {connected && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Toolbar */}
          {files.length > 0 && (
            <div className="flex items-center gap-3 border-b border-border px-6 py-2">
              <span className="text-sm text-muted-foreground">
                {files.length} recording{files.length !== 1 ? "s" : ""} — {newCount} new
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={selectNew} className="text-xs text-primary hover:underline">
                  Select new
                </button>
                <span className="text-muted-foreground">·</span>
                <button onClick={selectAll} className="text-xs text-primary hover:underline">
                  All
                </button>
                <span className="text-muted-foreground">·</span>
                <button onClick={clearAll} className="text-xs text-primary hover:underline">
                  None
                </button>
              </div>
              <button
                onClick={handleImport}
                disabled={selectedCount === 0 || importing}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
              >
                <Download className="h-4 w-4" />
                {importing
                  ? "Importing…"
                  : `Import${selectedCount > 0 ? ` ${selectedCount}` : ""}`}
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {scanning ? (
              <div className="flex h-full items-center justify-center">
                <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : files.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <p className="font-medium">No recordings found</p>
                <p className="text-sm text-muted-foreground">
                  The device is connected but has no recordings.
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 border-b border-border bg-background">
                  <tr className="text-left text-xs font-medium text-muted-foreground">
                    <th className="w-10 px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedCount === files.length && files.length > 0}
                        onChange={(e) => (e.target.checked ? selectAll() : clearAll())}
                        className="accent-primary"
                      />
                    </th>
                    <th className="py-2 pr-4">
                      <button onClick={() => toggleSort("name")} className="inline-flex items-center gap-1 hover:text-foreground">
                        Filename
                        {sortKey === "name" && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="py-2 pr-4">
                      <button onClick={() => toggleSort("recordedAt")} className="inline-flex items-center gap-1 hover:text-foreground">
                        Recorded
                        {sortKey === "recordedAt" && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="py-2 pr-4">
                      <button onClick={() => toggleSort("size")} className="inline-flex items-center gap-1 hover:text-foreground">
                        Size
                        {sortKey === "size" && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="py-2 pr-4">
                      <button onClick={() => toggleSort("durationMs")} className="inline-flex items-center gap-1 hover:text-foreground">
                        Duration
                        {sortKey === "durationMs" && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                      </button>
                    </th>
                    <th className="py-2 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sortedFiles.map((file) => {
                    const importStatus = importResults[file.name];
                    const isDone = importStatus === "done" || file.alreadyImported;
                    return (
                      <tr
                        key={file.name}
                        className={cn(
                          "transition-colors hover:bg-secondary/50",
                          selected.has(file.name) && "bg-accent/30"
                        )}
                        onClick={() => !isDone && toggleFile(file.name)}
                      >
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={selected.has(file.name)}
                            disabled={isDone}
                            onChange={() => toggleFile(file.name)}
                            onClick={(e) => e.stopPropagation()}
                            className="accent-primary"
                          />
                        </td>
                        <td className="py-2.5 pr-4 font-mono text-xs">{file.name}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground">
                          {new Date(file.recordedAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground tabular-nums">
                          {file.size ? formatFileSize(file.size) : "—"}
                        </td>
                        <td className="py-2.5 pr-4 text-muted-foreground tabular-nums">
                          {file.durationMs ? formatDuration(file.durationMs) : "—"}
                        </td>
                        <td className="py-2.5 pr-4">
                          {importStatus === "importing" ? (
                            <span className="flex items-center gap-1 text-xs text-primary">
                              <RefreshCw className="h-3 w-3 animate-spin" /> Importing…
                            </span>
                          ) : isDone ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" /> Imported
                            </span>
                          ) : importStatus === "error" ? (
                            <span className="flex items-center gap-1 text-xs text-destructive">
                              <AlertCircle className="h-3 w-3" /> Error
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">New</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
