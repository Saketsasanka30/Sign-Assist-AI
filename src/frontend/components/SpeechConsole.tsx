import React from "react";
import {
  CheckCircle2,
  Mic,
  MicOff,
  RotateCcw,
  Share2,
  Sparkles,
  Volume2,
} from "lucide-react";

interface SpeechConsoleProps {
  isRecording: boolean;
  rawInput: string;
  setRawInput: (val: string) => void;
  interimTranscript: string;
  reconstructedText: string;
  isProcessing: boolean;
  isSynthesizing: boolean;
  onToggleRecording: () => void;
  onManualReconstruct: () => void;
  onSpeak: () => void;
  onCopy: (text: string) => void;
  onReset: () => void;
}

export const SpeechConsole: React.FC<SpeechConsoleProps> = ({
  isRecording,
  rawInput,
  setRawInput,
  interimTranscript,
  reconstructedText,
  isProcessing,
  isSynthesizing,
  onToggleRecording,
  onManualReconstruct,
  onSpeak,
  onCopy,
  onReset,
}) => {
  return (
    <div className="space-y-6 anim" style={{ "--d": "0.04s" } as React.CSSProperties}>
      <div className="glass-panel p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-white">
            Speech Reconstruction Console
          </h2>
          <p className="text-sm text-[#c4c2c3] opacity-85 max-w-2xl">
            Capture or type dysarthric and phonetically varied speech. Encrypted end-to-end before
            multimodal reconstruction into fluent English.
          </p>
        </div>
        <span className="text-xs font-mono text-[#c4c2c3] whitespace-nowrap shrink-0">
          AES-256-GCM · Live Mic
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Voice Capture & Raw Input */}
        <div className="glass-panel p-6 flex flex-col justify-between min-h-[400px]">
          <div>
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-medium text-[#8e8e8e]">Input Source</span>
              {isRecording && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span>Recording Live</span>
                </span>
              )}
            </div>

            <div className="flex flex-col items-center justify-center my-5 gap-5">
              <div className="relative flex items-center justify-center">
                {isRecording && (
                  <div className="absolute inset-0 flex items-center justify-center gap-1.5 pointer-events-none">
                    {[...Array(7)].map((_, i) => (
                      <div key={i} className="soundwave-bar" />
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={onToggleRecording}
                  id="mic-recording-orb"
                  className={`relative w-24 h-24 rounded-full flex items-center justify-center z-10 transition-all cursor-pointer ${
                    isRecording
                      ? "bg-red-500 hover:bg-red-600 text-white shadow-[0_0_32px_rgba(239,68,68,0.45)]"
                      : "bg-white hover:scale-105 text-black shadow-[0_0_28px_rgba(255,255,255,0.3)]"
                  }`}
                  aria-label={isRecording ? "Stop voice capture" : "Start voice capture"}
                >
                  {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                </button>
              </div>

              <p className="text-xs text-[#8e8e8e] text-center">
                {isRecording
                  ? "Listening — tap orb to stop & reconstruct"
                  : "Tap the orb to speak, or type raw phonetic text below"}
              </p>
            </div>
          </div>

          <div className="glass-subpanel p-4 space-y-2">
            <label
              htmlFor="raw-speech-textarea"
              className="block text-xs font-medium text-[#8e8e8e]"
            >
              Raw Speech Transcript
            </label>
            <textarea
              id="raw-speech-textarea"
              rows={3}
              value={interimTranscript ? `${rawInput}${interimTranscript}` : rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="e.g. i nt to.. go to d.. hsp tal.. now"
              className="w-full bg-transparent text-sm text-white placeholder:text-white/30 resize-none focus:outline-none leading-relaxed"
            />
          </div>
        </div>

        {/* Right: Reconstructed Fluent Output */}
        <div className="glass-panel p-6 flex flex-col justify-between min-h-[400px]">
          <div>
            <div className="flex items-center justify-between mb-6">
              <span className="text-xs font-medium text-[#8e8e8e]">Reconstructed Output</span>
              {reconstructedText && (
                <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Reconstruction Ready</span>
                </span>
              )}
            </div>

            <div className="glass-subpanel min-h-[210px] flex items-center justify-center p-6">
              {isProcessing ? (
                <div className="flex flex-col items-center gap-3">
                  <Sparkles className="w-6 h-6 text-white animate-spin" />
                  <span className="text-xs text-[#c4c2c3]">
                    Encrypting &amp; reconstructing speech...
                  </span>
                </div>
              ) : reconstructedText ? (
                <p className="text-xl font-medium text-white leading-relaxed text-center">
                  {reconstructedText}
                </p>
              ) : (
                <p className="text-sm text-[#8e8e8e] text-center">
                  Fluent reconstructed speech will appear here.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 mt-5 pt-4 border-t border-white/10">
            {rawInput.trim() && !isRecording && (
              <button
                type="button"
                onClick={onManualReconstruct}
                disabled={isProcessing}
                className="cta-glow"
                id="manual-reconstruct-btn"
              >
                <Sparkles className="w-4 h-4" />
                <span>{reconstructedText ? "Re-run" : "Reconstruct"}</span>
              </button>
            )}

            {reconstructedText && (
              <>
                <button
                  type="button"
                  onClick={onSpeak}
                  disabled={isSynthesizing}
                  className="cta-glow"
                  id="speak-aloud-btn"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>{isSynthesizing ? "Synthesizing..." : "Speak"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onCopy(reconstructedText)}
                  className="pill-dark-btn"
                  id="copy-reconstructed-btn"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Copy</span>
                </button>
                <button
                  type="button"
                  onClick={onReset}
                  className="pill-dark-btn"
                  id="reset-reconstructed-btn"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
