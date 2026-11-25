import { Router } from "express";
import { reconstructDysarthricSpeech } from "../../ml/speechReconstructor";
import { translateAslVideo } from "../../ml/signTranslator";
import { synthesizeNeuralSpeech } from "../../ml/speechSynthesizer";
import { lookupAslSign } from "../../ml/dictionaryEngine";
import { cryptoEngine } from "../security/cryptoEngine";
import { decryptPayloadMiddleware } from "../middleware/decryptPayload";
import { createRateLimiter } from "../middleware/rateLimiter";
import {
  validateDictionaryLookup,
  validateReconstructSpeech,
  validateSynthesizeSpeech,
  validateTranslateVideo,
} from "../middleware/validation";

export const apiRouter = Router();

const generalApiLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 90 });
const mlInferenceLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 25 });

apiRouter.use(generalApiLimiter);

function mapMlError(err: any, fallbackMessage: string): { status: number; message: string } {
  const rawMsg = String(err?.message || "");
  if (rawMsg.includes("not configured")) {
    return {
      status: 503,
      message: "Gemini API key is not configured. Check GEMINI_API_KEY in Settings > Secrets.",
    };
  }
  if (rawMsg.includes("API_KEY_INVALID") || rawMsg.includes("PERMISSION_DENIED") || rawMsg.includes("403")) {
    return {
      status: 403,
      message: "Gemini API key is invalid or unauthorized. Please check Settings > Secrets.",
    };
  }
  if (rawMsg.includes("quota") || rawMsg.includes("429") || rawMsg.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      message: "AI service quota reached. Please wait a moment before retrying.",
    };
  }
  return {
    status: 500,
    message: fallbackMessage,
  };
}

apiRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    encryption: "RSA-OAEP-256 + AES-256-GCM",
  });
});

apiRouter.get("/security/public-key", (_req, res) => {
  res.json(cryptoEngine.getPublicKeyDescriptor());
});

apiRouter.post(
  "/reconstruct-speech",
  mlInferenceLimiter,
  decryptPayloadMiddleware,
  validateReconstructSpeech,
  async (req, res) => {
    try {
      const { rawInput, context } = req.body;
      const text = await reconstructDysarthricSpeech(rawInput, context);
      res.json({ text });
    } catch (err: any) {
      console.error("[API /reconstruct-speech]", err?.message || "Unknown error");
      const mapped = mapMlError(err, "Speech reconstruction service unavailable.");
      res.status(mapped.status).json({ error: mapped.message });
    }
  }
);

apiRouter.post(
  "/translate-video",
  mlInferenceLimiter,
  decryptPayloadMiddleware,
  validateTranslateVideo,
  async (req, res) => {
    try {
      const { videoBase64, mimeType, context, keyframes, kinematicSummary } = req.body;
      const result = await translateAslVideo(
        videoBase64,
        mimeType,
        context,
        keyframes,
        kinematicSummary
      );
      res.json(result);
    } catch (err: any) {
      console.error("[API /translate-video]", err?.message || "Unknown error");
      const mapped = mapMlError(err, "Video translation service unavailable.");
      res.status(mapped.status).json({ error: mapped.message });
    }
  }
);

apiRouter.post(
  "/synthesize-speech",
  mlInferenceLimiter,
  decryptPayloadMiddleware,
  validateSynthesizeSpeech,
  async (req, res) => {
    try {
      const { text, voice, tone } = req.body;
      const audio = await synthesizeNeuralSpeech(text, voice, tone);
      if (!audio) {
        res.status(404).json({ error: "Audio could not be generated." });
        return;
      }
      res.json({ audio });
    } catch (err: any) {
      console.error("[API /synthesize-speech]", err?.message || "Unknown error");
      const mapped = mapMlError(err, "Speech synthesis service unavailable.");
      res.status(mapped.status).json({ error: mapped.message });
    }
  }
);

apiRouter.get(
  "/dictionary/sign",
  mlInferenceLimiter,
  validateDictionaryLookup,
  async (req, res) => {
    try {
      const word = req.query.word as string;
      const entry = await lookupAslSign(word);
      res.json(entry);
    } catch (err: any) {
      console.error("[API /dictionary/sign]", err?.message || "Unknown error");
      const mapped = mapMlError(err, "ASL dictionary lookup service unavailable.");
      res.status(mapped.status).json({ error: mapped.message });
    }
  }
);
