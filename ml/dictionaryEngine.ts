import { Type } from "@google/genai";
import { generateWithRetry, getGeminiClient, sanitizePromptText } from "./geminiClient";

export interface AslDictionaryEntry {
  word: string;
  aslGloss: string;
  description: string;
  tips: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  category: string;
  similarSigns: string[];
  usage: string;
  nonManualMarkers?: string;
  dominantHand?: string;
}

export async function lookupAslSign(word: string): Promise<AslDictionaryEntry> {
  const ai = getGeminiClient();
  const cleanWord = sanitizePromptText(word, 64);

  const response = await generateWithRetry(() =>
    ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: `Provide an accurate American Sign Language (ASL) dictionary guide for the English word or short phrase: "${cleanWord}".`,
      config: {
        systemInstruction:
          "You are an expert American Sign Language (ASL-LEX) lexicographer. Return structured, accurate kinesiological instructions, ASL gloss notation, non-manual markers, mnemonic tips, and related signs.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            aslGloss: { type: Type.STRING },
            description: { type: Type.STRING },
            tips: { type: Type.STRING },
            difficulty: { type: Type.STRING, enum: ["beginner", "intermediate", "advanced"] },
            category: { type: Type.STRING },
            similarSigns: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            usage: { type: Type.STRING },
            nonManualMarkers: { type: Type.STRING },
            dominantHand: { type: Type.STRING },
          },
          required: [
            "word",
            "aslGloss",
            "description",
            "tips",
            "difficulty",
            "category",
            "similarSigns",
            "usage",
          ],
        },
      },
    })
  );

  const parsed = JSON.parse(response.text || "{}");
  return {
    word: parsed.word || cleanWord,
    aslGloss: parsed.aslGloss || cleanWord.toUpperCase(),
    description: parsed.description || "Sign description unavailable.",
    tips: parsed.tips || "Practice slowly in front of a mirror to verify handshape.",
    difficulty:
      parsed.difficulty === "intermediate" || parsed.difficulty === "advanced"
        ? parsed.difficulty
        : "beginner",
    category: parsed.category || "General",
    similarSigns: Array.isArray(parsed.similarSigns) ? parsed.similarSigns.slice(0, 6) : [],
    usage: parsed.usage || cleanWord.toUpperCase(),
    nonManualMarkers: parsed.nonManualMarkers,
    dominantHand: parsed.dominantHand,
  };
}
