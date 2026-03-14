/**
 * Summarization via Anthropic Claude or OpenAI GPT
 */

import { fetch } from "@tauri-apps/plugin-http";
import type { TranscriptionSegment, LLMProvider, SummaryModel } from "@/types";

const DEFAULT_SYSTEM_PROMPT = `You are a meeting notes assistant. Given a transcript, produce a structured markdown summary with:

## Overview
A 2-3 sentence summary of the conversation.

## Key Points
The most important topics discussed.

## Decisions
Any decisions made.

## Action Items
Concrete next steps with owners if mentioned.

## Notes
Any other relevant details.

Be concise. Use bullet points. Do not pad with filler.`;

function buildTranscriptText(segments: TranscriptionSegment[]): string {
  return segments
    .map((s) => {
      const minutes = Math.floor(s.beginMs / 60000);
      const seconds = Math.floor((s.beginMs % 60000) / 1000);
      const ts = `[${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}]`;
      const speaker = s.speaker ? `${s.speaker}: ` : "";
      return `${ts} ${speaker}${s.sentence}`;
    })
    .join("\n");
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

export async function summarizeWithClaude(
  apiKey: string,
  segments: TranscriptionSegment[],
  model: SummaryModel = "claude-sonnet-4-5",
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT
): Promise<string> {
  const transcript = buildTranscriptText(segments);

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Please summarize this transcript:\n\n${transcript}`,
        },
      ],
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Anthropic API error ${resp.status}: ${err}`);
  }

  const result = await resp.json() as {
    content: { type: string; text: string }[];
  };

  return result.content.find((c) => c.type === "text")?.text ?? "";
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

export async function summarizeWithOpenAI(
  apiKey: string,
  segments: TranscriptionSegment[],
  model: SummaryModel = "gpt-4o",
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT
): Promise<string> {
  const transcript = buildTranscriptText(segments);

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Please summarize this transcript:\n\n${transcript}`,
        },
      ],
      max_tokens: 2048,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI API error ${resp.status}: ${err}`);
  }

  const result = await resp.json() as {
    choices: { message: { content: string } }[];
  };

  return result.choices[0]?.message?.content ?? "";
}

// ─── Unified ──────────────────────────────────────────────────────────────────

export async function summarize(
  provider: LLMProvider,
  apiKey: string,
  segments: TranscriptionSegment[],
  model: SummaryModel,
  systemPrompt: string
): Promise<string> {
  if (provider === "anthropic") {
    // Fall back to Claude default if an OpenAI model was passed
    const m = model.startsWith("gpt") ? "claude-sonnet-4-5" : model;
    return summarizeWithClaude(apiKey, segments, m as SummaryModel, systemPrompt);
  }
  // Fall back to GPT default if a Claude model was passed
  const m = model.startsWith("claude") ? "gpt-4o" : model;
  return summarizeWithOpenAI(apiKey, segments, m as SummaryModel, systemPrompt);
}
