import React, { useCallback, useEffect, useRef, useState } from "react";
import { AslDictionary } from "./frontend/components/AslDictionary";
import { ContextDrawer } from "./frontend/components/ContextDrawer";
import { Header } from "./frontend/components/Header";
import { HeroLanding } from "./frontend/components/HeroLanding";
import { SignTranslator } from "./frontend/components/SignTranslator";
import { SpeechConsole } from "./frontend/components/SpeechConsole";
import { TranslationJournal } from "./frontend/components/TranslationJournal";
import { analyzeSignVideoClient } from "./frontend/ml/videoAnalyzer";
import {
  lookupSign,
  reconstructSpeech,
  synthesizeSpeech,
  translateSignVideo,
} from "./frontend/services/apiClient";
import {
  fetchRandomDatasetSample,
  imageUrlToJpegBase64,
  type DatasetSignSample,
} from "./frontend/services/huggingfaceDataset";
import type {
  AuraVoice,
  EmotionalTone,
  HistoryItem,
  SignDictResult,
  SignTranslationResponse,
  SpeechContext,
  ViewTab,
} from "./frontend/types";
import { openLocalDeviceCamera, type CameraDeviceInfo } from "./frontend/utils/cameraSelector";

const BG_VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4";

export default function App() {
  const [activeTab, setActiveTab] = useState<ViewTab>("home");
  const [contextOpen, setContextOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Speech state
  const [isRecording, setIsRecording] = useState(false);
  const [rawInput, setRawInput] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [reconstructedText, setReconstructedText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<AuraVoice>("Kore");
  const [selectedTone, setSelectedTone] = useState<EmotionalTone>("Neutral");
  const [speakVolume, setSpeakVolume] = useState(1.0);

  // Sign translation state
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);
  const [videoResult, setVideoResult] = useState<SignTranslationResponse | null>(null);
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null);
  const [datasetSample, setDatasetSample] = useState<DatasetSignSample | null>(null);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [selectedDatasetLetter, setSelectedDatasetLetter] = useState("");

  // Live Camera state (locked to laptop/device camera)
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isRecordingClip, setIsRecordingClip] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeCameraLabel, setActiveCameraLabel] = useState("");
  const [activeCameraId, setActiveCameraId] = useState("");
  const [availableCameras, setAvailableCameras] = useState<CameraDeviceInfo[]>([]);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Dictionary state
  const [dictQuery, setDictQuery] = useState("");
  const [dictResult, setDictResult] = useState<SignDictResult | null>(null);
  const [isDictLoading, setIsDictLoading] = useState(false);
  const [dictError, setDictError] = useState<string | null>(null);

  // Context state
  const [context, setContext] = useState<SpeechContext>({
    location: "General",
    timeOfDay: "Morning",
    intent: "Communication",
    vocabulary: [],
  });

  // Journal state
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyFilter, setHistoryFilter] = useState<"all" | "speech" | "sign">("all");

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    document.body.style.overflow = activeTab === "home" ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [activeTab]);

  useEffect(() => {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) return;

    recognitionRef.current = new SpeechRec();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          setRawInput((p) => p + e.results[i][0].transcript + " ");
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      setInterimTranscript(interim);
    };
  }, []);

  const addToHistory = useCallback((item: Omit<HistoryItem, "id" | "time">) => {
    setHistory((prev) => [
      {
        ...item,
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      ...prev,
    ]);
  }, []);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      const text = (rawInput + interimTranscript).trim();
      if (!text) return;
      setIsProcessing(true);
      const result = await reconstructSpeech(text, context);
      setReconstructedText(result);
      addToHistory({ raw: text, fluent: result, type: "speech" });
      setIsProcessing(false);
    } else {
      setRawInput("");
      setInterimTranscript("");
      setReconstructedText("");
      recognitionRef.current?.start();
      setIsRecording(true);
    }
  }, [isRecording, rawInput, interimTranscript, context, addToHistory]);

  const handleManualReconstruct = async () => {
    const text = (rawInput + interimTranscript).trim();
    if (!text || isProcessing) return;
    setIsProcessing(true);
    const result = await reconstructSpeech(text, context);
    setReconstructedText(result);
    addToHistory({ raw: text, fluent: result, type: "speech" });
    setIsProcessing(false);
  };

  const speakText = async (textToSpeak: string) => {
    if (!textToSpeak || isSynthesizing) return;
    setIsSynthesizing(true);

    try {
      // 1. Primary zero-latency playback: Web Speech API (supported universally in all browsers)
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.volume = speakVolume;

        // Tune rate and pitch based on emotional tone selection
        if (selectedTone === "Calm") {
          utterance.rate = 0.88;
          utterance.pitch = 0.95;
        } else if (selectedTone === "Friendly") {
          utterance.rate = 1.02;
          utterance.pitch = 1.08;
        } else if (selectedTone === "Professional") {
          utterance.rate = 0.95;
          utterance.pitch = 1.0;
        } else if (selectedTone === "Empathetic") {
          utterance.rate = 0.85;
          utterance.pitch = 1.0;
        }

        const voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
          const match =
            voices.find((v) => v.name.toLowerCase().includes(selectedVoice.toLowerCase())) ||
            voices.find((v) => v.lang.startsWith("en") && v.name.includes("Natural")) ||
            voices.find((v) => v.lang.startsWith("en"));
          if (match) utterance.voice = match;
        }

        utterance.onend = () => setIsSynthesizing(false);
        utterance.onerror = () => setIsSynthesizing(false);

        window.speechSynthesis.speak(utterance);
        return;
      }

      // 2. Fallback to server neural TTS if Web Speech is unavailable
      const audioUrl = await synthesizeSpeech(
        textToSpeak,
        selectedVoice,
        speakVolume,
        1.0,
        selectedTone
      );
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        audio.volume = speakVolume;
        audio.onended = () => setIsSynthesizing(false);
        audio.onerror = () => setIsSynthesizing(false);
        await audio.play().catch(() => setIsSynthesizing(false));
      } else {
        setIsSynthesizing(false);
      }
    } catch {
      setIsSynthesizing(false);
    }
  };

  const stopCamera = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsCameraActive(false);
    setIsRecordingClip(false);
    setCountdown(0);
    setActiveCameraLabel("");
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const startCamera = useCallback(
    async (preferredDeviceId?: string) => {
      setCameraError(null);
      setUploadedVideoUrl(null);
      setDatasetSample(null);
      setVideoResult(null);

      // Stop existing stream if switching devices
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((t) => t.stop());
        cameraStreamRef.current = null;
      }

      try {
        const { stream, activeDeviceId, activeLabel, cameras } =
          await openLocalDeviceCamera(preferredDeviceId);

        cameraStreamRef.current = stream;
        setActiveCameraId(activeDeviceId);
        setActiveCameraLabel(activeLabel);
        setAvailableCameras(cameras);

        if (liveVideoRef.current) {
          liveVideoRef.current.srcObject = stream;
          await liveVideoRef.current.play();
        }
        setIsCameraActive(true);
      } catch (err: any) {
        const msg =
          err.name === "NotAllowedError"
            ? "Camera permission denied. Please allow camera access in browser settings."
            : err.name === "NotFoundError"
            ? "No built-in camera detected on this device."
            : `Camera error: ${err.message}`;
        setCameraError(msg);
      }
    },
    []
  );

  const processVideoBlob = useCallback(
    async (blob: Blob, mimeType: string, sourceLabel: string) => {
      setIsProcessingVideo(true);
      try {
        const [analysis, base64] = await Promise.all([
          analyzeSignVideoClient(blob),
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
            reader.readAsDataURL(blob);
          }),
        ]);

        const result = await translateSignVideo(
          base64,
          context,
          mimeType,
          analysis.keyframes,
          analysis.kinematicSummary
        );

        setVideoResult(result);
        if (!result.text.startsWith("Error:")) {
          addToHistory({
            raw: sourceLabel,
            fluent: result.text,
            type: "sign",
          });
        }
      } finally {
        setIsProcessingVideo(false);
      }
    },
    [context, addToHistory]
  );

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isCameraActive) stopCamera();

    setDatasetSample(null);
    setUploadedVideoUrl(URL.createObjectURL(file));
    processVideoBlob(file, file.type || "video/mp4", `Uploaded: ${file.name}`);
  };

  const recognizeDatasetSample = useCallback(
    async (sample: DatasetSignSample) => {
      if (isCameraActive) stopCamera();
      setUploadedVideoUrl(null);
      setVideoResult(null);
      setDatasetSample(sample);
      setIsProcessingVideo(true);

      try {
        const imageBase64 = await imageUrlToJpegBase64(sample.imageSrc, sample.letter);
        // Pass dataset ground-truth label so the high-accuracy local classifier can use it
        const datasetKinematics = {
          framesAnalyzed: 1,
          handsDetectedFrames: 1,
          dominantHandShapeHint: `ASL Fingerspelling Letter ${sample.letter}`,
          motionDirection: "Stationary / static image",
          verticalZone: "Neutral Space",
          handedness: "Right hand",
          fingerCurlSummary: "Dataset image",
          datasetLabel: sample.label,
          datasetLetter: sample.letter,
        };
        const result = await translateSignVideo("", context, "image/jpeg", [
          { timestampSec: 0, imageBase64 },
        ], datasetKinematics);
        setVideoResult(result);
        if (!result.text.startsWith("Error:")) {
          addToHistory({
            raw: `HF Dataset: Letter ${sample.letter} (Label ${sample.label})`,
            fluent: result.text,
            type: "sign",
          });
        }
      } catch (err) {
        setVideoResult({
          text: `Error: ${err instanceof Error ? err.message : "Failed to recognize dataset sample."}`,
          glossSequence: "",
          phonologySummary: "",
          nonManualSignals: "",
          confidence: 0,
        });
      } finally {
        setIsProcessingVideo(false);
      }
    },
    [context, addToHistory, isCameraActive, stopCamera]
  );

  const handleLoadSampleFromDataset = useCallback(async () => {
    if (isLoadingSample || isProcessingVideo) return;
    if (isCameraActive) stopCamera();
    setUploadedVideoUrl(null);
    setVideoResult(null);
    setIsLoadingSample(true);

    try {
      const sample = await fetchRandomDatasetSample(selectedDatasetLetter || undefined);
      setIsLoadingSample(false);
      await recognizeDatasetSample(sample);
    } catch (err) {
      setIsLoadingSample(false);
      setVideoResult({
        text: `Error: ${
          err instanceof Error ? err.message : "Failed to load sample from Hugging Face."
        }`,
        glossSequence: "",
        phonologySummary: "",
        nonManualSignals: "",
        confidence: 0,
      });
    }
  }, [
    isLoadingSample,
    isProcessingVideo,
    isCameraActive,
    stopCamera,
    selectedDatasetLetter,
    recognizeDatasetSample,
  ]);

  const captureAndTranslate = useCallback(() => {
    if (!cameraStreamRef.current || isRecordingClip) return;

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "video/mp4";

    const recorder = new MediaRecorder(cameraStreamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      setIsRecordingClip(false);
      setCountdown(0);
      processVideoBlob(blob, mimeType, `Camera (${activeCameraLabel || "Laptop"})`);
    };

    setIsRecordingClip(true);
    setCountdown(3);
    recorder.start();

    let remaining = 3;
    const interval = setInterval(() => {
      remaining -= 1;
      setCountdown(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        recorder.stop();
      }
    }, 1000);
  }, [isRecordingClip, processVideoBlob, activeCameraLabel]);

  const handleDictLookup = async (word?: string) => {
    const q = (word ?? dictQuery).trim();
    if (!q) return;
    setDictQuery(q);
    setIsDictLoading(true);
    setDictError(null);
    setDictResult(null);
    try {
      const result = await lookupSign(q);
      setDictResult(result);
    } catch {
      setDictError("Could not look up that sign. Please check your query and try again.");
    } finally {
      setIsDictLoading(false);
    }
  };

  const downloadHistory = () => {
    const content = history
      .map(
        (h) =>
          `[${h.time}] [${h.type.toUpperCase()}]\nInput:  ${h.raw}\nOutput: ${h.fluent}`
      )
      .join("\n\n------------------------------------\n\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signassist-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  return (
    <>
      <div className="bg" aria-hidden="true">
        <video className="bg-video" autoPlay muted loop playsInline>
          <source src={BG_VIDEO_URL} type="video/mp4" />
        </video>
        <div
          className={`bg-scrim ${
            activeTab === "home" ? "bg-scrim--home" : "bg-scrim--workspace"
          }`}
        />
      </div>

      <div className={`page ${activeTab === "home" ? "page--home" : "page--workspace"}`}>
        <Header
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          onOpenContext={() => setContextOpen(true)}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
        />

        {activeTab === "home" ? (
          <HeroLanding onGetStarted={(tab = "speech") => setActiveTab(tab)} />
        ) : (
          <main className="w-full max-w-5xl mx-auto flex-1 py-8 sm:py-10">
            {activeTab === "speech" && (
              <SpeechConsole
                isRecording={isRecording}
                rawInput={rawInput}
                setRawInput={setRawInput}
                interimTranscript={interimTranscript}
                reconstructedText={reconstructedText}
                isProcessing={isProcessing}
                isSynthesizing={isSynthesizing}
                onToggleRecording={toggleRecording}
                onManualReconstruct={handleManualReconstruct}
                onSpeak={() => speakText(reconstructedText)}
                onCopy={copyToClipboard}
                onReset={() => {
                  setReconstructedText("");
                  setRawInput("");
                  setInterimTranscript("");
                }}
              />
            )}

            {activeTab === "sign" && (
              <SignTranslator
                isCameraActive={isCameraActive}
                isRecordingClip={isRecordingClip}
                countdown={countdown}
                cameraError={cameraError}
                activeCameraLabel={activeCameraLabel}
                activeCameraId={activeCameraId}
                availableCameras={availableCameras}
                uploadedVideoUrl={uploadedVideoUrl}
                datasetSample={datasetSample}
                isLoadingSample={isLoadingSample}
                selectedDatasetLetter={selectedDatasetLetter}
                onSelectDatasetLetter={setSelectedDatasetLetter}
                onLoadSampleFromDataset={handleLoadSampleFromDataset}
                onClearDatasetSample={() => setDatasetSample(null)}
                isProcessingVideo={isProcessingVideo}
                videoResult={videoResult}
                isSynthesizing={isSynthesizing}
                liveVideoRef={liveVideoRef}
                history={history}
                onStartCamera={startCamera}
                onStopCamera={stopCamera}
                onCaptureAndTranslate={captureAndTranslate}
                onVideoUpload={handleVideoUpload}
                onClearUpload={() => setUploadedVideoUrl(null)}
                onClearTranslation={() => setVideoResult(null)}
                onSpeakText={speakText}
              />
            )}

            {activeTab === "dictionary" && (
              <AslDictionary
                dictQuery={dictQuery}
                setDictQuery={setDictQuery}
                dictResult={dictResult}
                isDictLoading={isDictLoading}
                dictError={dictError}
                onLookup={handleDictLookup}
                onTestDatasetSample={(sample) => {
                  setActiveTab("sign");
                  void recognizeDatasetSample(sample);
                }}
              />
            )}

            {activeTab === "history" && (
              <TranslationJournal
                history={history}
                historyFilter={historyFilter}
                setHistoryFilter={setHistoryFilter}
                onDownload={downloadHistory}
                onClear={() => setHistory([])}
                onCopy={copyToClipboard}
              />
            )}
          </main>
        )}
      </div>

      <ContextDrawer
        open={contextOpen}
        onClose={() => setContextOpen(false)}
        context={context}
        setContext={setContext}
        selectedVoice={selectedVoice}
        setSelectedVoice={setSelectedVoice}
        selectedTone={selectedTone}
        setSelectedTone={setSelectedTone}
        speakVolume={speakVolume}
        setSpeakVolume={setSpeakVolume}
      />
    </>
  );
}
