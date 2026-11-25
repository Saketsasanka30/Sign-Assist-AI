import type { NextFunction, Request, Response } from "express";
import { ALLOWED_TONES, ALLOWED_VOICES } from "../../ml/speechSynthesizer";

const ALLOWED_VIDEO_MIMES = new Set([
  "video/mp4",
  "video/webm",
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/quicktime",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ALLOWED_LOCATIONS = new Set([
  "General",
  "Hospital",
  "Home",
  "School",
  "Workplace",
  "Store",
]);

const ALLOWED_TIMES = new Set(["Morning", "Afternoon", "Evening", "Night"]);

function normalizeContext(rawContext: any) {
  const ctx = rawContext && typeof rawContext === "object" ? rawContext : {};
  const location =
    typeof ctx.location === "string" && ALLOWED_LOCATIONS.has(ctx.location)
      ? ctx.location
      : "General";
  const timeOfDay =
    typeof ctx.timeOfDay === "string" && ALLOWED_TIMES.has(ctx.timeOfDay)
      ? ctx.timeOfDay
      : "Morning";
  const intent =
    typeof ctx.intent === "string" ? ctx.intent.trim().slice(0, 120) : "Communication";
  const vocabulary = Array.isArray(ctx.vocabulary)
    ? ctx.vocabulary
        .filter((item: unknown): item is string => typeof item === "string")
        .map((s: string) => s.trim().slice(0, 48))
        .filter(Boolean)
        .slice(0, 30)
    : [];

  return { location, timeOfDay, intent, vocabulary };
}

export function validateReconstructSpeech(req: Request, res: Response, next: NextFunction): void {
  const { rawInput, context } = req.body || {};
  if (typeof rawInput !== "string" || rawInput.trim().length === 0 || rawInput.length > 4000) {
    res.status(400).json({ error: "rawInput must be a non-empty string up to 4000 characters." });
    return;
  }
  req.body = {
    rawInput: rawInput.trim(),
    context: normalizeContext(context),
  };
  next();
}

export function validateTranslateVideo(req: Request, res: Response, next: NextFunction): void {
  const {
    videoBase64 = "",
    mimeType = "video/mp4",
    context,
    keyframes = [],
    kinematicSummary,
  } = req.body || {};

  if (typeof mimeType !== "string" || !ALLOWED_VIDEO_MIMES.has(mimeType.toLowerCase())) {
    res.status(400).json({ error: "Unsupported video MIME type." });
    return;
  }

  if (typeof videoBase64 !== "string" || videoBase64.length > 150_000_000) {
    res.status(400).json({ error: "Invalid or oversized video payload." });
    return;
  }

  const safeKeyframes = Array.isArray(keyframes)
    ? keyframes
        .slice(0, 10)
        .filter(
          (kf: any) =>
            kf &&
            typeof kf.timestampSec === "number" &&
            typeof kf.imageBase64 === "string" &&
            kf.imageBase64.length > 0 &&
            kf.imageBase64.length < 2_000_000
        )
        .map((kf: any) => ({
          timestampSec: Number(kf.timestampSec),
          imageBase64: kf.imageBase64,
        }))
    : [];

  if (!videoBase64 && safeKeyframes.length === 0) {
    res.status(400).json({ error: "Video data or keyframes are required." });
    return;
  }

  const safeKinematics =
    kinematicSummary && typeof kinematicSummary === "object"
      ? {
          framesAnalyzed: Number(kinematicSummary.framesAnalyzed) || 0,
          handsDetectedFrames: Number(kinematicSummary.handsDetectedFrames) || 0,
          dominantHandShapeHint: String(kinematicSummary.dominantHandShapeHint || "").slice(0, 120),
          motionDirection: String(kinematicSummary.motionDirection || "").slice(0, 120),
          verticalZone: String(kinematicSummary.verticalZone || "").slice(0, 64),
          handedness: String(kinematicSummary.handedness || "").slice(0, 64),
          fingerCurlSummary: String(kinematicSummary.fingerCurlSummary || "").slice(0, 160),
        }
      : undefined;

  req.body = {
    videoBase64,
    mimeType: mimeType.toLowerCase(),
    context: normalizeContext(context),
    keyframes: safeKeyframes,
    kinematicSummary: safeKinematics,
  };
  next();
}

export function validateSynthesizeSpeech(req: Request, res: Response, next: NextFunction): void {
  const { text, voice = "Kore", tone = "Neutral" } = req.body || {};
  if (typeof text !== "string" || text.trim().length === 0 || text.length > 2000) {
    res.status(400).json({ error: "text must be a non-empty string up to 2000 characters." });
    return;
  }
  if (!ALLOWED_VOICES.includes(voice)) {
    res.status(400).json({ error: "Unsupported voice profile." });
    return;
  }
  if (!ALLOWED_TONES.includes(tone)) {
    res.status(400).json({ error: "Unsupported voice tone." });
    return;
  }
  req.body = { text: text.trim(), voice, tone };
  next();
}

export function validateDictionaryLookup(req: Request, res: Response, next: NextFunction): void {
  const word = typeof req.query.word === "string" ? req.query.word.trim() : "";
  if (!word || !/^[a-zA-Z0-9\s'-]{1,64}$/.test(word)) {
    res.status(400).json({ error: "Provide a valid word or short phrase (1-64 characters)." });
    return;
  }
  req.query.word = word;
  next();
}
