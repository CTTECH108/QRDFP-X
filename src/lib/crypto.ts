// Browser-side AES-256-GCM encryption using Web Crypto API
// Keys are derived from QRNG entropy via HKDF — never stored permanently

export type EntropySource = "hardware" | "software";

export interface EntropyResult {
  source: EntropySource;
  entropy_hex: string;
  timestamp: string;
}

// Convert hex string to Uint8Array
export function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

// Ensure a Uint8Array has an ArrayBuffer (not SharedArrayBuffer)
function toArrayBuffer(arr: Uint8Array): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(arr.byteLength);
  new Uint8Array(buf).set(arr);
  return new Uint8Array(buf);
}

// Convert Uint8Array to hex string
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Convert Uint8Array to base64
export function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

// Convert base64 to Uint8Array
export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const chars = atob(b64).split("").map((c) => c.charCodeAt(0));
  const buf = new ArrayBuffer(chars.length);
  const arr = new Uint8Array(buf);
  chars.forEach((c, i) => { arr[i] = c; });
  return arr;
}

// Derive AES-256-GCM session key from entropy using HKDF
export async function deriveKey(
  entropyHex: string,
  salt?: Uint8Array
): Promise<{ key: CryptoKey; salt: Uint8Array<ArrayBuffer> }> {
  const ikm = hexToBytes(entropyHex);
  const rawSalt = salt ? toArrayBuffer(salt) : toArrayBuffer(crypto.getRandomValues(new Uint8Array(32)));

  // Import raw entropy as key material
  const keyMaterial = await crypto.subtle.importKey("raw", ikm, "HKDF", false, [
    "deriveKey",
  ]);

  // Derive AES-256-GCM key via HKDF-SHA256
  const key = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: rawSalt,
      info: toArrayBuffer(new TextEncoder().encode("QRNG-SecureComms-v1")),
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  return { key, salt: rawSalt };
}

// Encrypt text message
export async function encryptMessage(
  plaintext: string,
  entropyHex: string
): Promise<{ ciphertext: string; iv: string; salt: string }> {
  const { key, salt } = await deriveKey(entropyHex);
  const iv = toArrayBuffer(crypto.getRandomValues(new Uint8Array(12)));

  const encoded = toArrayBuffer(new TextEncoder().encode(plaintext));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  return {
    ciphertext: bytesToBase64(new Uint8Array(cipherBuffer)),
    iv: bytesToBase64(iv),
    salt: bytesToBase64(salt),
  };
}

// Decrypt text message
export async function decryptMessage(
  ciphertext: string,
  ivB64: string,
  saltB64: string,
  entropyHex: string
): Promise<string> {
  const salt = base64ToBytes(saltB64);
  const { key } = await deriveKey(entropyHex, salt);
  const iv = base64ToBytes(ivB64);
  const cipherBytes = base64ToBytes(ciphertext);

  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    cipherBytes
  );

  return new TextDecoder().decode(plainBuffer);
}

// Encrypt file
export async function encryptFile(
  file: File,
  entropyHex: string
): Promise<{ encryptedBlob: Blob; iv: string; salt: string }> {
  const { key, salt } = await deriveKey(entropyHex);
  const iv = toArrayBuffer(crypto.getRandomValues(new Uint8Array(12)));

  const fileBuffer = await file.arrayBuffer();
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    fileBuffer
  );

  return {
    encryptedBlob: new Blob([cipherBuffer], { type: "application/octet-stream" }),
    iv: bytesToBase64(iv),
    salt: bytesToBase64(salt),
  };
}

// Decrypt file
export async function decryptFile(
  encryptedBlob: Blob,
  ivB64: string,
  saltB64: string,
  entropyHex: string,
  originalMimeType?: string
): Promise<Blob> {
  const salt = base64ToBytes(saltB64);
  const { key } = await deriveKey(entropyHex, salt);
  const iv = base64ToBytes(ivB64);

  const encBuffer = await encryptedBlob.arrayBuffer();
  const plainBuffer = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encBuffer
  );

  return new Blob([plainBuffer], { type: originalMimeType || "application/octet-stream" });
}

// Shared session key for a room (derived from room ID + user shared secret)
// In a real E2E system, this would use Diffie-Hellman. Here we use a
// deterministic key derived from the room ID + entropy for demonstration.
export async function getRoomKey(
  roomId: string,
  entropyHex: string
): Promise<{ key: CryptoKey; salt: Uint8Array }> {
  // Use room ID as additional info for HKDF
  const combined = entropyHex + roomId.replace(/-/g, "");
  const salt = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(roomId))
  );
  return deriveKey(combined.slice(0, 64), salt);
}
