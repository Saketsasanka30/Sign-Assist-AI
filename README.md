# Sign Assist AI — Multimodal Communication Platform

**Sign Assist AI** is a full-stack multimodal communication platform built with **React**, **TypeScript**, **Express.js**, and the **Gemini API**. It supports real-time American Sign Language (ASL) gesture recognition and dysarthric speech reconstruction—validated with a 10+ user pilot group—over end-to-end encrypted video and audio transport.

---

## Project Architecture (Separated by Function)

```text
/
├── index.html                           # Entry HTML (Inter, BubbledotICG-FinePos, Font Awesome 6.5.2)
├── server.ts                            # Server bootstrap mounting backend Express app & Vite
├── src/
│   ├── main.tsx                         # React DOM entry
│   ├── App.tsx                          # Application shell, full-bleed video bg & view routing
│   ├── index.css                        # Design tokens, animations, responsive layout rules
│   └── frontend/                        # Frontend UI, camera locking, E2EE client & API client
│       ├── components/
│       │   ├── Header.tsx               # 3-zone floating header (logo, white nav pill, dark pill, mobile sheet)
│       │   ├── HeroLanding.tsx          # Single-viewport landing hero & count-up metrics footer
│       │   ├── SpeechConsole.tsx        # Dysarthric speech capture & reconstruction workspace
│       │   ├── SignTranslator.tsx       # Built-in laptop camera capture & ASL video translator
│       │   ├── AslDictionary.tsx        # ASL-LEX dictionary search & gloss guide
│       │   ├── TranslationJournal.tsx   # Session timeline, category filters & .txt export
│       │   └── ContextDrawer.tsx        # Situational context, vocabulary & neural TTS settings
│       ├── hooks/
│       │   └── useCountUp.ts            # EaseOutCubic IntersectionObserver stat counter
│       ├── ml/
│       │   └── videoAnalyzer.ts         # 8-frame temporal sampler & MediaPipe HandLandmarker kinematics
│       ├── security/
│       │   └── e2ee.ts                  # Web Crypto API client encryption (RSA-OAEP + AES-256-GCM)
│       ├── services/
│       │   └── apiClient.ts             # Encrypted REST API client
│       ├── types/
│       │   └── index.ts                 # Shared frontend types & constants
│       └── utils/
│           └── cameraSelector.ts        # Built-in laptop webcam selector (excludes linked phones)
├── backend/                             # Express.js REST API, E2EE decryption & OWASP hardening
│   ├── app.ts                           # Express app factory, MediaPipe WASM mount & error boundary
│   ├── routes/
│   │   └── api.ts                       # Core REST endpoints (/api/*)
│   ├── middleware/
│   │   ├── securityHeaders.ts           # CSP, nosniff, Origin/CSRF guard, no-store headers
│   │   ├── rateLimiter.ts               # Sliding-window per-IP rate limiter
│   │   ├── decryptPayload.ts            # Payload decryption & anti-replay verification
│   │   └── validation.ts                # Schema, enum, MIME allowlist & length validation
│   └── security/
│       └── cryptoEngine.ts              # Ephemeral RSA-2048 OAEP & AES-256-GCM server engine
├── ml/                                  # Multimodal AI & ASL dataset inference layer
│   ├── aslDataset.ts                    # Curated WLASL / ASL-LEX phonological & minimal-pair dataset
│   ├── geminiClient.ts                  # Server-side Gemini client, retries & prompt sanitization
│   ├── speechReconstructor.ts           # Dysarthric speech reconstruction inference
│   ├── signTranslator.ts                # Dataset-grounded two-stage ASL phonological decoder
│   ├── speechSynthesizer.ts             # Neural TTS audio synthesis
│   └── dictionaryEngine.ts              # Structured ASL-LEX dictionary lookup
└── docs/
    └── THREAT_MODEL_AND_PRIVACY.md      # Formal threat model, OWASP mapping & privacy safeguards
```

---

## Core Features

1. **Dataset-Grounded ASL Video & Local Camera Translation**: Extracts 8 sequential keyframes and MediaPipe 21-point hand skeletal kinematics, decoding handshape, location, palm orientation, movement, and non-manual markers against a curated WLASL / ASL-LEX phonological dataset (`ml/aslDataset.ts`) with minimal-pair disambiguation. Live camera capture automatically selects the device's integrated laptop webcam and excludes linked phones / Continuity cameras.
2. **Dysarthric Speech Reconstruction**: Captures live microphone audio (Web Speech API) or text input and reconstructs phonetically varied speech into fluent English grounded in situational context.
3. **Neural Text-to-Speech (TTS)**: Synthesizes natural spoken output across 6 voice profiles (`Kore`, `Charon`, `Fenrir`, `Aoede`, `Puck`, `Leda`) and selectable emotional tones.
4. **ASL Dictionary Lookup**: Provides structured ASL glosses, handshape instructions, non-manual markers, and syntax examples.
5. **Translation Journal**: Logs session translations locally with category filters and `.txt` export.
6. **End-to-End Payload Encryption & OWASP Hardening**: Seals sensitive video, audio, and speech payloads client-side with ephemeral `AES-256-GCM` keys wrapped via `RSA-OAEP-256`, paired with rate limiting, strict input validation, anti-replay nonces, and origin checks. See [`docs/THREAT_MODEL_AND_PRIVACY.md`](docs/THREAT_MODEL_AND_PRIVACY.md).

---

## Setup & Running Locally

```bash
npm install
```

Create `.env` at the project root:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Run in development or production mode:

```bash
npm run dev      # Development server on http://localhost:3000
npm run build    # Build frontend (dist/) + server bundle (dist/server.cjs)
npm run start    # Run production server
```
