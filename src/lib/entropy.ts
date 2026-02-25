import { supabase } from "@/integrations/supabase/client";
import type { EntropySource } from "./crypto";

export interface EntropyStatus {
  source: EntropySource;
  entropy_hex: string;
  timestamp: string;
  age_ms?: number;
}

let cachedEntropy: EntropyStatus | null = null;
const CACHE_TTL_MS = 25_000;

export async function fetchEntropy(): Promise<EntropyStatus> {
  if (cachedEntropy) {
    const age = Date.now() - new Date(cachedEntropy.timestamp).getTime();
    if (age < CACHE_TTL_MS) return { ...cachedEntropy, age_ms: age };
  }

  try {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/entropy`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error("Entropy fetch failed");

    const data = await res.json();
    cachedEntropy = { source: data.source, entropy_hex: data.entropy_hex, timestamp: data.timestamp };
    return { ...cachedEntropy, age_ms: 0 };
  } catch {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    const fallback: EntropyStatus = { source: "software", entropy_hex: hex, timestamp: new Date().toISOString(), age_ms: 0 };
    cachedEntropy = fallback;
    return fallback;
  }
}

export function clearEntropyCache() {
  cachedEntropy = null;
}

export async function getLatestEntropyStatus(): Promise<{ source: EntropySource; lastSeen: string | null }> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const token = session.session?.access_token;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const url = `https://${projectId}.supabase.co/functions/v1/entropy`;
    // Quick GET to check source
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { source: "software", lastSeen: null };
    const data = await res.json();
    return { source: data.source, lastSeen: data.source === "hardware" ? data.timestamp : null };
  } catch {
    return { source: "software", lastSeen: null };
  }
}
