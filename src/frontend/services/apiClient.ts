import type { KeyframeSample, KinematicSummary } from "../ml/videoAnalyzer";
import { encryptPayload, invalidateServerPublicKey } from "../security/e2ee";
import type {
  AuraVoice,
  EmotionalTone,
  SignDictResult,
  SignTranslationResponse,
  SpeechContext,
} from "../types";

async function encryptedPost<T>(endpoint: string, body: unknown): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const envelope = await encryptPayload(endpoint, body);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envelope),
    });

    if (res.ok) {
      return (await res.json()) as T;
    }

    const errData = await res.json().catch(() => ({ error: "Request failed", code: "" }));
    if (res.status === 409 && errData.code === "KEY_ROTATED" && attempt === 0) {
      invalidateServerPublicKey();
      continue;
    }

    throw new Error(errData.error || `Request failed (${res.status})`);
  }

  throw new Error("Encrypted request could not be completed.");
}

export async function reconstructSpeech(
  rawInput: string,
  context: SpeechContext
): Promise<string> {
  try {
    const data = await encryptedPost<{ text: string }>("/api/reconstruct-speech", {
      rawInput,
      context,
    });
    return data.text || "Unable to reconstruct speech.";
  } catch (error) {
    return `Error: ${(error as Error).message}`;
  }
}

export async function synthesizeSpeech(
  text: string,
  voice: AuraVoice = "Kore",
  _volume = 1.0,
  _pitch = 1.0,
  tone: EmotionalTone = "Neutral"
): Promise<string | null> {
  try {
    const data = await encryptedPost<{ audio?: string }>("/api/synthesize-speech", {
      text,
      voice,
      tone,
    });
    return data.audio ?? null;
  } catch {
    return null;
  }
}

export async function translateSignVideo(
  videoBase64: string,
  context: SpeechContext,
  mimeType = "video/mp4",
  keyframes: KeyframeSample[] = [],
  kinematicSummary?: KinematicSummary
): Promise<SignTranslationResponse> {
  try {
    const data = await encryptedPost<SignTranslationResponse>("/api/translate-video", {
      videoBase64,
      context,
      mimeType,
      keyframes,
      kinematicSummary,
    });
    return {
      text: data.text || "No signs or speech detected.",
      glossSequence: data.glossSequence || "",
      phonologySummary: data.phonologySummary || "",
      nonManualSignals: data.nonManualSignals || "",
      confidence: typeof data.confidence === "number" ? data.confidence : 0.85,
    };
  } catch (error) {
    return {
      text: `Error: ${(error as Error).message}`,
      glossSequence: "",
      phonologySummary: "",
      nonManualSignals: "",
      confidence: 0,
    };
  }
}

export async function lookupSign(word: string): Promise<SignDictResult> {
  const res = await fetch(`/api/dictionary/sign?word=${encodeURIComponent(word)}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: "Lookup failed" }));
    throw new Error(errData.error || `Lookup failed (${res.status})`);
  }
  return (await res.json()) as SignDictResult;
}
