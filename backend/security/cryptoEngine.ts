import crypto from "crypto";

export interface EncryptedEnvelope {
  encrypted: true;
  keyId: string;
  encryptedKey: string;
  iv: string;
  aad: string;
  ciphertext: string;
}

interface EnvelopeMetadata {
  endpoint: string;
  timestamp: number;
  nonce: string;
}

const REPLAY_WINDOW_MS = 5 * 60 * 1000;
const MAX_NONCE_CACHE = 10_000;

class CryptoEngine {
  private readonly keyId: string;
  private readonly publicKeyJwk: crypto.JsonWebKey;
  private readonly privateKey: crypto.KeyObject;
  private readonly seenNonces = new Map<string, number>();

  constructor() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    this.keyId = crypto.randomUUID();
    this.privateKey = privateKey;
    this.publicKeyJwk = publicKey.export({ format: "jwk" }) as crypto.JsonWebKey;
  }

  public getPublicKeyDescriptor() {
    return {
      keyId: this.keyId,
      algorithm: "RSA-OAEP",
      hash: "SHA-256",
      cipher: "AES-256-GCM",
      publicKeyJwk: this.publicKeyJwk,
    };
  }

  private pruneNonces(now: number): void {
    if (this.seenNonces.size < MAX_NONCE_CACHE / 2) return;
    for (const [nonce, ts] of this.seenNonces.entries()) {
      if (now - ts > REPLAY_WINDOW_MS) {
        this.seenNonces.delete(nonce);
      }
    }
    if (this.seenNonces.size > MAX_NONCE_CACHE) {
      this.seenNonces.clear();
    }
  }

  public decryptEnvelope<T = Record<string, unknown>>(
    envelope: EncryptedEnvelope,
    expectedEndpoint: string
  ): T {
    if (!envelope || envelope.encrypted !== true) {
      throw new SecurityEnvelopeError("Unencrypted payload rejected.", 400, "ENCRYPTION_REQUIRED");
    }

    if (envelope.keyId !== this.keyId) {
      throw new SecurityEnvelopeError(
        "Encryption key rotated; refresh public key.",
        409,
        "KEY_ROTATED"
      );
    }

    const encryptedKeyBuf = Buffer.from(envelope.encryptedKey, "base64");
    const ivBuf = Buffer.from(envelope.iv, "base64");
    const aadBuf = Buffer.from(envelope.aad, "base64");
    const ciphertextWithTag = Buffer.from(envelope.ciphertext, "base64");

    if (ivBuf.length !== 12 || ciphertextWithTag.length < 16) {
      throw new SecurityEnvelopeError("Malformed encrypted envelope.", 400, "INVALID_ENVELOPE");
    }

    let meta: EnvelopeMetadata;
    try {
      meta = JSON.parse(aadBuf.toString("utf8")) as EnvelopeMetadata;
    } catch {
      throw new SecurityEnvelopeError("Invalid authenticated metadata.", 400, "INVALID_AAD");
    }

    const now = Date.now();
    if (
      !meta ||
      typeof meta.endpoint !== "string" ||
      typeof meta.timestamp !== "number" ||
      typeof meta.nonce !== "string" ||
      meta.nonce.length < 8
    ) {
      throw new SecurityEnvelopeError("Incomplete authenticated metadata.", 400, "INVALID_AAD");
    }

    if (meta.endpoint !== expectedEndpoint) {
      throw new SecurityEnvelopeError("Endpoint binding mismatch.", 403, "ENDPOINT_MISMATCH");
    }

    if (Math.abs(now - meta.timestamp) > REPLAY_WINDOW_MS) {
      throw new SecurityEnvelopeError("Encrypted request expired.", 401, "REPLAY_EXPIRED");
    }

    this.pruneNonces(now);
    if (this.seenNonces.has(meta.nonce)) {
      throw new SecurityEnvelopeError("Duplicate request nonce detected.", 409, "REPLAY_NONCE");
    }
    this.seenNonces.set(meta.nonce, now);

    let aesKey: Buffer;
    try {
      aesKey = crypto.privateDecrypt(
        {
          key: this.privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha256",
        },
        encryptedKeyBuf
      );
    } catch {
      throw new SecurityEnvelopeError("Key unwrapping failed.", 400, "KEY_UNWRAP_FAILED");
    }

    if (aesKey.length !== 32) {
      throw new SecurityEnvelopeError("Invalid session key length.", 400, "INVALID_AES_KEY");
    }

    const tagOffset = ciphertextWithTag.length - 16;
    const ciphertext = ciphertextWithTag.subarray(0, tagOffset);
    const authTag = ciphertextWithTag.subarray(tagOffset);

    try {
      const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey, ivBuf);
      decipher.setAAD(aadBuf);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return JSON.parse(decrypted.toString("utf8")) as T;
    } catch {
      throw new SecurityEnvelopeError("Ciphertext authentication failed.", 400, "DECRYPT_FAILED");
    }
  }
}

export class SecurityEnvelopeError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const cryptoEngine = new CryptoEngine();
