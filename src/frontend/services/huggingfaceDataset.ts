export interface DatasetSignSample {
  rowIdx: number;
  label: number;
  letter: string;
  imageSrc: string;
  width: number;
  height: number;
}

export interface HuggingFaceDatasetMeta {
  id: string;
  downloads?: number;
  likes?: number;
}

const HF_DATASET_ID = "Marxulia/asl_sign_languages_alphabets_v03";
const HF_HUB_API_URL = `https://huggingface.co/api/datasets/${HF_DATASET_ID}`;
const HF_DATASETS_SERVER_FILTER_URL = "https://datasets-server.huggingface.co/filter";

/**
 * Exact 0-25 numeric label to A-Z letter mapping matching the
 * Marxulia/asl_sign_languages_alphabets_v03 ClassLabel feature.
 */
export const LABEL_TO_LETTER: readonly string[] = Array.from({ length: 26 }, (_, idx) =>
  String.fromCharCode(65 + idx)
);

export function mapLabelToLetter(label: number): string {
  if (Number.isInteger(label) && label >= 0 && label < LABEL_TO_LETTER.length) {
    return LABEL_TO_LETTER[label];
  }
  return "?";
}

interface HfFilterRowResponse {
  rows?: Array<{
    row_idx?: number;
    row?: {
      image?: {
        src?: string;
        width?: number;
        height?: number;
      };
      label?: number;
    };
  }>;
}

let cachedAlphabetSamples: DatasetSignSample[] | null = null;
let cachedDatasetMeta: HuggingFaceDatasetMeta | null = null;

export async function fetchHuggingFaceDatasetMeta(): Promise<HuggingFaceDatasetMeta | null> {
  if (cachedDatasetMeta) return cachedDatasetMeta;
  try {
    const res = await fetch(HF_HUB_API_URL, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string; downloads?: number; likes?: number };
    cachedDatasetMeta = {
      id: data.id || HF_DATASET_ID,
      downloads: data.downloads,
      likes: data.likes,
    };
    return cachedDatasetMeta;
  } catch {
    return null;
  }
}

/**
 * Generates an offline synthetic dataset card image for instant display and testing.
 */
export function createSyntheticDatasetSample(letter = "A"): DatasetSignSample {
  const upper = (letter.toUpperCase().slice(0, 1) || "A").replace(/[^A-Z]/g, "A");
  const label = Math.max(0, LABEL_TO_LETTER.indexOf(upper));
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 400;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#151518";
    ctx.fillRect(0, 0, 400, 400);
    // Draw subtle border
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, 384, 384);
    // Letter
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 130px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(upper, 200, 180);
    // Subtitle
    ctx.font = "18px sans-serif";
    ctx.fillStyle = "#9e9ea8";
    ctx.fillText(`ASL Alphabet • Letter ${upper}`, 200, 275);
    ctx.font = "14px monospace";
    ctx.fillStyle = "#606070";
    ctx.fillText(`Label: ${label} | WLASL Feature`, 200, 310);
  }
  return {
    rowIdx: label,
    label,
    letter: upper,
    imageSrc: canvas.toDataURL("image/jpeg", 0.9),
    width: 400,
    height: 400,
  };
}

async function fetchRowForLabel(
  labelIndex: number,
  offset = 0
): Promise<DatasetSignSample | null> {
  try {
    const params = new URLSearchParams({
      dataset: HF_DATASET_ID,
      config: "default",
      split: "train",
      where: `"label"=${labelIndex}`,
      offset: String(offset),
      length: "1",
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);

    const res = await fetch(`${HF_DATASETS_SERVER_FILTER_URL}?${params.toString()}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = (await res.json()) as HfFilterRowResponse;
    const entry = data.rows?.[0];
    const imageSrc = entry?.row?.image?.src;
    const label = typeof entry?.row?.label === "number" ? entry.row.label : labelIndex;

    if (!imageSrc) return null;

    return {
      rowIdx: typeof entry?.row_idx === "number" ? entry.row_idx : labelIndex,
      label,
      letter: mapLabelToLetter(label),
      imageSrc,
      width: entry?.row?.image?.width || 400,
      height: entry?.row?.image?.height || 400,
    };
  } catch {
    return null;
  }
}

/**
 * Fetches representative samples per numeric label (0-25 -> A-Z).
 * Automatically falls back to synthetic cards if network is unavailable.
 */
export async function fetchAllAlphabetSamples(forceRefresh = false): Promise<DatasetSignSample[]> {
  if (cachedAlphabetSamples && cachedAlphabetSamples.length === 26 && !forceRefresh) {
    return cachedAlphabetSamples;
  }

  void fetchHuggingFaceDatasetMeta();

  const indices = Array.from({ length: 26 }, (_, i) => i);
  const results: DatasetSignSample[] = [];
  const batchSize = 6;

  try {
    for (let i = 0; i < indices.length; i += batchSize) {
      const batch = indices.slice(i, i + batchSize);
      const settled = await Promise.allSettled(batch.map((idx) => fetchRowForLabel(idx, 0)));
      for (const item of settled) {
        if (item.status === "fulfilled" && item.value) {
          results.push(item.value);
        }
      }
    }
  } catch {
    // Ignore and proceed to fill missing with synthetic cards
  }

  // Ensure all 26 letters are present — fill any missing letter with a synthetic card
  const presentLabels = new Set(results.map((r) => r.label));
  for (let idx = 0; idx < 26; idx++) {
    if (!presentLabels.has(idx)) {
      results.push(createSyntheticDatasetSample(LABEL_TO_LETTER[idx]));
    }
  }

  results.sort((a, b) => a.label - b.label);
  cachedAlphabetSamples = results;
  return results;
}

/**
 * Fetches a single ASL sign sample from Hugging Face for the Sign recognition tab.
 * Automatically falls back to synthetic sample on network or timeout.
 */
export async function fetchRandomDatasetSample(targetLetter?: string): Promise<DatasetSignSample> {
  void fetchHuggingFaceDatasetMeta();

  let labelIndex = Math.floor(Math.random() * 26);
  if (targetLetter) {
    const upper = targetLetter.trim().toUpperCase();
    const found = LABEL_TO_LETTER.indexOf(upper);
    if (found !== -1) {
      labelIndex = found;
    }
  }

  const targetLetterChar = LABEL_TO_LETTER[labelIndex] || "A";

  try {
    const randomOffset = Math.floor(Math.random() * 30);
    const sample = await fetchRowForLabel(labelIndex, randomOffset);
    if (sample) return sample;

    const fallback = await fetchRowForLabel(labelIndex, 0);
    if (fallback) return fallback;
  } catch {
    // Return synthetic sample below
  }

  return createSyntheticDatasetSample(targetLetterChar);
}

/**
 * Fetches an image URL and re-encodes it cleanly in-browser as JPEG base64.
 * If external image download fails (e.g. CORS restrictions), gracefully creates
 * an in-memory canvas fallback so recognition NEVER crashes.
 */
export async function imageUrlToJpegBase64(imageUrl: string, fallbackLetter = "A"): Promise<string> {
  try {
    const res = await fetch(imageUrl, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);

    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = "anonymous";
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Could not decode dataset image."));
        el.src = objectUrl;
      });

      const maxDim = 1024;
      const scale = Math.min(
        1,
        maxDim / Math.max(img.naturalWidth || 400, img.naturalHeight || 400)
      );
      const width = Math.max(1, Math.round((img.naturalWidth || 400) * scale));
      const height = Math.max(1, Math.round((img.naturalHeight || 400) * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable.");

      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      const base64 = dataUrl.split(",")[1];
      if (base64) return base64;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch {
    // Generate clean synthetic fallback image
    const sample = createSyntheticDatasetSample(fallbackLetter);
    return sample.imageSrc.split(",")[1] || "";
  }

  const sample = createSyntheticDatasetSample(fallbackLetter);
  return sample.imageSrc.split(",")[1] || "";
}
