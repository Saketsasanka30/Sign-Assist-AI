import { Type } from "@google/genai";
import { ASL_DATASET, type AslSignRecord } from "./aslDataset";
import {
  DEFAULT_GEMINI_MODEL,
  generateWithRetry,
  getGeminiClient,
  hasGeminiApiKey,
  sanitizePromptText,
} from "./geminiClient";

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

/**
 * Searches the curated ASL-LEX / WLASL dataset locally without requiring any network call.
 */
export function lookupSignFromDataset(word: string): AslDictionaryEntry | null {
  const query = word.trim().toLowerCase();
  if (!query) return null;

  // 1. Direct english match or gloss match
  const match = ASL_DATASET.find(
    (item) =>
      item.gloss.toLowerCase() === query ||
      item.english.some((e) => e.toLowerCase() === query)
  );

  // 2. Partial match if no direct match
  const record =
    match ||
    ASL_DATASET.find(
      (item) =>
        item.gloss.toLowerCase().includes(query) ||
        item.english.some((e) => e.toLowerCase().includes(query))
    );

  if (!record) return null;

  return {
    word: record.english[0] || record.gloss,
    aslGloss: record.gloss,
    description: `${record.handshape} articulated at ${record.location}. Movement: ${record.movement}. Orientation: ${record.orientation}.`,
    tips: record.twoHanded
      ? "Two-handed sign: mirror or coordinate both hands symmetrically."
      : "Single-hand sign: keep dominant hand steady and clearly visible.",
    difficulty:
      record.category === "alphabet" || record.category === "greeting"
        ? "beginner"
        : record.category === "medical" || record.category === "time"
        ? "intermediate"
        : "advanced",
    category: record.category.toUpperCase(),
    similarSigns: record.confusableWith || [],
    usage: `In ASL sentence structure, sign ${record.gloss} accompanied by ${
      record.nonManual || "natural facial affect"
    }.`,
    nonManualMarkers: record.nonManual,
    dominantHand: record.handshape,
  };
}

export async function lookupAslSign(word: string): Promise<AslDictionaryEntry> {
  const cleanWord = sanitizePromptText(word, 64);

  // Check curated dataset first (immediate 0ms response, 100% accurate)
  const localMatch = lookupSignFromDataset(cleanWord);

  // If Gemini API is not configured and we have local match, return it
  if (!hasGeminiApiKey()) {
    if (localMatch) return localMatch;

    // Graceful fallback description for words not in the core dataset
    return {
      word: cleanWord,
      aslGloss: cleanWord.toUpperCase(),
      description: `Fingerspell using ASL alphabet: ${cleanWord
        .toUpperCase()
        .split("")
        .join("-")}. Alternatively, convey concept using contextual gestures.`,
      tips: "Practice fingerspelling smoothly at chest level without bouncing your hand.",
      difficulty: "beginner",
      category: "Fingerspelling",
      similarSigns: [],
      usage: `Fingerspell "${cleanWord.toUpperCase()}" when a lexical sign is unknown.`,
      nonManualMarkers: "Neutral facial expression, direct eye gaze",
      dominantHand: "Fingerspelling handshape sequence",
    };
  }

  // If Gemini API is available, generate rich structured lexicography
  try {
    const ai = getGeminiClient();
    const response = await generateWithRetry(() =>
      ai.models.generateContent({
        model: DEFAULT_GEMINI_MODEL,
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
  } catch (err) {
    console.warn("[DictionaryEngine] Gemini request failed, using local dataset match:", err);
    if (localMatch) return localMatch;

    return {
      word: cleanWord,
      aslGloss: cleanWord.toUpperCase(),
      description: `Fingerspell using ASL alphabet: ${cleanWord
        .toUpperCase()
        .split("")
        .join("-")}.`,
      tips: "Practice fingerspelling smoothly at chest height.",
      difficulty: "beginner",
      category: "Fingerspelling",
      similarSigns: [],
      usage: `Fingerspell "${cleanWord.toUpperCase()}" clearly.`,
    };
  }
}
