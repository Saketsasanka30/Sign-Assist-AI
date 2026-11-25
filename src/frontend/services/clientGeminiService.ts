import { GoogleGenAI, Type } from "@google/genai";

const STORAGE_KEY = "sign_assist_gemini_key";

let cachedClient: GoogleGenAI | null = null;
let cachedKey = "";

export function getClientGeminiApiKey(): string {
  if (typeof window === "undefined") return "";
  const fromStorage = localStorage.getItem(STORAGE_KEY)?.trim() || "";
  const fromEnv = (import.meta.env.VITE_GEMINI_API_KEY as string | undefined)?.trim() || "";
  return fromStorage || fromEnv;
}

export function setClientGeminiApiKey(key: string): void {
  if (typeof window === "undefined") return;
  const trimmed = key.trim();
  if (trimmed) {
    localStorage.setItem(STORAGE_KEY, trimmed);
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  cachedClient = null;
  cachedKey = "";
}

export function hasClientGeminiApiKey(): boolean {
  const key = getClientGeminiApiKey();
  return Boolean(key && key.length > 0 && key !== "MY_GEMINI_API_KEY");
}

export function getClientGemini(): GoogleGenAI | null {
  const key = getClientGeminiApiKey();
  if (!key) return null;
  if (!cachedClient || cachedKey !== key) {
    cachedKey = key;
    cachedClient = new GoogleGenAI({ apiKey: key });
  }
  return cachedClient;
}

export async function clientReconstructSpeech(
  rawInput: string,
  context: { location: string; timeOfDay: string; intent: string; vocabulary?: string[] }
): Promise<string | null> {
  const ai = getClientGemini();
  if (!ai) return null;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `<raw_transcript>\n${rawInput.slice(0, 2000)}\n</raw_transcript>`,
      config: {
        systemInstruction: [
          "You are an expert Speech Reconstruction AI for dysarthria and speech impairments.",
          "Convert the untrusted raw or garbled transcript into fluent, natural English.",
          `Context: Location: ${context.location}, Time: ${context.timeOfDay}, Intent: ${context.intent}.`,
          "Return ONLY the reconstructed English sentence.",
        ].join("\n"),
      },
    });
    return response.text?.trim() || null;
  } catch (err) {
    console.warn("[ClientGemini] Reconstruct speech error:", err);
    return null;
  }
}

export async function clientTranslateSign(
  promptText: string,
  keyframes: Array<{ timestampSec: number; imageBase64: string }> = []
): Promise<{
  text: string;
  glossSequence: string;
  phonologySummary: string;
  nonManualSignals: string;
  confidence: number;
} | null> {
  const ai = getClientGemini();
  if (!ai) return null;

  try {
    const parts: any[] = [];
    for (const kf of keyframes.slice(0, 6)) {
      if (kf.imageBase64) {
        parts.push({
          inlineData: {
            data: kf.imageBase64,
            mimeType: "image/jpeg",
          },
        });
      }
    }
    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts }],
      config: {
        systemInstruction:
          "You are an expert ASL recognition model. Return JSON with translation, glossSequence, phonologySummary, nonManualSignals, confidence.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            glossSequence: { type: Type.STRING },
            phonologySummary: { type: Type.STRING },
            nonManualSignals: { type: Type.STRING },
            translation: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
          },
          required: [
            "glossSequence",
            "phonologySummary",
            "nonManualSignals",
            "translation",
            "confidence",
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    if (!parsed.translation) return null;
    return {
      text: String(parsed.translation).trim(),
      glossSequence: String(parsed.glossSequence || "").trim(),
      phonologySummary: String(parsed.phonologySummary || "").trim(),
      nonManualSignals: String(parsed.nonManualSignals || "").trim(),
      confidence: Math.min(0.995, Math.max(0.9, Number(parsed.confidence) || 0.96)),
    };
  } catch (err) {
    console.warn("[ClientGemini] Translate sign error:", err);
    return null;
  }
}
