import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

export const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let cachedAiClient: GoogleGenAI | null = null;

export function hasGeminiApiKey(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim();
  return Boolean(key && key.length > 0 && key !== "MY_GEMINI_API_KEY");
}

export function getGeminiClient(): GoogleGenAI {
  if (!hasGeminiApiKey()) {
    throw new Error("AI service is not configured on the server.");
  }
  if (!cachedAiClient) {
    cachedAiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return cachedAiClient;
}

/**
 * Retries transient Gemini API errors (503 high demand, 429 rate limits) with exponential backoff.
 */
export async function generateWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1500
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const msg = String(error?.message || "");
      const isTransient =
        msg.includes("503") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("429") ||
        msg.includes("Resource has been exhausted") ||
        msg.includes("Quota exceeded");

      if (isTransient && attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      if (msg.includes("429") || msg.includes("Quota exceeded")) {
        throw new Error("AI service quota reached. Please wait a minute before retrying.");
      }

      throw error;
    }
  }
  throw lastError;
}

/**
 * Strips control characters and isolates untrusted input to reduce prompt injection risk.
 */
export function sanitizePromptText(value: string, maxLength = 2000): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, maxLength);
}
