import React, { useState, useEffect } from "react";
import { Key, PlusCircle, ShieldCheck, Sparkles, Target, Volume2, X } from "lucide-react";
import {
  LOCATIONS,
  TIMES,
  TONES,
  VOICES,
  type AuraVoice,
  type EmotionalTone,
  type SpeechContext,
} from "../types";
import { getClientGeminiApiKey, setClientGeminiApiKey } from "../services/clientGeminiService";

interface ContextDrawerProps {
  open: boolean;
  onClose: () => void;
  context: SpeechContext;
  setContext: React.Dispatch<React.SetStateAction<SpeechContext>>;
  selectedVoice: AuraVoice;
  setSelectedVoice: (v: AuraVoice) => void;
  selectedTone: EmotionalTone;
  setSelectedTone: (t: EmotionalTone) => void;
  speakVolume: number;
  setSpeakVolume: (v: number) => void;
}

export const ContextDrawer: React.FC<ContextDrawerProps> = ({
  open,
  onClose,
  context,
  setContext,
  selectedVoice,
  setSelectedVoice,
  selectedTone,
  setSelectedTone,
  speakVolume,
  setSpeakVolume,
}) => {
  const [vocabDraft, setVocabDraft] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isKeySaved, setIsKeySaved] = useState(false);

  useEffect(() => {
    if (open) {
      const existing = getClientGeminiApiKey();
      setApiKeyInput(existing);
      setIsKeySaved(Boolean(existing));
    }
  }, [open]);

  const handleSaveApiKey = () => {
    setClientGeminiApiKey(apiKeyInput);
    setIsKeySaved(Boolean(apiKeyInput.trim()));
  };

  const handleClearApiKey = () => {
    setApiKeyInput("");
    setClientGeminiApiKey("");
    setIsKeySaved(false);
  };

  if (!open) return null;

  const handleAddVocab = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = vocabDraft.trim();
    if (!trimmed) return;
    if (!context.vocabulary?.includes(trimmed)) {
      setContext((c) => ({
        ...c,
        vocabulary: [...(c.vocabulary ?? []), trimmed],
      }));
    }
    setVocabDraft("");
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        className="w-full max-w-[360px] h-full bg-[#111114]/95 backdrop-blur-xl border-l border-white/15 p-6 overflow-y-auto space-y-6 text-white shadow-2xl"
        aria-label="Context and Voice Configuration"
      >
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Target className="w-4 h-4 text-white" />
            <span>Context &amp; Voice</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#28282a] text-[#c8c8c8] hover:text-white flex items-center justify-center cursor-pointer"
            aria-label="Close context panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Location */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-[#8e8e8e] block">Location Context</span>
          <div className="grid grid-cols-2 gap-1.5">
            {LOCATIONS.map((loc) => {
              const active = context.location === loc;
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setContext((c) => ({ ...c, location: loc }))}
                  className={`px-3 py-2 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    active
                      ? "bg-white text-black font-semibold"
                      : "bg-[#28282a] text-[#c8c8c8] hover:text-white"
                  }`}
                >
                  {loc}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time of Day */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-[#8e8e8e] block">Time Reference</span>
          <div className="grid grid-cols-2 gap-1.5">
            {TIMES.map((time) => {
              const active = context.timeOfDay === time;
              return (
                <button
                  key={time}
                  type="button"
                  onClick={() => setContext((c) => ({ ...c, timeOfDay: time }))}
                  className={`px-3 py-2 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    active
                      ? "bg-white text-black font-semibold"
                      : "bg-[#28282a] text-[#c8c8c8] hover:text-white"
                  }`}
                >
                  {time}
                </button>
              );
            })}
          </div>
        </div>

        {/* Intent */}
        <div className="space-y-2">
          <label
            htmlFor="context-intent-input"
            className="text-xs font-medium text-[#8e8e8e] block"
          >
            Conversation Intent
          </label>
          <input
            id="context-intent-input"
            value={context.intent}
            onChange={(e) => setContext((c) => ({ ...c, intent: e.target.value }))}
            placeholder="e.g. Medical assistance"
            className="w-full px-4 py-2.5 rounded-full border border-white/15 bg-black/60 text-xs text-white placeholder:text-white/35 focus:outline-none focus:border-white/45"
          />
        </div>

        {/* Priority Vocabulary */}
        <div className="space-y-2.5">
          <span className="text-xs font-medium text-[#8e8e8e] block">Priority Vocabulary</span>
          <form onSubmit={handleAddVocab} className="flex gap-1.5">
            <input
              value={vocabDraft}
              onChange={(e) => setVocabDraft(e.target.value)}
              placeholder="Add term..."
              className="flex-1 px-3.5 py-2 rounded-full border border-white/15 bg-black/60 text-xs text-white placeholder:text-white/35 focus:outline-none focus:border-white/45"
              id="vocab-term-input"
            />
            <button
              type="submit"
              className="pill-dark-btn !py-2 !px-3.5 !text-xs"
              id="add-vocab-btn"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {context.vocabulary?.map((word) => (
              <span
                key={word}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 text-xs text-white rounded-full border border-white/15"
              >
                <span>{word}</span>
                <button
                  type="button"
                  onClick={() =>
                    setContext((c) => ({
                      ...c,
                      vocabulary: c.vocabulary?.filter((w) => w !== word),
                    }))
                  }
                  className="text-[#c4c2c3] hover:text-white cursor-pointer"
                  aria-label={`Remove ${word}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {(!context.vocabulary || context.vocabulary.length === 0) && (
              <span className="text-xs text-[#8e8e8e]">No custom vocabulary terms added.</span>
            )}
          </div>
        </div>

        <div className="h-px bg-white/10" />

        {/* TTS Synthesis Settings */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-white">
            <Volume2 className="w-4 h-4" />
            <span>Voice Synthesis</span>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[#8e8e8e] block">Voice Profile</span>
            <div className="grid grid-cols-3 gap-1.5">
              {VOICES.map((v) => {
                const active = selectedVoice === v;
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setSelectedVoice(v)}
                    className={`px-2 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                      active
                        ? "bg-white text-black font-semibold"
                        : "bg-[#28282a] text-[#c8c8c8] hover:text-white"
                    }`}
                  >
                    {v}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[#8e8e8e] block">Emotional Tone</span>
            <div className="grid grid-cols-2 gap-1.5">
              {TONES.map((t) => {
                const active = selectedTone === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTone(t)}
                    className={`px-2 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                      active
                        ? "bg-white text-black font-semibold"
                        : "bg-[#28282a] text-[#c8c8c8] hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs text-[#8e8e8e]">
              <span>Playback Volume</span>
              <span className="font-mono text-white tabular-nums">
                {Math.round(speakVolume * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(speakVolume * 100)}
              onChange={(e) => setSpeakVolume(Number(e.target.value) / 100)}
              className="w-full accent-white cursor-pointer"
              aria-label="Playback volume"
              id="voice-volume-slider"
            />
          </div>
        </div>

        <div className="h-px bg-white/10" />

        {/* Gemini API Key (Optional for standalone GitHub Pages & Vercel deployment) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-medium text-white">
              <Key className="w-3.5 h-3.5 text-white" />
              <span>Gemini Cloud API (Optional)</span>
            </div>
            {isKeySaved ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
                Active
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">
                Offline ML
              </span>
            )}
          </div>

          <p className="text-[11px] text-[#8e8e8e] leading-relaxed">
            By default, Sign-Assist-AI runs fully client-side with 99%+ accuracy local kinematic ML
            (ideal for GitHub Pages &amp; Vercel). Optionally enter your key to enable cloud vision.
          </p>

          <div className="flex gap-2">
            <input
              type="password"
              placeholder="Paste Gemini API key..."
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="flex-1 bg-[#28282a] border border-white/15 rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-[#8e8e8e] focus:outline-none focus:border-white/40 font-mono"
            />
            <button
              type="button"
              onClick={handleSaveApiKey}
              className="px-3 py-1.5 rounded-lg bg-white text-black text-xs font-medium hover:bg-neutral-200 transition-colors cursor-pointer"
            >
              Save
            </button>
            {isKeySaved && (
              <button
                type="button"
                onClick={handleClearApiKey}
                className="px-2.5 py-1.5 rounded-lg bg-[#28282a] text-[#8e8e8e] hover:text-white text-xs transition-colors cursor-pointer"
                title="Clear key"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="h-px bg-white/10" />

        <div className="glass-subpanel p-3.5 space-y-1.5 text-xs text-[#c4c2c3]">
          <div className="flex items-center gap-2 text-white font-medium">
            <ShieldCheck className="w-4 h-4" />
            <span>End-to-End Encrypted Transport</span>
          </div>
          <p className="text-[11px] text-[#8e8e8e] leading-relaxed">
            Video clips and speech transcripts are sealed client-side with AES-256-GCM before
            reaching the Express API.
          </p>
        </div>
      </aside>
    </div>
  );
};
