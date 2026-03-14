import { useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import {
  Usb, RefreshCw, Download, CheckCircle2, AlertCircle,
  Plug, ArrowUp, ArrowDown, FileText, Trash2,
} from "lucide-react";
import { useNotesStore } from "@/stores/notesStore";
import { useThemeStore } from "@/stores/themeStore";
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
  size: number;
  signature: string;
}

interface DisplayFile extends UsbFileEntry {
  durationMs: number;
  recordedAt: number;
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

function parseRecordedAt(filename: string): number {
  const tm = filename.match(/^(\d{4})([A-Z][a-z]{2})(\d{2})-(\d{2})(\d{2})(\d{2})/);
  if (tm) {
    const [, y, mon, d, h, mi, s] = tm;
    const mo = MONTH_MAP[mon] ?? "01";
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`).getTime();
  }
  const nm = filename.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})/);
  if (nm) {
    const [, y, mo, d, h, mi, s] = nm;
    return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}`).getTime();
  }
  return Date.now();
}

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
  const { t } = useThemeStore();
  const location = useLocation();
  const navigate = useNavigate();

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
      setError(null);
      setSelected(new Set());
    } catch (err) {
      setError(String(err));
    } finally {
      setScanning(false);
    }
  }, []);

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
  const clearAll = () => setSelected(new Set());

  // ── Import ──────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);

    const toImport = files.filter((f) => selected.has(f.name));

    for (const file of toImport) {
      setImportResults((prev) => ({ ...prev, [file.name]: "importing" }));
      try {
        const existing = await getNoteBySignature(file.signature).catch(() => null);
        if (existing) {
          setImportResults((prev) => ({ ...prev, [file.name]: "done" }));
          continue;
        }

        const savedPath: string = await invoke("usb_download_and_save", {
          name: file.name,
          length: file.size,
        });

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
          sentimentPositive: null,
          sentimentNeutral: null,
          sentimentNegative: null,
        });

        setImportResults((prev) => ({ ...prev, [file.name]: "done" }));
      } catch (err) {
        console.error("Import failed for", file.name, err);
        setImportResults((prev) => ({ ...prev, [file.name]: "error" }));
      }
    }

    setImporting(false);
    navigate("/meetings");
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  const selectedCount = selected.size;
  const newCount = files.filter((f) => !f.alreadyImported).length;
  const connected = deviceInfo !== null;

  // Storage estimate
  const totalUsedBytes = files.reduce((sum, f) => sum + f.size, 0);
  const totalCapacityMB = 512;
  const usedMB = totalUsedBytes / (1024 * 1024);
  const storagePercent = Math.min((usedMB / totalCapacityMB) * 100, 100);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return null;
    return sortDir === "asc"
      ? <ArrowUp className="h-3 w-3" style={{ color: t.tx2 }} />
      : <ArrowDown className="h-3 w-3" style={{ color: t.tx2 }} />;
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden" style={{ color: t.tx }}>
      {/* Page header */}
      <div className="flex items-center gap-3 px-6 py-5">
        <h1 className="text-xl font-semibold" style={{ color: t.tx }}>Device Manager</h1>
        {connected && (
          <button
            onClick={handleRefresh}
            disabled={scanning}
            className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-40"
            style={{ color: t.ac, background: t.acL }}
            title="Refresh"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", scanning && "animate-spin")} />
            Refresh
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div
          className="mx-6 mb-4 flex items-start gap-3 rounded-xl px-4 py-3"
          style={{ background: t.errL, border: `1px solid ${t.err}30` }}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" style={{ color: t.err }} />
          <div>
            <p className="text-sm font-medium" style={{ color: t.err }}>Connection failed</p>
            <p className="mt-0.5 font-mono text-xs" style={{ color: t.err, opacity: 0.8 }}>{error}</p>
            <p className="mt-1 text-xs" style={{ color: t.tx2 }}>
              Make sure HiDock P1 is connected via USB and the HiNotes app is closed.
            </p>
          </div>
        </div>
      )}

      {/* Not connected state */}
      {!connected && !scanning && !error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center px-6">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-full"
            style={{ background: t.bgA }}
          >
            <Usb className="h-9 w-9" style={{ color: t.txM }} />
          </div>
          <div>
            <p className="text-lg font-semibold" style={{ color: t.tx }}>No device connected</p>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: t.tx2 }}>
              Connect your HiDock P1 via USB, then click the button below.
              <br />
              Make sure the HiNotes app is closed first.
            </p>
          </div>
          <button
            onClick={handleConnect}
            className="btn-gradient flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white"
          >
            <Plug className="h-4 w-4" />
            Connect device
          </button>
        </div>
      )}

      {/* Scanning spinner */}
      {scanning && !connected && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin" style={{ color: t.ac }} />
          <p className="text-sm" style={{ color: t.tx2 }}>Connecting to device...</p>
        </div>
      )}

      {/* Connected view */}
      {connected && (
        <div className="flex flex-1 flex-col overflow-hidden px-6 pb-6 gap-4">
          {/* Device status card */}
          <div
            className="flex items-center gap-4 p-4"
            style={{
              background: t.bgC,
              border: `1px solid ${t.bd}`,
              borderRadius: 14,
              boxShadow: t.sh,
            }}
          >
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
              style={{ background: t.okL }}
            >
              <Usb className="h-5 w-5" style={{ color: t.ok }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold" style={{ color: t.tx }}>
                  HiDock P1 Device
                </p>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ background: t.okL, color: t.ok }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.ok }} />
                  Connected
                </span>
              </div>
              <p className="mt-0.5 text-xs" style={{ color: t.tx2 }}>
                SN: {deviceInfo.sn} &middot; FW {deviceInfo.versionCode}
              </p>
              {/* Storage bar */}
              <div className="mt-2 flex items-center gap-3">
                <div
                  className="h-2 flex-1 overflow-hidden rounded-full"
                  style={{ background: t.bgA }}
                >
                  <div
                    className={`h-full rounded-full transition-all ${storagePercent > 90 ? "" : "gradient-storage"}`}
                    style={{
                      width: `${storagePercent}%`,
                      ...(storagePercent > 90 ? { background: t.err } : {}),
                    }}
                  />
                </div>
                <span className="shrink-0 text-xs tabular-nums" style={{ color: t.tx2 }}>
                  {usedMB.toFixed(1)} MB / {totalCapacityMB} MB
                </span>
              </div>
            </div>
          </div>

          {/* Bulk action bar */}
          {selectedCount > 0 && (
            <div
              className="flex items-center gap-3 px-4 py-2.5"
              style={{
                background: t.acL,
                borderRadius: 10,
                border: `1px solid ${t.ac}20`,
              }}
            >
              <span className="text-sm font-medium" style={{ color: t.ac }}>
                {selectedCount} selected
              </span>
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={handleImport}
                  disabled={importing}
                  className="btn-gradient flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  <Download className="h-3.5 w-3.5" />
                  {importing ? "Transferring..." : "Transfer"}
                </button>
                <button
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
                  style={{ color: t.err, background: t.errL }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </div>
          )}

          {/* Selection bar */}
          {files.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm" style={{ color: t.tx2 }}>
                {files.length} recording{files.length !== 1 ? "s" : ""} &middot; {newCount} new
              </span>
              <div className="ml-auto flex items-center gap-1">
                {[
                  { label: "Select new", action: selectNew },
                  { label: "All", action: selectAll },
                  { label: "None", action: clearAll },
                ].map((btn) => (
                  <button
                    key={btn.label}
                    onClick={btn.action}
                    className="rounded-md px-2 py-1 text-xs font-medium transition-colors"
                    style={{ color: t.lk }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = t.lkL)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* File table */}
          <div
            className="flex-1 overflow-hidden flex flex-col"
            style={{
              background: t.bgC,
              border: `1px solid ${t.bd}`,
              borderRadius: 14,
              boxShadow: t.sh,
            }}
          >
            {scanning ? (
              <div className="flex flex-1 items-center justify-center">
                <RefreshCw className="h-5 w-5 animate-spin" style={{ color: t.ac }} />
              </div>
            ) : files.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center p-8">
                <p className="font-medium" style={{ color: t.tx }}>No recordings found</p>
                <p className="text-sm" style={{ color: t.tx2 }}>
                  The device is connected but has no recordings.
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0" style={{ background: t.bgC }}>
                    <tr style={{ borderBottom: `1px solid ${t.bd}` }}>
                      <th className="w-10 px-4 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selectedCount === files.length && files.length > 0}
                          onChange={(e) => (e.target.checked ? selectAll() : clearAll())}
                          style={{ accentColor: t.ac }}
                        />
                      </th>
                      {([
                        { key: "name" as SortKey, label: "FILE NAME" },
                        { key: "size" as SortKey, label: "SIZE" },
                        { key: "recordedAt" as SortKey, label: "DATE" },
                        { key: "durationMs" as SortKey, label: "DURATION" },
                      ]).map(({ key, label }) => (
                        <th key={key} className="py-3 pr-4 text-left">
                          <button
                            onClick={() => toggleSort(key)}
                            className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider"
                            style={{ color: t.txM }}
                          >
                            {label}
                            <SortIcon col={key} />
                          </button>
                        </th>
                      ))}
                      <th
                        className="py-3 pr-4 text-left text-xs font-semibold uppercase tracking-wider"
                        style={{ color: t.txM }}
                      >
                        STATUS
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFiles.map((file) => {
                      const importStatus = importResults[file.name];
                      const isDone = importStatus === "done" || file.alreadyImported;
                      const isImporting = importStatus === "importing";
                      const isError = importStatus === "error";
                      const isSelected = selected.has(file.name);

                      return (
                        <tr
                          key={file.name}
                          className="transition-colors cursor-pointer"
                          style={{
                            borderBottom: `1px solid ${t.bdL}`,
                            background: isSelected ? t.acL : "transparent",
                          }}
                          onClick={() => !isDone && toggleFile(file.name)}
                          onMouseEnter={(e) => {
                            if (!isSelected) e.currentTarget.style.background = t.bgH;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = isSelected ? t.acL : "transparent";
                          }}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={isDone}
                              onChange={() => toggleFile(file.name)}
                              onClick={(e) => e.stopPropagation()}
                              style={{ accentColor: t.ac }}
                            />
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 shrink-0" style={{ color: t.txM }} />
                              <span className="font-mono text-xs" style={{ color: t.tx }}>
                                {file.name}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 tabular-nums text-xs" style={{ color: t.tx2 }}>
                            {file.size ? formatFileSize(file.size) : "\u2014"}
                          </td>
                          <td className="py-3 pr-4 text-xs" style={{ color: t.tx2 }}>
                            {new Date(file.recordedAt).toLocaleDateString("en-GB", {
                              day: "numeric", month: "short", year: "numeric",
                            })}
                          </td>
                          <td className="py-3 pr-4 tabular-nums text-xs" style={{ color: t.tx2 }}>
                            {file.durationMs ? formatDuration(file.durationMs) : "\u2014"}
                          </td>
                          <td className="py-3 pr-4">
                            {isImporting ? (
                              <span
                                className="inline-flex items-center gap-1.5 text-xs font-medium"
                                style={{ color: t.ac }}
                              >
                                <RefreshCw className="h-3 w-3 animate-spin" />
                                Transferring...
                              </span>
                            ) : isDone ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate("/meetings");
                                }}
                                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
                                style={{ background: t.okL, color: t.ok }}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Processed
                              </button>
                            ) : isError ? (
                              <span
                                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                                style={{ background: t.errL, color: t.err }}
                              >
                                <AlertCircle className="h-3 w-3" />
                                Error
                              </span>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelected(new Set([file.name]));
                                  // Trigger import for this single file
                                  (async () => {
                                    setImportResults((prev) => ({ ...prev, [file.name]: "importing" }));
                                    try {
                                      const existing = await getNoteBySignature(file.signature).catch(() => null);
                                      if (existing) {
                                        setImportResults((prev) => ({ ...prev, [file.name]: "done" }));
                                        return;
                                      }
                                      const savedPath: string = await invoke("usb_download_and_save", {
                                        name: file.name,
                                        length: file.size,
                                      });
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
                                        sentimentPositive: null,
                                        sentimentNeutral: null,
                                        sentimentNegative: null,
                                      });
                                      setImportResults((prev) => ({ ...prev, [file.name]: "done" }));
                                    } catch (err) {
                                      console.error("Import failed for", file.name, err);
                                      setImportResults((prev) => ({ ...prev, [file.name]: "error" }));
                                    }
                                  })();
                                }}
                                className="btn-gradient-subtle inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold"
                                style={{ color: t.ac }}
                              >
                                <Download className="h-3 w-3" />
                                Transfer
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
