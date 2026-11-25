import React from "react";
import {
  AlertCircle,
  Camera,
  CircleDot,
  Database,
  Info,
  Sparkles,
  Upload,
  Video,
  VideoOff,
  Volume2,
  X,
} from "lucide-react";
import { LABEL_TO_LETTER, type DatasetSignSample } from "../services/huggingfaceDataset";
import type { HistoryItem, SignTranslationResponse } from "../types";
import type { CameraDeviceInfo } from "../utils/cameraSelector";

interface SignTranslatorProps {
  isCameraActive: boolean;
  isRecordingClip: boolean;
  countdown: number;
  cameraError: string | null;
  activeCameraLabel: string;
  activeCameraId: string;
  availableCameras: CameraDeviceInfo[];
  uploadedVideoUrl: string | null;
  datasetSample: DatasetSignSample | null;
  isLoadingSample: boolean;
  selectedDatasetLetter: string;
  onSelectDatasetLetter: (letter: string) => void;
  onLoadSampleFromDataset: () => void;
  onClearDatasetSample: () => void;
  isProcessingVideo: boolean;
  videoResult: SignTranslationResponse | null;
  isSynthesizing: boolean;
  liveVideoRef: React.RefObject<HTMLVideoElement | null>;
  history: HistoryItem[];
  onStartCamera: (deviceId?: string) => void;
  onStopCamera: () => void;
  onCaptureAndTranslate: () => void;
  onVideoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearUpload: () => void;
  onClearTranslation: () => void;
  onSpeakText: (text: string) => void;
}

export const SignTranslator: React.FC<SignTranslatorProps> = ({
  isCameraActive,
  isRecordingClip,
  countdown,
  cameraError,
  activeCameraLabel,
  activeCameraId,
  availableCameras,
  uploadedVideoUrl,
  datasetSample,
  isLoadingSample,
  selectedDatasetLetter,
  onSelectDatasetLetter,
  onLoadSampleFromDataset,
  onClearDatasetSample,
  isProcessingVideo,
  videoResult,
  isSynthesizing,
  liveVideoRef,
  history,
  onStartCamera,
  onStopCamera,
  onCaptureAndTranslate,
  onVideoUpload,
  onClearUpload,
  onClearTranslation,
  onSpeakText,
}) => {
  const signHistory = history.filter((h) => h.type === "sign").slice(0, 4);

  return (
    <div className="space-y-6 anim" style={{ "--d": "0.04s" } as React.CSSProperties}>
      <div className="glass-panel p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight text-white">
            Sign Language Translation Station
          </h2>
          <p className="text-sm text-[#c4c2c3] opacity-85 max-w-2xl">
            Capture a 3-second clip using your laptop&apos;s camera, upload an ASL video, or load a
            labeled sample directly from Hugging Face for Gemini ASL recognition.
          </p>
        </div>
        <span className="text-xs font-mono text-[#c4c2c3] whitespace-nowrap shrink-0">
          WLASL · HF Dataset · E2EE
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <div className="glass-panel p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-[#8e8e8e]">Video &amp; Dataset Capture Hub</span>
                {isCameraActive && activeCameraLabel && (
                  <span className="text-[11px] font-mono text-[#c4c2c3]">
                    Device Camera: {activeCameraLabel}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isCameraActive && availableCameras.length > 1 && (
                  <select
                    value={activeCameraId}
                    onChange={(e) => onStartCamera(e.target.value)}
                    aria-label="Select camera device"
                    className="px-3 py-1.5 rounded-full text-xs bg-[#28282a] text-white border border-white/15 focus:outline-none max-w-[200px] truncate"
                    id="camera-device-select"
                  >
                    {availableCameras.map((cam) => (
                      <option key={cam.deviceId} value={cam.deviceId}>
                        {cam.isPhoneOrVirtual ? `${cam.label} (External/Phone)` : cam.label}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  onClick={() => {
                    onStopCamera();
                    onClearUpload();
                    onClearDatasetSample();
                    onClearTranslation();
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    !isCameraActive
                      ? "bg-white text-black shadow-sm"
                      : "bg-[#28282a] text-[#c8c8c8] hover:text-white"
                  }`}
                  id="mode-upload-btn"
                >
                  Upload / Dataset
                </button>
                <button
                  type="button"
                  onClick={isCameraActive ? onStopCamera : () => onStartCamera()}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    isCameraActive
                      ? "bg-white text-black shadow-sm"
                      : "bg-[#28282a] text-[#c8c8c8] hover:text-white"
                  }`}
                  id="mode-camera-btn"
                >
                  {isCameraActive ? "Stop Camera" : "Live Camera"}
                </button>
              </div>
            </div>

            {cameraError && (
              <div className="mb-4 p-3.5 rounded-2xl border border-red-500/30 bg-red-950/40 text-red-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <span>{cameraError}</span>
              </div>
            )}

            <div className="relative aspect-video w-full rounded-2xl border border-white/10 bg-black/70 flex flex-col items-center justify-center overflow-hidden">
              <video
                ref={liveVideoRef}
                muted
                playsInline
                className={`w-full h-full object-cover ${isCameraActive ? "block" : "hidden"}`}
                id="live-camera-preview"
              />

              {uploadedVideoUrl && !isCameraActive && (
                <>
                  <video src={uploadedVideoUrl} controls className="w-full h-full object-contain" />
                  <button
                    type="button"
                    onClick={() => {
                      onClearUpload();
                      onClearTranslation();
                    }}
                    className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/80 hover:bg-black text-white flex items-center justify-center border border-white/20 cursor-pointer"
                    id="remove-uploaded-video"
                    aria-label="Remove uploaded video"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}

              {datasetSample && !uploadedVideoUrl && !isCameraActive && (
                <>
                  <img
                    src={datasetSample.imageSrc}
                    alt={`ASL Dataset sample for letter ${datasetSample.letter}`}
                    className="w-full h-full object-contain bg-black"
                    id="dataset-sample-preview"
                  />
                  <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-black/80 border border-white/20 text-xs font-mono text-white">
                    Dataset Sample · Letter {datasetSample.letter} (Label {datasetSample.label})
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClearDatasetSample();
                      onClearTranslation();
                    }}
                    className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/80 hover:bg-black text-white flex items-center justify-center border border-white/20 cursor-pointer"
                    id="remove-dataset-sample"
                    aria-label="Remove dataset sample"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              )}

              {!isCameraActive && !uploadedVideoUrl && !datasetSample && (
                <div className="text-center p-6 flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center">
                    <Camera className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-white">
                      Load a dataset sample, upload a video, or enable Live Camera
                    </p>
                    <p className="text-xs text-[#8e8e8e] mt-1">
                      Fetches live Hugging Face ASL signs or opens your laptop&apos;s webcam · E2EE
                      encrypted
                    </p>
                  </div>
                </div>
              )}

              {isCameraActive && isRecordingClip && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="bg-black/75 border border-white/20 rounded-2xl px-7 py-5 flex flex-col items-center gap-2">
                    <CircleDot className="w-6 h-6 text-red-500 animate-pulse" />
                    <span className="text-5xl font-semibold text-white tabular-nums leading-none">
                      {countdown}
                    </span>
                    <span className="text-xs font-medium text-red-300">Recording clip</span>
                  </div>
                </div>
              )}

              {isCameraActive && !isRecordingClip && (
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 rounded-full bg-black/70 border border-white/15 text-xs font-medium text-white">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span>Live</span>
                </div>
              )}

              {(isProcessingVideo || isLoadingSample) && (
                <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-3 z-20">
                  <Sparkles className="w-7 h-7 text-white animate-spin" />
                  <span className="text-xs font-medium text-[#c4c2c3]">
                    {isLoadingSample
                      ? "Fetching ASL sample from Hugging Face..."
                      : "Decoding ASL phonology with Gemini..."}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              {!isCameraActive && (
                <>
                  <div className="inline-flex items-center gap-2">
                    <select
                      value={selectedDatasetLetter}
                      onChange={(e) => onSelectDatasetLetter(e.target.value)}
                      aria-label="Choose dataset letter or random"
                      className="px-3.5 py-2.5 rounded-full text-xs font-medium bg-[#28282a] text-white border border-white/15 focus:outline-none cursor-pointer"
                      id="dataset-letter-select"
                    >
                      <option value="">Random (A–Z)</option>
                      {LABEL_TO_LETTER.map((letter, idx) => (
                        <option key={letter} value={letter}>
                          {letter} (#{idx})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={onLoadSampleFromDataset}
                      disabled={isLoadingSample || isProcessingVideo}
                      className="cta-glow"
                      id="load-dataset-sample-btn"
                    >
                      <Database className="w-4 h-4" />
                      <span>
                        {isLoadingSample ? "Loading Sample..." : "Load Sample from Dataset"}
                      </span>
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type="file"
                      accept="video/*"
                      onChange={onVideoUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      id="video-upload-file"
                      aria-label="Select ASL video file"
                    />
                    <button type="button" className="pill-dark-btn" id="upload-video-trigger">
                      <Upload className="w-4 h-4" />
                      <span>Select Video</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onStartCamera()}
                    className="pill-dark-btn"
                    id="start-camera-btn"
                  >
                    <Video className="w-4 h-4" />
                    <span>Use Laptop Camera</span>
                  </button>
                </>
              )}

              {isCameraActive && (
                <>
                  <button
                    type="button"
                    onClick={onCaptureAndTranslate}
                    disabled={isRecordingClip || isProcessingVideo}
                    className="cta-glow"
                    id="capture-translate-btn"
                  >
                    <CircleDot className="w-4 h-4" />
                    <span>
                      {isRecordingClip
                        ? `Recording ${countdown}s...`
                        : isProcessingVideo
                        ? "Analyzing..."
                        : "Capture & Translate (3s)"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={onStopCamera}
                    className="pill-dark-btn"
                    id="stop-camera-btn"
                  >
                    <VideoOff className="w-4 h-4" />
                    <span>Stop</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {videoResult && videoResult.text.startsWith("Error:") && (
            <div className="p-4 rounded-2xl border border-red-500/30 bg-red-950/40 text-red-200 text-sm flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <span>{videoResult.text}</span>
              </div>
              <button
                type="button"
                onClick={onClearTranslation}
                className="text-red-300 hover:text-white transition-colors cursor-pointer shrink-0"
                aria-label="Dismiss error"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {videoResult && !videoResult.text.startsWith("Error:") && (
            <div className="glass-panel p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-[#8e8e8e]">
                  <span>Translation Output</span>
                  {videoResult.glossSequence && videoResult.glossSequence !== "NONE" && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-[#c4c2c3]">{videoResult.glossSequence}</span>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClearTranslation}
                  className="text-[#8e8e8e] hover:text-white transition-colors cursor-pointer"
                  aria-label="Dismiss translation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-2xl font-medium text-white leading-snug">{videoResult.text}</p>

              {(videoResult.phonologySummary || videoResult.nonManualSignals) && (
                <div className="glass-subpanel p-3.5 space-y-1.5 text-xs text-[#c4c2c3]">
                  {videoResult.phonologySummary && (
                    <p>
                      <span className="text-white font-medium">Articulation:</span>{" "}
                      {videoResult.phonologySummary}
                    </p>
                  )}
                  {videoResult.nonManualSignals && (
                    <p>
                      <span className="text-white font-medium">Non-Manual Signals:</span>{" "}
                      {videoResult.nonManualSignals}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <span className="text-xs font-mono text-[#8e8e8e] tabular-nums">
                  Confidence: {Math.round(videoResult.confidence * 100)}%
                </span>

                <button
                  type="button"
                  onClick={() => onSpeakText(videoResult.text)}
                  disabled={isSynthesizing}
                  className="cta-glow"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>{isSynthesizing ? "Synthesizing..." : "Speak Translation"}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="glass-panel p-6">
            <span className="text-xs font-medium text-[#8e8e8e] block mb-4">
              Recent Sign Translations
            </span>
            <div className="space-y-3">
              {signHistory.map((h) => (
                <div key={h.id} className="glass-subpanel p-3.5 space-y-1">
                  <span className="text-[11px] font-mono text-[#8e8e8e] tabular-nums">
                    {h.time}
                  </span>
                  <p className="text-sm font-medium text-white line-clamp-2">{h.fluent}</p>
                </div>
              ))}
              {signHistory.length === 0 && (
                <p className="text-xs text-[#8e8e8e] text-center py-8">
                  No sign translations yet in this session.
                </p>
              )}
            </div>
          </div>

          <div className="glass-panel p-5">
            <div className="flex gap-3">
              <Info className="w-4 h-4 text-white shrink-0 mt-0.5" />
              <p className="text-xs text-[#c4c2c3] leading-relaxed">
                <span className="font-semibold text-white">Local Camera Lock:</span> Linked phone
                or Continuity cameras are automatically bypassed so video opens on your laptop&apos;s
                integrated webcam.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
