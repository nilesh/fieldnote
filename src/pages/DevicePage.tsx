import { useState, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { readDir, readFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { Usb, FolderOpen, RefreshCw, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { useNotesStore } from "@/stores/notesStore";
import { insertNote, getNoteBySignature } from "@/lib/db";
import { parseHdaFilename, formatDuration, cn } from "@/lib/utils";
import type { DeviceFile, Note, NoteState } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocalDeviceFile extends DeviceFile {
  fullPath: string;
}

type ImportStatus = "idle" | "importing" | "done" | "error";

// ─── Component ────────────────────────────────────────────────────────────────

export default function DevicePage() {
  const { addNote } = useNotesStore();

  const [devicePath, setDevicePath] = useState<string | null>(null);
  const [files, setFiles] = useState<LocalDeviceFile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scanning, setScanning] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<Record<string, ImportStatus>>({});
  const [error, setError] = useState<string | null>(null);

  // ── Open folder picker ──────────────────────────────────────────────────────
  const handleSelectFolder = async () => {
    setError(null);
    const chosen = await open({ directory: true, multiple: false, title: "Select HiDock device folder" });
    if (!chosen || Array.isArray(chosen)) return;
    setDevicePath(chosen);
    await scanFolder(chosen);
  };

  // ── Scan selected folder for .hda files ────────────────────────────────────
  const scanFolder = useCallback(async (folderPath: string) => {
    setScanning(true);
    setFiles([]);
    setSelected(new Set());
    setImportResults({});
    setError(null);
    try {
      const entries = await readDir(folderPath);
      const hdaEntries = entries.filter(
        (e) => e.name && e.name.toLowerCase().endsWith(".hda")
      );

      const deviceFiles: LocalDeviceFile[] = await Promise.all(
        hdaEntries.map(async (entry) => {
          const fullPath = `${folderPath}/${entry.name!}`;
          const parsed = parseHdaFilename(entry.name!);
          // Use filename as a cheap proxy for dedup check during scan;
          // real MD5 is computed only on import.
          const existing = await getNoteBySignature(entry.name!).catch(() => null);
          return {
            name: entry.name!,
            fullPath,
            size: 0,
            signature: entry.name!,
            durationMs: parsed?.durationMs ?? 0,
            recordedAt: parsed?.recordedAt ?? Date.now(),
            alreadyImported: !!existing,
          } satisfies LocalDeviceFile;
        })
      );

      deviceFiles.sort((a, b) => b.recordedAt - a.recordedAt);
      setFiles(deviceFiles);

      // Auto-select files not yet imported
      const newFiles = deviceFiles.filter((f) => !f.alreadyImported).map((f) => f.name);
      setSelected(new Set(newFiles));
    } catch (err) {
      setError(`Failed to read folder: ${err}`);
    } finally {
      setScanning(false);
    }
  }, []);

  const handleRefresh = () => devicePath && scanFolder(devicePath);

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
  const clearAll = () => setSelected(new Set());

  // ── Import ──────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);

    const toImport = files.filter((f) => selected.has(f.name));

    for (const file of toImport) {
      setImportResults((prev) => ({ ...prev, [file.name]: "importing" }));
      try {
        // 1. Read raw bytes
        const data = await readFile(file.fullPath);

        // 2. Compute MD5 for dedup
        const signature: string = await invoke("compute_md5", { data: Array.from(data) });

        // 3. Check by real MD5 — skip if already imported
        const existing = await getNoteBySignature(signature).catch(() => null);
        if (existing) {
          setImportResults((prev) => ({ ...prev, [file.name]: "done" }));
          continue;
        }

        // 4. Save to app data dir
        const savedPath: string = await invoke("save_recording", {
          filename: file.name,
          data: Array.from(data),
        });

        // 5. Parse filename metadata
        const parsed = parseHdaFilename(file.name);

        // 6. Insert into DB
        const note: Note = {
          id: crypto.randomUUID(),
          filename: file.name,
          filePath: savedPath,
          signature,
          title: parsed?.title ?? file.name.replace(".hda", ""),
          durationMs: parsed?.durationMs ?? 0,
          createdAt: Date.now(),
          recordedAt: parsed?.recordedAt ?? Date.now(),
          language: null,
          state: "imported" as NoteState,
          hinotesId: null,
          folderId: null,
          tags: [],
        };

        await insertNote(note);
        addNote(note);

        setImportResults((prev) => ({ ...prev, [file.name]: "done" }));
      } catch (err) {
        console.error("Import failed for", file.name, err);
        setImportResults((prev) => ({ ...prev, [file.name]: "error" }));
      }
    }

    setImporting(false);
    if (devicePath) await scanFolder(devicePath);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const selectedCount = selected.size;
  const newCount = files.filter((f) => !f.alreadyImported).length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <Usb className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Device</h1>

        {devicePath && (
          <>
            <span
              className="ml-1 max-w-xs truncate text-sm text-muted-foreground"
              title={devicePath}
            >
              {devicePath}
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

        {!devicePath && (
          <button
            onClick={handleSelectFolder}
            className="ml-auto flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <FolderOpen className="h-4 w-4" />
            Select device folder
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-6 mt-4 flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Not connected */}
      {!devicePath && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <div className="rounded-full bg-secondary p-5">
            <Usb className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">No device selected</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect your HiDock P1 via USB — it mounts as a drive in Finder.
              <br />
              Then select its folder (usually under{" "}
              <code className="rounded bg-secondary px-1">/Volumes/</code>).
            </p>
          </div>
          <button
            onClick={handleSelectFolder}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <FolderOpen className="h-4 w-4" />
            Select device folder
          </button>
        </div>
      )}

      {/* File list */}
      {devicePath && (
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
                  No <code>.hda</code> files in that folder. Make sure you selected
                  the right drive.
                </p>
                <button
                  onClick={handleSelectFolder}
                  className="mt-2 text-sm text-primary hover:underline"
                >
                  Choose a different folder
                </button>
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
                    <th className="py-2 pr-4">Filename</th>
                    <th className="py-2 pr-4">Recorded</th>
                    <th className="py-2 pr-4">Duration</th>
                    <th className="py-2 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {files.map((file) => {
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
                        <td className="py-2.5 pr-4 text-muted-foreground">
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
