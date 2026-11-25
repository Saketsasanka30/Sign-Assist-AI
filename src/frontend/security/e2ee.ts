interface PublicKeyDescriptor {
  keyId: string;
  algorithm: string;
  hash: string;
  cipher: string;
  publicKeyJwk: JsonWebKey;
}

export interface EncryptedEnvelope {
  encrypted: true;
  keyId: string;
  encryptedKey: string;
  iv: string;
  aad: string;
  ciphertext: string;
}

interface CachedServerKey {
  keyId: string;
  cryptoKey: CryptoKey;
}

let cachedServerKey: CachedServerKey | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function invalidateServerPublicKey(): void {
  cachedServerKey = null;
}

async function getServerPublicKey(): Promise<CachedServerKey> {
  if (cachedServerKey) return cachedServerKey;

  const res = await fetch("/api/security/public-key", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Unable to establish end-to-end encryption key.");
  }

  const descriptor = (await res.json()) as PublicKeyDescriptor;
  const cryptoKey = await window.crypto.subtle.importKey(
    "jwk",
    descriptor.publicKeyJwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );

  cachedServerKey = {
    keyId: descriptor.keyId,
    cryptoKey,
  };
  return cachedServerKey;
}

/**
 * Encrypts sensitive video, audio, or speech payloads client-side using
 * ephemeral AES-256-GCM wrapped with the server's RSA-OAEP-256 public key.
 */
export async function encryptPayload(
  endpoint: string,
  payload: unknown
): Promise<EncryptedEnvelope> {
  const { keyId, cryptoKey } = await getServerPublicKey();

  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt"]
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const aadObject = {
    endpoint,
    timestamp: Date.now(),
    nonce: window.crypto.randomUUID(),
  };

  const encoder = new TextEncoder();
  const aadBytes = encoder.encode(JSON.stringify(aadObject));
  const plaintextBytes = encoder.encode(JSON.stringify(payload));

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: aadBytes,
      tagLength: 128,
    },
    aesKey,
    plaintextBytes
  );

  const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
  const encryptedKeyBuffer = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    cryptoKey,
    rawAesKey
  );

  return {
    encrypted: true,
    keyId,
    encryptedKey: arrayBufferToBase64(encryptedKeyBuffer),
    iv: arrayBufferToBase64(iv),
    aad: arrayBufferToBase64(aadBytes),
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
  };
}
