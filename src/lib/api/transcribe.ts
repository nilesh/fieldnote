/**
 * Transcription via OpenAI Whisper API
 * Sends an audio file and returns timestamped segments.
 */

import { fetch } from "@tauri-apps/plugin-http";
import type { TranscriptionSegment } from "@/types";

const WHISPER_URL = "https://api.openai.com/v1/audio/transcriptions";

export interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export async function transcribeAudio(
  apiKey: string,
  audioData: Uint8Array,
  filename: string,
  language?: string
): Promise<WhisperSegment[]> {
  const blob = new Blob([audioData.buffer as ArrayBuffer], { type: "audio/mpeg" });
  const form = new FormData();
  form.append("file", blob, filename);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  if (language) {
    form.append("language", language);
  }

  const resp = await fetch(WHISPER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Whisper API error ${resp.status}: ${err}`);
  }

  const result = await resp.json() as { segments: WhisperSegment[] };
  return result.segments ?? [];
}

/** Convert Whisper segments to our TranscriptionSegment format */
export function toTranscriptionSegments(
  noteId: string,
  segments: WhisperSegment[],
  model: string
): Omit<TranscriptionSegment, "id">[] {
  return segments.map((s) => ({
    noteId,
    beginMs: Math.round(s.start * 1000),
    endMs: Math.round(s.end * 1000),
    sentence: s.text.trim(),
    speaker: null,
    model,
    createdAt: Date.now(),
  }));
}
