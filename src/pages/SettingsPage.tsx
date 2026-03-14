import { useState, useEffect } from "react";
import { Save, Eye, EyeOff } from "lucide-react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useThemeStore } from "@/stores/themeStore";
import type { AppSettings } from "@/types";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

// ─── Settings Row Component ───────────────────────────────────────────────────

function SettingsRow({
  label,
  description,
  children,
  noBorder,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  noBorder?: boolean;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-4 py-3">
        <div className="flex-1 min-w-0">
          <Label className="text-sm font-medium text-foreground">{label}</Label>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
      {!noBorder && <Separator />}
    </>
  );
}

// ─── API Key Input ────────────────────────────────────────────────────────────

function ApiKeyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-[260px] font-mono text-xs"
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setVisible(!visible)}
        className="shrink-0"
      >
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { settings, save } = useSettingsStore();
  useThemeStore(); // keep store subscription active
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

  // Available summary models per provider
  const summaryModels =
    form.defaultSummaryProvider === "openai"
      ? [
          { value: "gpt-4o", label: "GPT-4o" },
          { value: "gpt-4o-mini", label: "GPT-4o Mini" },
        ]
      : [
          { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
          { value: "claude-opus-4", label: "Claude Opus 4" },
        ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden text-foreground">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-5">
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <div className="ml-auto">
          <Button variant="gradient" onClick={handleSave} disabled={saving} size="sm">
            <Save className="h-3.5 w-3.5" />
            {saved ? "Saved!" : saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl space-y-6 px-6 pb-8">

          {/* ── API Keys Section ────────────────────────────────────────── */}
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              API Keys
            </h2>
            <Card>
              <CardContent className="px-5 py-0">
                <SettingsRow
                  label="OpenAI API Key"
                  description="Required for Whisper transcription and GPT models"
                >
                  <ApiKeyInput
                    value={form.openaiApiKey}
                    onChange={(v) => set("openaiApiKey", v)}
                    placeholder="sk-..."
                  />
                </SettingsRow>
                <SettingsRow
                  label="Anthropic API Key"
                  description="Required for Claude models"
                  noBorder
                >
                  <ApiKeyInput
                    value={form.anthropicApiKey}
                    onChange={(v) => set("anthropicApiKey", v)}
                    placeholder="sk-ant-..."
                  />
                </SettingsRow>
              </CardContent>
            </Card>
          </div>

          {/* ── AI Models Section ───────────────────────────────────────── */}
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              AI Models
            </h2>
            <Card>
              <CardContent className="px-5 py-0">
                <SettingsRow
                  label="Transcription model"
                  description="Model used for speech-to-text"
                >
                  <Select
                    value={form.transcriptionModel}
                    onValueChange={(v) => set("transcriptionModel", v as AppSettings["transcriptionModel"])}
                  >
                    <SelectTrigger className="min-w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whisper-1">Whisper 1 (OpenAI)</SelectItem>
                      <SelectItem value="whisper-large-v3">Whisper Large v3</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingsRow>
                <SettingsRow
                  label="Summary provider"
                  description="LLM provider for generating meeting summaries"
                >
                  <Select
                    value={form.defaultSummaryProvider}
                    onValueChange={(v) => {
                      const provider = v as AppSettings["defaultSummaryProvider"];
                      const defaultModel = provider === "openai" ? "gpt-4o" : "claude-sonnet-4-5";
                      const next = {
                        ...form,
                        defaultSummaryProvider: provider,
                        defaultSummaryModel: defaultModel as AppSettings["defaultSummaryModel"],
                      };
                      setForm(next);
                      setSaved(false);
                      save(next);
                    }}
                  >
                    <SelectTrigger className="min-w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingsRow>
                <SettingsRow
                  label="Summary model"
                  description="Specific model for summarization"
                  noBorder
                >
                  <Select
                    value={form.defaultSummaryModel}
                    onValueChange={(v) => set("defaultSummaryModel", v as AppSettings["defaultSummaryModel"])}
                  >
                    <SelectTrigger className="min-w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {summaryModels.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingsRow>
              </CardContent>
            </Card>
          </div>

          {/* ── Processing Section ─────────────────────────────────────── */}
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Processing
            </h2>
            <Card>
              <CardContent className="px-5 py-0">
                <SettingsRow
                  label="Language"
                  description="Primary language for transcription"
                >
                  <Select
                    value={form.defaultLanguage || "auto"}
                    onValueChange={(v) => set("defaultLanguage", v === "auto" ? "" : v)}
                  >
                    <SelectTrigger className="min-w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="hi">Hindi</SelectItem>
                      <SelectItem value="es">Spanish</SelectItem>
                      <SelectItem value="auto">Auto-detect</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingsRow>
                <SettingsRow
                  label="Speaker detection"
                  description="Identify and label different speakers in recordings"
                >
                  <Switch
                    checked={form.speakerDetection}
                    onCheckedChange={(v) => set("speakerDetection", v)}
                  />
                </SettingsRow>
                <SettingsRow
                  label="Auto-transcribe on import"
                  description="Automatically start transcription when a recording is imported"
                >
                  <Switch
                    checked={form.autoTranscribeOnImport}
                    onCheckedChange={(v) => set("autoTranscribeOnImport", v)}
                  />
                </SettingsRow>
                <SettingsRow
                  label="Auto-summarize after transcription"
                  description="Automatically generate a summary when transcription completes"
                  noBorder
                >
                  <Switch
                    checked={form.autoSummarizeAfterTranscript}
                    onCheckedChange={(v) => set("autoSummarizeAfterTranscript", v)}
                  />
                </SettingsRow>
              </CardContent>
            </Card>
          </div>

          {/* ── Summary Prompt Section ─────────────────────────────────── */}
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Summary Prompt
            </h2>
            <Card>
              <CardContent className="px-5 py-3">
                <Label className="text-sm font-medium text-foreground">System prompt</Label>
                <p className="mt-0.5 mb-2 text-xs text-muted-foreground">
                  Instructions sent to the LLM when generating meeting summaries
                </p>
                <Textarea
                  value={form.summarySystemPrompt}
                  onChange={(e) => set("summarySystemPrompt", e.target.value)}
                  rows={4}
                  className="text-sm"
                />
              </CardContent>
            </Card>
          </div>

          {/* ── Device Section ──────────────────────────────────────────── */}
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Device
            </h2>
            <Card>
              <CardContent className="px-5 py-0">
                <SettingsRow
                  label="Auto-transfer on connect"
                  description="Automatically transfer new recordings when device is connected"
                  noBorder
                >
                  <Switch
                    checked={form.autoTransferOnConnect}
                    onCheckedChange={(v) => set("autoTransferOnConnect", v)}
                  />
                </SettingsRow>
              </CardContent>
            </Card>
          </div>

          {/* ── Notifications Section ──────────────────────────────────── */}
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Notifications
            </h2>
            <Card>
              <CardContent className="px-5 py-0">
                <SettingsRow
                  label="Desktop notifications"
                  description="Show system notifications for completed transcriptions and imports"
                  noBorder
                >
                  <Switch
                    checked={form.desktopNotifications}
                    onCheckedChange={(v) => set("desktopNotifications", v)}
                  />
                </SettingsRow>
              </CardContent>
            </Card>
          </div>

          <div className="py-3">
            <p className="text-xs text-muted-foreground">
              Accepted audio formats: .hda, .wav, .mp3, .m4a, .ogg
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
