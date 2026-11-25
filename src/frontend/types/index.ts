export type ViewTab = "home" | "speech" | "sign" | "dictionary" | "history";

export interface SpeechContext {
  location: string;
  timeOfDay: string;
  intent: string;
  vocabulary?: string[];
}

export type AuraVoice = "Kore" | "Charon" | "Fenrir" | "Aoede" | "Puck" | "Leda";
export type EmotionalTone = "Neutral" | "Friendly" | "Professional" | "Calm" | "Empathetic";

export interface HistoryItem {
  id: string;
  raw: string;
  fluent: string;
  time: string;
  type: "speech" | "sign";
}

export interface SignTranslationResponse {
  text: string;
  glossSequence: string;
  phonologySummary: string;
  nonManualSignals: string;
  confidence: number;
}

export interface SignDictResult {
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

export const VOICES: readonly AuraVoice[] = [
  "Kore",
  "Charon",
  "Fenrir",
  "Aoede",
  "Puck",
  "Leda",
];

export const TONES: readonly EmotionalTone[] = [
  "Neutral",
  "Friendly",
  "Professional",
  "Calm",
];

export const LOCATIONS = [
  "General",
  "Hospital",
  "Home",
  "School",
  "Workplace",
  "Store",
] as const;

export const TIMES = ["Morning", "Afternoon", "Evening", "Night"] as const;

export const COMMON_SIGNS = [
  "Hello",
  "Thank you",
  "Please",
  "Sorry",
  "Help",
  "Water",
  "Yes",
  "No",
  "More",
  "Finished",
  "I love you",
  "Friend",
  "Family",
  "Doctor",
  "Pain",
  "Good",
  "Eat",
  "Sleep",
] as const;

export const NAV_ITEMS: { id: ViewTab; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "speech", label: "Speech" },
  { id: "sign", label: "Sign" },
  { id: "dictionary", label: "Dictionary" },
  { id: "history", label: "Journal" },
];
