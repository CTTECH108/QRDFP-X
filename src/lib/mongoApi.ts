/**
 * MongoDB API Client
 * All data operations go through edge functions backed by MongoDB Atlas.
 * Supabase is only used for auth + file storage.
 */

import { supabase } from "@/integrations/supabase/client";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const BASE_URL = `https://${PROJECT_ID}.supabase.co/functions/v1`;

async function getAuthHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? "";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

// ── Types ────────────────────────────────────────────────────────────────

export interface Room {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  sender_id: string;
  sender_name: string;
  encrypted_payload: string;
  iv: string;
  entropy_source: string;
  created_at: string;
}

export interface FileRecord {
  id: string;
  room_id: string | null;
  uploader_id: string;
  uploader_name: string;
  original_name: string;
  encrypted_path: string;
  iv: string;
  file_size: number;
  entropy_source: string;
  created_at: string;
}

// ── Rooms ─────────────────────────────────────────────────────────────────

export async function listRooms(): Promise<Room[]> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/mongo-rooms`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createRoom(name: string, userId: string): Promise<Room> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/mongo-rooms`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name, created_by: userId }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Messages ──────────────────────────────────────────────────────────────

export async function listMessages(roomId: string, since?: string): Promise<Message[]> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ room_id: roomId, limit: "80" });
  if (since) params.set("since", since);
  const res = await fetch(`${BASE_URL}/mongo-messages?${params}`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function sendMessage(payload: {
  room_id: string;
  sender_id: string;
  sender_name: string;
  encrypted_payload: string;
  iv: string;
  entropy_source: string;
}): Promise<Message> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/mongo-messages`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Files ─────────────────────────────────────────────────────────────────

export async function listFiles(roomId: string): Promise<FileRecord[]> {
  const headers = await getAuthHeaders();
  const params = new URLSearchParams({ room_id: roomId });
  const res = await fetch(`${BASE_URL}/mongo-files?${params}`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function saveFileMeta(payload: {
  room_id: string;
  uploader_id: string;
  uploader_name: string;
  original_name: string;
  encrypted_path: string;
  iv: string;
  file_size: number;
  entropy_source: string;
}): Promise<FileRecord> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE_URL}/mongo-files`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
