import {
  DEFAULT_GEMINI_MODEL,
  generateWithRetry,
  getGeminiClient,
  hasGeminiApiKey,
  sanitizePromptText,
} from "./geminiClient";

export const ALLOWED_VOICES = ["Kore", "Charon", "Fenrir", "Aoede", "Puck", "Leda"] as const;
export const ALLOWED_TONES = ["Neutral", "Friendly", "Professional", "Calm", "Empathetic"] as const;

export type SynthesisVoice = (typeof ALLOWED_VOICES)[number];
export type SynthesisTone = (typeof ALLOWED_TONES)[number];

// TTS model — gemini-2.5-flash supports native audio output
const TTS_MODEL = "gemini-2.5-flash-preview-tts";

export async function synthesizeNeuralSpeech(
  text: string,
  voice: SynthesisVoice = "Kore",
  tone: SynthesisTone = "Neutral"
): Promise<string | null> {
  if (!hasGeminiApiKey()) {
    console.warn("[SpeechSynthesizer] Gemini API key not configured; speech synthesis unavailable.");
    return null;
  }

  const ai = getGeminiClient();
  const cleanText = sanitizePromptText(text, 1500);

  // Build a natural-sounding style instruction
  const toneMap: Record<SynthesisTone, string> = {
    Neutral: "Speak clearly and naturally.",
    Friendly: "Speak in a warm, upbeat, and friendly tone.",
    Professional: "Speak in a confident and professional manner.",
    Calm: "Speak in a soft, slow, and soothing tone.",
    Empathetic: "Speak gently with empathy and care.",
  };

  const styledText = `${toneMap[tone]} ${cleanText}`;

  try {
    const response = await generateWithRetry(() =>
      ai.models.generateContent({
        model: TTS_MODEL,
        contents: [
          {
            role: "user",
            parts: [{ text: styledText }],
          },
        ],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voice,
              },
            },
          },
        },
      })
    );

    const inlineData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!inlineData?.data) return null;

    const mimeType = inlineData.mimeType || "audio/wav";
    return `data:${mimeType};base64,${inlineData.data}`;
  } catch (err: any) {
    const msg = String(err?.message || "");

    // If the preview TTS model fails, fall back to a standard text generation acknowledgement
    if (msg.includes("404") || msg.includes("not found") || msg.includes("model")) {
      console.warn("[SpeechSynthesizer] TTS model unavailable, trying Flash TTS fallback.");
      try {
        const fallbackResponse = await generateWithRetry(() =>
          ai.models.generateContent({
            model: "gemini-2.0-flash-exp",
            contents: [
              {
                role: "user",
                parts: [{ text: styledText }],
              },
            ],
            config: {
              responseModalities: ["AUDIO"],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voice },
                },
              },
            },
          })
        );
        const inlineData = fallbackResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (!inlineData?.data) return null;
        return `data:${inlineData.mimeType || "audio/wav"};base64,${inlineData.data}`;
      } catch {
        console.warn("[SpeechSynthesizer] All TTS models unavailable.");
        return null;
      }
    }
    throw err;
  }
}
