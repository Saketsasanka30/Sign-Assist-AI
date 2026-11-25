import { generateWithRetry, getGeminiClient, sanitizePromptText } from "./geminiClient";

export const ALLOWED_VOICES = ["Kore", "Charon", "Fenrir", "Aoede", "Puck", "Leda"] as const;
export const ALLOWED_TONES = ["Neutral", "Friendly", "Professional", "Calm", "Empathetic"] as const;

export type SynthesisVoice = (typeof ALLOWED_VOICES)[number];
export type SynthesisTone = (typeof ALLOWED_TONES)[number];

export async function synthesizeNeuralSpeech(
  text: string,
  voice: SynthesisVoice = "Kore",
  tone: SynthesisTone = "Neutral"
): Promise<string | null> {
  const ai = getGeminiClient();
  const cleanText = sanitizePromptText(text, 1500);

  const response = await generateWithRetry(() =>
    ai.models.generateContent({
      model: "gemini-3.8-flash-lite-tts",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: cleanText,
              speechMetadata: {
                style: `${tone}, clear and natural`,
              },
            },
          ],
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

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) return null;
  return `data:audio/wav;base64,${base64Audio}`;
}
