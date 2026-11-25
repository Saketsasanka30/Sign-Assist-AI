import { Type } from "@google/genai";
import { buildAslDatasetContext } from "./aslDataset";
import { generateWithRetry, getGeminiClient, sanitizePromptText } from "./geminiClient";
import type { SpeechContextInput } from "./speechReconstructor";

export interface KeyframeSample {
  timestampSec: number;
  imageBase64: string;
}

export interface KinematicSummary {
  framesAnalyzed: number;
  handsDetectedFrames: number;
  dominantHandShapeHint: string;
  motionDirection: string;
  verticalZone: string;
  handedness: string;
  fingerCurlSummary: string;
}

export interface AslTranslationResult {
  text: string;
  glossSequence: string;
  phonologySummary: string;
  nonManualSignals: string;
  confidence: number;
}

function normalizeVideoMimeType(mimeType: string): string {
  const base = (mimeType || "video/mp4").split(";")[0].trim().toLowerCase();
  if (base === "video/webm" || base === "video/mp4" || base === "video/quicktime") {
    return base;
  }
  return "video/mp4";
}

export async function translateAslVideo(
  videoBase64: string,
  mimeType: string,
  context: SpeechContextInput,
  keyframes: KeyframeSample[] = [],
  kinematicSummary?: KinematicSummary
): Promise<AslTranslationResult> {
  const ai = getGeminiClient();

  const cleanVocab = (context.vocabulary || [])
    .slice(0, 30)
    .map((v) => sanitizePromptText(v, 48))
    .filter(Boolean);

  const safeContext = {
    location: sanitizePromptText(context.location || "General", 64),
    timeOfDay: sanitizePromptText(context.timeOfDay || "Morning", 32),
    intent: sanitizePromptText(context.intent || "Communication", 120),
  };

  const datasetReference = buildAslDatasetContext(cleanVocab);

  const kinematicBlock = kinematicSummary
    ? [
        "CLIENT MEDIAPIPE SKELETAL KINEMATIC TELEMETRY:",
        `- Frames Analyzed: ${kinematicSummary.framesAnalyzed} (Hands detected in ${kinematicSummary.handsDetectedFrames} frames)`,
        `- Handedness: ${sanitizePromptText(kinematicSummary.handedness, 64)}`,
        `- Geometric Handshape Hint: ${sanitizePromptText(kinematicSummary.dominantHandShapeHint, 120)}`,
        `- Finger Curl State: ${sanitizePromptText(kinematicSummary.fingerCurlSummary, 160)}`,
        `- Vertical Articulation Zone: ${sanitizePromptText(kinematicSummary.verticalZone, 64)}`,
        `- Wrist Trajectory: ${sanitizePromptText(kinematicSummary.motionDirection, 120)}`,
      ].join("\n")
    : "CLIENT KINEMATIC TELEMETRY: Not available — rely on video + high-resolution sequential keyframes.";

  const systemInstruction = [
    "You are an expert American Sign Language (ASL) & Multimodal Speech Recognition Engine.",
    "Perform two-stage phonological decoding using the video clip, sequential high-resolution keyframes, skeletal telemetry, and the ASL-LEX/WLASL reference dataset below.",
    "",
    "DECODING PROCEDURE:",
    "1. Observe the exact sequence of frames from start to finish: identify dominant/non-dominant handshape (Stokoe prime), anatomical location (forehead, chin, chest, neutral space, wrist), palm orientation, and motion path (tap, circle, arc outward, nod, snap).",
    "2. Observe non-manual markers (eyebrow raise = yes/no question, furrowed brows = WH-question, headshake = negation, head nod = affirmation, facial affect).",
    "3. Check if any spoken words or dysarthric audio are present in the video audio track.",
    "4. Match the observed phonological signature against the ASL Dataset and Minimal-Pair Disambiguation Rules.",
    "5. Apply ASL grammar rules (Topic-Comment, WH-final) and situational context to produce the exact, fluent English translation.",
    '6. Only return "No signs or speech detected." if no hands, gestures, or speech appear in the frames/video.',
    "",
    datasetReference,
    "",
    `SITUATIONAL CONTEXT: ${JSON.stringify(safeContext)} | Priority Vocabulary: ${
      cleanVocab.length > 0 ? cleanVocab.join(", ") : "Standard ASL Lexicon"
    }`,
  ].join("\n");

  const cleanMime = normalizeVideoMimeType(mimeType);
  const validKeyframes = keyframes.slice(0, 8).filter((kf) => Boolean(kf.imageBase64));
  const isSingleImageMode = !videoBase64 && validKeyframes.length === 1;

  const runInference = async (includeRawVideo: boolean) => {
    const parts: any[] = [];

    if (includeRawVideo && videoBase64 && videoBase64.length > 0 && videoBase64.length < 18_000_000) {
      parts.push({
        inlineData: {
          data: videoBase64,
          mimeType: cleanMime,
        },
      });
    }

    for (const kf of validKeyframes) {
      parts.push({
        inlineData: {
          data: kf.imageBase64,
          mimeType: "image/jpeg",
        },
      });
    }

    const promptText = isSingleImageMode
      ? `${kinematicBlock}\n\nThis is a static ASL dataset image. Carefully inspect thumb placement, curled vs extended fingers, and palm orientation against the FINGERSPELLING REFERENCE (A-Z) and ASL dataset. If it shows an ASL fingerspelling letter, state the letter clearly (e.g. "Letter A" or the exact recognized sign). Return JSON matching the required schema.`
      : `${kinematicBlock}\n\nAnalyze the ${
          includeRawVideo && videoBase64 ? "video and " : ""
        }${validKeyframes.length} sequential temporal keyframes carefully. Return JSON matching the required schema.`;

    parts.push({ text: promptText });

    return generateWithRetry(() =>
      ai.models.generateContent({
        model: "gemini-4-hydrogen",
        contents: [{ parts }],
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              glossSequence: {
                type: Type.STRING,
                description:
                  "Detected ASL glosses in uppercase (e.g. THANK-YOU or NICE MEET YOU), or NONE.",
              },
              phonologySummary: {
                type: Type.STRING,
                description: "Concise observation of handshape, location, and movement.",
              },
              nonManualSignals: {
                type: Type.STRING,
                description: "Observed facial markers (e.g. brow raise, head nod, neutral).",
              },
              translation: {
                type: Type.STRING,
                description: "Final fluent English translation of the ASL sign(s) or speech.",
              },
              confidence: {
                type: Type.NUMBER,
                description: "Confidence score between 0.0 and 1.0.",
              },
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
      })
    );
  };

  let response;
  try {
    response = await runInference(Boolean(videoBase64));
  } catch (err: any) {
    const msg = String(err?.message || "");
    // If raw video codec/container fails and we have extracted keyframes, fall back cleanly to keyframe sequence
    if (
      validKeyframes.length > 0 &&
      videoBase64 &&
      (msg.includes("400") || msg.includes("INVALID_ARGUMENT") || msg.includes("Unsupported"))
    ) {
      response = await runInference(false);
    } else {
      throw err;
    }
  }

  const parsed = JSON.parse(response.text || "{}");
  return {
    text:
      typeof parsed.translation === "string" && parsed.translation.trim()
        ? parsed.translation.trim()
        : "No signs or speech detected.",
    glossSequence: typeof parsed.glossSequence === "string" ? parsed.glossSequence.trim() : "",
    phonologySummary:
      typeof parsed.phonologySummary === "string" ? parsed.phonologySummary.trim() : "",
    nonManualSignals:
      typeof parsed.nonManualSignals === "string" ? parsed.nonManualSignals.trim() : "",
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.85)),
  };
}
