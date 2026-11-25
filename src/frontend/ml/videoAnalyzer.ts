import { FilesetResolver, HandLandmarker, type NormalizedLandmark } from "@mediapipe/tasks-vision";

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

export interface VideoAnalysisBundle {
  keyframes: KeyframeSample[];
  kinematicSummary?: KinematicSummary;
}

let landmarkerPromise: Promise<HandLandmarker | null> | null = null;

async function getHandLandmarker(): Promise<HandLandmarker | null> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
        const modelPromise = HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU",
          },
          runningMode: "IMAGE",
          numHands: 2,
          minHandDetectionConfidence: 0.45,
          minHandPresenceConfidence: 0.45,
        });

        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 5000)
        );
        return await Promise.race([modelPromise, timeoutPromise]);
      } catch {
        return null;
      }
    })();
  }
  return landmarkerPromise;
}

function dist(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));
}

function classifyStaticHandshape(landmarks: NormalizedLandmark[]): {
  shapeHint: string;
  curlSummary: string;
} {
  const wrist = landmarks[0];
  const thumbExt = dist(landmarks[4], landmarks[17]) > dist(landmarks[3], landmarks[17]) * 1.12;
  const indexExt = dist(landmarks[8], wrist) > dist(landmarks[6], wrist) * 1.15;
  const middleExt = dist(landmarks[12], wrist) > dist(landmarks[10], wrist) * 1.15;
  const ringExt = dist(landmarks[16], wrist) > dist(landmarks[14], wrist) * 1.15;
  const pinkyExt = dist(landmarks[20], wrist) > dist(landmarks[18], wrist) * 1.15;

  const pinchThumbIndex = dist(landmarks[4], landmarks[8]) < dist(landmarks[5], landmarks[17]) * 0.45;

  const states = [
    `Thumb:${thumbExt ? "open" : "tucked"}`,
    `Index:${indexExt ? "open" : "curled"}`,
    `Middle:${middleExt ? "open" : "curled"}`,
    `Ring:${ringExt ? "open" : "curled"}`,
    `Pinky:${pinkyExt ? "open" : "curled"}`,
  ].join(", ");

  let shapeHint = "Mixed/Transition";
  if (pinchThumbIndex && middleExt && ringExt && pinkyExt) {
    shapeHint = "F-hand / Pinched Circle";
  } else if (thumbExt && indexExt && !middleExt && !ringExt && pinkyExt) {
    shapeHint = "ILY (I-Love-You) handshape";
  } else if (thumbExt && !indexExt && !middleExt && !ringExt && pinkyExt) {
    shapeHint = "Y-handshape";
  } else if (thumbExt && indexExt && !middleExt && !ringExt && !pinkyExt) {
    shapeHint = "L-handshape";
  } else if (!indexExt && !middleExt && !ringExt && !pinkyExt) {
    shapeHint = thumbExt ? "A-hand / Thumbs-up fist" : "Closed S/E-fist";
  } else if (indexExt && !middleExt && !ringExt && !pinkyExt) {
    shapeHint = "1-hand (Index extended)";
  } else if (indexExt && middleExt && !ringExt && !pinkyExt) {
    const spread = dist(landmarks[8], landmarks[12]) > dist(landmarks[5], landmarks[9]) * 1.3;
    shapeHint = spread ? "V-hand" : "U/H-hand";
  } else if (indexExt && middleExt && ringExt && !pinkyExt) {
    shapeHint = "W-hand (3 fingers extended)";
  } else if (indexExt && middleExt && ringExt && pinkyExt) {
    const fingerSpread = dist(landmarks[8], landmarks[20]) > dist(landmarks[5], landmarks[17]) * 1.45;
    shapeHint = fingerSpread ? "Open 5-hand" : "Flat B-hand";
  }

  return { shapeHint, curlSummary: states };
}

/**
 * Extracts 8 crisp temporal keyframes from a video Blob/File and computes MediaPipe
 * 21-point hand skeletal kinematics when available.
 */
export async function analyzeSignVideoClient(blob: Blob): Promise<VideoAnalysisBundle> {
  const objectUrl = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = objectUrl;

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Video metadata timeout")), 6000);
      video.onloadedmetadata = () => {
        clearTimeout(timeout);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("Could not decode video"));
      };
    });

    // Some WebM blobs report Infinity duration until sought
    let duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      video.currentTime = 1e6;
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve();
        setTimeout(resolve, 600);
      });
      duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 3.0;
    }

    const sampleCount = 8;
    const canvas = document.createElement("canvas");
    const targetWidth = Math.min(640, video.videoWidth || 640);
    const scale = targetWidth / (video.videoWidth || 640);
    const targetHeight = Math.round((video.videoHeight || 360) * scale);
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");

    const landmarker = await getHandLandmarker();
    const keyframes: KeyframeSample[] = [];
    const wristPositions: { x: number; y: number }[] = [];
    const shapeCounts = new Map<string, number>();
    let lastCurlSummary = "";
    let handedness = "Unknown";
    let handsDetectedFrames = 0;

    for (let i = 0; i < sampleCount; i++) {
      const ratio = 0.08 + (i / (sampleCount - 1)) * 0.84;
      const t = Math.max(0.02, Math.min(duration - 0.02, duration * ratio));

      video.currentTime = t;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 450);
        video.onseeked = () => {
          clearTimeout(timer);
          resolve();
        };
      });

      if (!ctx) continue;
      ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      const imageBase64 = dataUrl.split(",")[1];
      if (imageBase64) {
        keyframes.push({ timestampSec: Number(t.toFixed(2)), imageBase64 });
      }

      if (landmarker) {
        try {
          const detection = landmarker.detect(canvas);
          if (detection.landmarks && detection.landmarks.length > 0) {
            handsDetectedFrames += 1;
            const primaryHand = detection.landmarks[0];
            wristPositions.push({ x: primaryHand[0].x, y: primaryHand[0].y });

            const { shapeHint, curlSummary } = classifyStaticHandshape(primaryHand);
            shapeCounts.set(shapeHint, (shapeCounts.get(shapeHint) || 0) + 1);
            lastCurlSummary = curlSummary;

            if (detection.handedness?.[0]?.[0]?.categoryName) {
              handedness =
                detection.landmarks.length > 1
                  ? `Two-handed (primary: ${detection.handedness[0][0].categoryName})`
                  : `${detection.handedness[0][0].categoryName} hand`;
            }
          }
        } catch {
          // Ignore single-frame detection issues
        }
      }
    }

    let kinematicSummary: KinematicSummary | undefined;
    if (landmarker) {
      const dominantShape =
        [...shapeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "Not detected";

      let avgY = 0.5;
      let motionDirection = "Insufficient landmarks";
      if (wristPositions.length >= 2) {
        avgY =
          wristPositions.reduce((sum, p) => sum + p.y, 0) / wristPositions.length;
        const dx = wristPositions[wristPositions.length - 1].x - wristPositions[0].x;
        const dy = wristPositions[wristPositions.length - 1].y - wristPositions[0].y;
        const totalPath = wristPositions.slice(1).reduce((acc, p, idx) => {
          const prev = wristPositions[idx];
          return acc + Math.hypot(p.x - prev.x, p.y - prev.y);
        }, 0);

        if (totalPath < 0.06) {
          motionDirection = "Stationary / small finger articulation";
        } else if (Math.abs(dx) + Math.abs(dy) < totalPath * 0.35) {
          motionDirection = "Repeating / circular / oscillatory path";
        } else {
          const horiz = Math.abs(dx) > 0.08 ? (dx > 0 ? "lateral-right" : "lateral-left") : "";
          const vert = Math.abs(dy) > 0.08 ? (dy > 0 ? "downward" : "upward") : "";
          motionDirection = [vert, horiz].filter(Boolean).join(" ") || "Moderate arc";
        }
      }

      const verticalZone =
        avgY < 0.32
          ? "Upper Face / Forehead"
          : avgY < 0.5
          ? "Lower Face / Chin / Mouth"
          : avgY < 0.72
          ? "Chest / Upper Torso"
          : "Lower Neutral Space";

      kinematicSummary = {
        framesAnalyzed: keyframes.length,
        handsDetectedFrames,
        dominantHandShapeHint: dominantShape,
        motionDirection,
        verticalZone,
        handedness,
        fingerCurlSummary: lastCurlSummary || "N/A",
      };
    }

    return { keyframes, kinematicSummary };
  } catch {
    return { keyframes: [] };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
