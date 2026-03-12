/**
 * HiNotes API client
 * Base URL: https://hinotes.hidock.com
 * Auth: AccessToken header (obtained via /v1/user/signin)
 * Body: application/x-www-form-urlencoded (except device/event/info which uses JSON)
 */

import { fetch } from "@tauri-apps/plugin-http";
import type {
  HiNotesNote,
  HiNotesTranscriptionSegment,
  HiNotesFileInfo,
} from "@/types";

const BASE_URL = "https://hinotes.hidock.com";

interface ApiResponse<T> {
  error: number;
  message: string;
  data: T;
}

async function request<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    token: string;
    body?: Record<string, string> | string;
    json?: unknown;
  }
): Promise<T> {
  const { method = "POST", token, body, json } = options;

  const headers: Record<string, string> = {
    AccessToken: token,
  };

  let reqBody: string | undefined;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    reqBody = JSON.stringify(json);
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    reqBody =
      typeof body === "string"
        ? body
        : new URLSearchParams(body).toString();
  }

  const resp = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: reqBody,
  });

  if (!resp.ok) {
    throw new Error(`HiNotes API error: ${resp.status} ${resp.statusText}`);
  }

  const result = (await resp.json()) as ApiResponse<T>;
  if (result.error !== 0) {
    throw new Error(`HiNotes API: ${result.message} (code ${result.error})`);
  }

  return result.data;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function signin(
  email: string,
  password: string
): Promise<{ accessToken: string }> {
  const resp = await fetch(`${BASE_URL}/v1/user/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password }).toString(),
  });
  const result = (await resp.json()) as ApiResponse<{ accessToken: string }>;
  if (result.error !== 0) {
    throw new Error(result.message || "Sign in failed");
  }
  return result.data;
}

export async function getUserInfo(token: string) {
  return request<{
    id: string;
    type: string;
    name: string;
    email: string;
    avatar: string;
  }>("/v1/user/info", { token });
}

export async function logout(token: string) {
  return fetch(`${BASE_URL}/v1/user/logout`, {
    headers: { AccessToken: token },
  });
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export async function listNotes(
  token: string,
  params: {
    folderId?: string;
    tagId?: string;
    pageSize?: number;
    pageIndex?: number;
  } = {}
): Promise<{ content: HiNotesNote[]; totalElements: number; totalPages: number }> {
  return request("/v2/note/list", {
    token,
    body: {
      folderId: params.folderId ?? "",
      tagId: params.tagId ?? "",
      pageSize: String(params.pageSize ?? 20),
      pageIndex: String(params.pageIndex ?? 0),
    },
  });
}

export async function getNoteDetail(token: string, noteId: string) {
  return request<{ note: HiNotesNote; fields: { name: string; value: string }[] }>(
    "/v2/note/detail",
    { token, body: { id: noteId } }
  );
}

export async function getTranscription(
  token: string,
  noteId: string
): Promise<HiNotesTranscriptionSegment[]> {
  return request("/v2/note/transcription/list", {
    token,
    body: { noteId },
  });
}

export async function getAudioResampleUrl(token: string, noteId: string): Promise<string> {
  return request("/v2/note/audio/resample", {
    token,
    body: { noteId },
  });
}

export async function updateMarkdown(
  token: string,
  noteId: string,
  markdown: string
) {
  return request("/v2/note/markdown/update", {
    token,
    body: { id: noteId, markdown },
  });
}

// ─── Folders & Tags ───────────────────────────────────────────────────────────

export async function listFolders(token: string) {
  return request<{ id: string; name: string; noteCount: number }[]>(
    "/v1/folder/list",
    { token }
  );
}

export async function listTags(token: string) {
  return request<{ id: string; tag: string; noteCount: number }[]>(
    "/v2/tag/cluster",
    { token, body: { folderId: "" } }
  );
}

// ─── Device ───────────────────────────────────────────────────────────────────

export async function checkDeviceFiles(
  token: string,
  signatures: string[]
): Promise<HiNotesFileInfo[]> {
  return request("/v2/device/file/info", {
    token,
    body: { signatures: signatures.join(",") },
  });
}

export async function uploadDeviceFile(
  token: string,
  filename: string,
  data: Uint8Array
): Promise<void> {
  const formData = new FormData();
  formData.append("file", new Blob([data.buffer as ArrayBuffer], { type: "application/octet-stream" }), filename);

  const resp = await fetch(`${BASE_URL}/v2/device/file/carry`, {
    method: "POST",
    headers: { AccessToken: token },
    body: formData,
  });
  const result = (await resp.json()) as ApiResponse<null>;
  if (result.error !== 0) {
    throw new Error(`Upload failed: ${result.message}`);
  }
}

export async function getDeviceStatus(token: string, deviceSn: string) {
  return request<{
    owner: string | null;
    ownership: string;
    accessibility: string;
    name: string;
  }>("/v1/user/device/status", { token, body: { deviceSn } });
}

// Audio stream URL (no auth needed once you have the URL)
export function getAudioStreamUrl(_token: string, noteId: string): string {
  return `${BASE_URL}/v2/note/audio/stream?noteId=${noteId}`;
}
