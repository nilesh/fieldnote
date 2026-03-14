import { useState, useEffect } from "react";
import { Save, ExternalLink } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useThemeStore } from "@/stores/themeStore";
import type { AppSettings } from "@/types";
import type { Theme } from "@/lib/theme";

// ─── Toggle Component ─────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  t,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  t: Theme;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        background: checked ? t.ac : t.bgA,
        position: "relative",
        flexShrink: 0,
        transition: "background 0.2s",
        border: "none",
        cursor: "pointer",
        padding: 0,
      }}
    >
      <span
        style={{
          display: "block",
          width: 18,
          height: 18,
          borderRadius: 9,
          background: "#ffffff",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          position: "absolute",
          top: 3,
          left: checked ? 23 : 3,
          transition: "left 0.2s",
        }}
      />
    </button>
  );
}

// ─── Settings Row Component ───────────────────────────────────────────────────

function SettingsRow({
  label,
  description,
  children,
  t,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  t: Theme;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 py-3"
      style={{ borderBottom: `1px solid ${t.bdL}` }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: t.tx }}>{label}</p>
        {description && (
          <p className="mt-0.5 text-xs" style={{ color: t.txM }}>{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

// ─── Section Card Component ───────────────────────────────────────────────────

function SectionCard({
  title,
  children,
  t,
}: {
  title: string;
  children: React.ReactNode;
  t: Theme;
}) {
  return (
    <div>
      <h2
        className="mb-2 text-xs font-semibold uppercase tracking-wider"
        style={{ color: t.txM }}
      >
        {title}
      </h2>
      <div
        className="px-5"
        style={{
          background: t.bgC,
          border: `1px solid ${t.bd}`,
          borderRadius: 14,
          boxShadow: t.sh,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { settings, save } = useSettingsStore();
  const { t } = useThemeStore();
  const [form, setForm] = useState({ ...settings });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync form when settings load
  useEffect(() => {
    setForm({ ...settings });
  }, [settings]);

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const next = { ...form, [key]: value };
    setForm(next);
    setSaved(false);
    // Auto-save on change
    save(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await save(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  // Styled select
  const selectStyle: React.CSSProperties = {
    background: t.bgI,
    color: t.tx,
    border: `1px solid ${t.bd}`,
    borderRadius: 8,
    padding: "6px 10px",
    fontSize: 13,
    outline: "none",
    minWidth: 180,
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden" style={{ background: t.bg, color: t.tx }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-5">
        <h1 className="text-xl font-semibold" style={{ color: t.tx }}>Settings</h1>
        <div className="ml-auto">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50"
            style={{ background: t.ac, color: t.acT }}
            onMouseEnter={(e) => (e.currentTarget.style.background = t.acH)}
            onMouseLeave={(e) => (e.currentTarget.style.background = t.ac)}
          >
            <Save className="h-3.5 w-3.5" />
            {saved ? "Saved!" : saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-6 px-6 pb-8">

          {/* ── Device Section ──────────────────────────────────────────── */}
          <SectionCard title="Device" t={t}>
            <SettingsRow
              label="Auto-transfer on connect"
              description="Automatically transfer new recordings when device is connected"
              t={t}
            >
              <Toggle
                checked={form.autoTransferOnConnect}
                onChange={(v) => set("autoTransferOnConnect", v)}
                t={t}
              />
            </SettingsRow>
            <SettingsRow
              label="Save location"
              description="Where imported recordings are stored"
              t={t}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono" style={{ color: t.tx2 }}>
                  ~/Documents/FieldNote
                </span>
                <button
                  className="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
                  style={{ color: t.lk, background: t.lkL }}
                >
                  Change
                </button>
              </div>
            </SettingsRow>
          </SectionCard>

          {/* ── AI Processing Section ──────────────────────────────────── */}
          <SectionCard title="AI Processing" t={t}>
            <SettingsRow
              label="AI Model"
              description="Model used for transcription and summarization"
              t={t}
            >
              <select
                value={form.defaultSummaryModel}
                onChange={(e) => set("defaultSummaryModel", e.target.value as AppSettings["defaultSummaryModel"])}
                style={selectStyle}
              >
                <option value="claude-sonnet-4-5">Claude Sonnet 4</option>
                <option value="gpt-4o">GPT-4o</option>
                <option value="whisper-large-v3">Whisper Large v3</option>
              </select>
            </SettingsRow>
            <SettingsRow
              label="Speaker detection"
              description="Identify and label different speakers in recordings"
              t={t}
            >
              <Toggle
                checked={form.speakerDetection}
                onChange={(v) => set("speakerDetection", v)}
                t={t}
              />
            </SettingsRow>
            <SettingsRow
              label="Language"
              description="Primary language for transcription"
              t={t}
            >
              <select
                value={form.defaultLanguage}
                onChange={(e) => set("defaultLanguage", e.target.value)}
                style={selectStyle}
              >
                <option value="en">English</option>
                <option value="hi">Hindi</option>
                <option value="es">Spanish</option>
                <option value="">Auto-detect</option>
              </select>
            </SettingsRow>
            <div className="py-3">
              <p className="text-xs" style={{ color: t.txM }}>
                Accepted formats: .hda, .wav, .mp3, .m4a, .ogg
              </p>
            </div>
          </SectionCard>

          {/* ── Integrations Section ───────────────────────────────────── */}
          <SectionCard title="Integrations" t={t}>
            {[
              { name: "Google Calendar", desc: "Sync meetings and auto-match recordings" },
              { name: "Slack", desc: "Share summaries and action items to channels" },
              { name: "Notion", desc: "Export notes and summaries to Notion pages" },
            ].map((integration, i, arr) => (
              <div
                key={integration.name}
                className="flex items-center justify-between gap-4 py-3"
                style={i < arr.length - 1 ? { borderBottom: `1px solid ${t.bdL}` } : undefined}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: t.tx }}>
                    {integration.name}
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: t.txM }}>
                    {integration.desc}
                  </p>
                </div>
                <button
                  className="flex items-center gap-1.5 shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{ color: t.lk, background: t.lkL }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  <ExternalLink className="h-3 w-3" />
                  Connect
                </button>
              </div>
            ))}
          </SectionCard>

          {/* ── Notifications Section ──────────────────────────────────── */}
          <SectionCard title="Notifications" t={t}>
            <div className="py-1">
              <SettingsRow
                label="Desktop notifications"
                description="Show system notifications for completed transcriptions and imports"
                t={t}
              >
                <Toggle
                  checked={form.desktopNotifications}
                  onChange={(v) => set("desktopNotifications", v)}
                  t={t}
                />
              </SettingsRow>
            </div>
          </SectionCard>

        </div>
      </div>
    </div>
  );
}
