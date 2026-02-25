// Client-side encryption utilities using Web Crypto API
// All encryption/decryption happens in the browser - server never sees plaintext

export type EntropySource = 'hardware' | 'software';

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
  entropySource: EntropySource;
}

export interface DerivedKeyResult {
  key: CryptoKey;
  source: EntropySource;
}

// Convert ArrayBuffer to base64 string
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert base64 string to ArrayBuffer
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Fetch derived key from entropy edge function
export async function deriveSessionKey(salt?: string): Promise<DerivedKeyResult> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  try {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/entropy/derive-key`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': anonKey,
        },
        body: JSON.stringify({ salt: salt || crypto.randomUUID() }),
      }
    );

    if (response.ok) {
      const { key: keyHex, source } = await response.json();
      const keyBuffer = new Uint8Array(keyHex.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)));
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      return { key: cryptoKey, source: source as EntropySource };
    }
  } catch (e) {
    console.warn('Failed to derive key from server, using local fallback:', e);
  }

  // Local software fallback
  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  return { key, source: 'software' };
}

// Encrypt text message
export async function encryptMessage(
  plaintext: string,
  key: CryptoKey,
  source: EntropySource
): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  return {
    ciphertext: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv.buffer),
    entropySource: source,
  };
}

// Decrypt text message
export async function decryptMessage(
  payload: EncryptedPayload,
  key: CryptoKey
): Promise<string> {
  const ciphertext = base64ToBuffer(payload.ciphertext);
  const iv = base64ToBuffer(payload.iv);

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

// Encrypt file
export async function encryptFile(
  file: File,
  key: CryptoKey,
  source: EntropySource
): Promise<{ encryptedBlob: Blob; iv: string; entropySource: EntropySource }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const fileBuffer = await file.arrayBuffer();

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    fileBuffer
  );

  return {
    encryptedBlob: new Blob([ciphertext]),
    iv: bufferToBase64(iv.buffer),
    entropySource: source,
  };
}

// Decrypt file
export async function decryptFile(
  encryptedData: ArrayBuffer,
  ivBase64: string,
  key: CryptoKey
): Promise<ArrayBuffer> {
  const iv = base64ToBuffer(ivBase64);

  return await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    encryptedData
  );
}

// Check QRNG status
export async function getQRNGStatus(): Promise<{
  source: EntropySource;
  fresh: boolean;
  lastUpdate: number | null;
}> {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  try {
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/entropy/entropy`,
      {
        headers: { 'apikey': anonKey },
      }
    );

    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.warn('Failed to check QRNG status:', e);
  }

  return { source: 'software', fresh: false, lastUpdate: null };
}
