import { useState } from "react";
import { Save, Eye, EyeOff, ExternalLink } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { settings, save } = useSettingsStore();
  const [form, setForm] = useState({ ...settings });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showOpenAI, setShowOpenAI] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [showHiNotes, setShowHiNotes] = useState(false);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
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

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <h1 className="text-lg font-semibold">Settings</h1>
        <div className="ml-auto">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saved ? "Saved!" : saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-8 px-6 py-8">

          {/* Transcription */}
          <Section title="Transcription" description="Configure OpenAI Whisper for local transcription.">
            <Field label="OpenAI API Key">
              <SecretInput
                value={form.openaiApiKey}
                show={showOpenAI}
                onToggle={() => setShowOpenAI((v) => !v)}
                onChange={(v) => set("openaiApiKey", v)}
                placeholder="sk-..."
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Used for Whisper transcription.{" "}
                <a
                  href="https://platform.openai.com/api-keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary hover:underline"
                >
                  Get a key <ExternalLink className="h-3 w-3" />
                </a>
              </p>
            </Field>

            <Field label="Transcription Model">
              <select
                value={form.transcriptionModel}
                onChange={(e) => set("transcriptionModel", e.target.value)}
                className="input-base"
              >
                <option value="whisper-1">whisper-1</option>
              </select>
            </Field>

            <Field label="Default Language">
              <input
                type="text"
                value={form.defaultLanguage ?? ""}
                onChange={(e) => set("defaultLanguage", e.target.value || null)}
                placeholder="e.g. en, fr, es (leave blank for auto-detect)"
                className="input-base"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                ISO 639-1 code. Leave blank for Whisper auto-detection.
              </p>
            </Field>

            <Field label="Auto-transcribe on import">
              <Toggle
                checked={form.autoTranscribeOnImport}
                onChange={(v) => set("autoTranscribeOnImport", v)}
                label="Automatically start transcription when recordings are imported"
              />
            </Field>
          </Section>

          {/* Summarisation */}
          <Section title="Summarisation" description="Choose your LLM provider and model for summarisation.">
            <Field label="Provider">
              <div className="flex gap-3">
                {(["openai", "anthropic"] as const).map((p) => (
                  <label key={p} className="flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="provider"
                      value={p}
                      checked={form.defaultSummaryProvider === p}
                      onChange={() => set("defaultSummaryProvider", p)}
                      className="accent-primary"
                    />
                    <span className="text-sm capitalize">{p === "openai" ? "OpenAI" : "Anthropic"}</span>
                  </label>
                ))}
              </div>
            </Field>

            {form.defaultSummaryProvider === "anthropic" && (
              <Field label="Anthropic API Key">
                <SecretInput
                  value={form.anthropicApiKey}
                  show={showAnthropic}
                  onToggle={() => setShowAnthropic((v) => !v)}
                  onChange={(v) => set("anthropicApiKey", v)}
                  placeholder="sk-ant-..."
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 text-primary hover:underline"
                  >
                    Get a key <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </Field>
            )}

            <Field label="Model">
              {form.defaultSummaryProvider === "openai" ? (
                <select
                  value={form.defaultSummaryModel}
                  onChange={(e) => set("defaultSummaryModel", e.target.value)}
                  className="input-base"
                >
                  <option value="gpt-4o">gpt-4o</option>
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                  <option value="gpt-4-turbo">gpt-4-turbo</option>
                </select>
              ) : (
                <select
                  value={form.defaultSummaryModel}
                  onChange={(e) => set("defaultSummaryModel", e.target.value)}
                  className="input-base"
                >
                  <option value="claude-opus-4-6">claude-opus-4-6</option>
                  <option value="claude-sonnet-4-6">claude-sonnet-4-6</option>
                  <option value="claude-haiku-4-5-20251001">claude-haiku-4-5-20251001</option>
                </select>
              )}
            </Field>

            <Field label="Auto-summarise after transcription">
              <Toggle
                checked={form.autoSummarizeAfterTranscript}
                onChange={(v) => set("autoSummarizeAfterTranscript", v)}
                label="Automatically summarise once transcription completes"
              />
            </Field>

            <Field label="Summary system prompt">
              <textarea
                value={form.summarySystemPrompt}
                onChange={(e) => set("summarySystemPrompt", e.target.value)}
                rows={6}
                className="input-base resize-y font-mono text-xs"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                System prompt sent to the LLM before the transcript. Supports markdown in output.
              </p>
            </Field>
          </Section>

          {/* HiNotes */}
          <Section
            title="HiNotes (optional)"
            description="Connect to your HiNotes account to use their cloud transcription and summarisation pipeline as an alternative."
          >
            <Field label="Enable HiNotes integration">
              <Toggle
                checked={form.hinotesEnabled}
                onChange={(v) => set("hinotesEnabled", v)}
                label="Use HiNotes API for processing"
              />
            </Field>

            {form.hinotesEnabled && (
              <Field label="Access Token">
                <SecretInput
                  value={form.hinotesAccessToken}
                  show={showHiNotes}
                  onToggle={() => setShowHiNotes((v) => !v)}
                  onChange={(v) => set("hinotesAccessToken", v)}
                  placeholder="Paste your HiNotes AccessToken here"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Obtain this from the HiNotes web app network requests (the{" "}
                  <code className="rounded bg-secondary px-1">AccessToken</code> request header).
                </p>
              </Field>
            )}
          </Section>

        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-4">
        <h2 className="text-base font-semibold">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="space-y-4 rounded-lg border border-border bg-card p-5">
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}

function SecretInput({
  value,
  show,
  onToggle,
  onChange,
  placeholder,
}: {
  value: string;
  show: boolean;
  onToggle: () => void;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn("input-base pr-10", "font-mono text-sm")}
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-primary" : "bg-input"
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </button>
      <span className="text-sm text-muted-foreground">{label}</span>
    </label>
  );
}
