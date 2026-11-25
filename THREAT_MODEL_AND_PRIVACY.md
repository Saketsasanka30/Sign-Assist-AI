# Threat Model & Privacy Safeguards — SignAssist AI

This document formalizes the threat model, end-to-end encryption architecture, OWASP Top 10 defenses, and privacy safeguards governing sensitive user data (video streams, live camera clips, dysarthric speech transcripts, and synthesized audio).

---

## 1. System Trust Boundaries

```
[Browser Client (Web Crypto API)]
   │  1. Captures camera video / microphone transcript locally
   │  2. Fetches ephemeral RSA-2048 OAEP public key (/api/security/public-key)
   │  3. Generates per-request 256-bit AES-GCM key + 96-bit IV + AAD (endpoint, timestamp, nonce)
   │  4. Encrypts sensitive payload client-side before leaving the browser
   ▼
[Trust Boundary: Network Transit (HTTPS + Application-Layer E2EE Envelope)]
   │
   ▼
[Express REST API Layer (/backend/)]
   │  - securityHeadersMiddleware (CSP, nosniff, Referrer-Policy, Permissions-Policy)
   │  - apiOriginGuardMiddleware (Same-Origin mutation verification, no wildcard CORS)
   │  - rateLimitMiddleware (Per-IP sliding window)
   │  - decryptPayloadMiddleware (RSA-OAEP unwrap + AES-256-GCM auth tag + 5-min anti-replay)
   │  - validationMiddleware (Strict schema, enum, length, and MIME allowlist checks)
   ▼
[ML Inference Layer (/ml/)]
   │  - Isolated server-side Gemini SDK client (GEMINI_API_KEY never exposed to client)
   │  - Delimited prompt boundaries + control character stripping
   ▼
[Google Gemini API]
```

---

## 2. Threat Model & Mitigations (STRIDE & OWASP Top 10)

| Threat / OWASP Category | Attack Vector | Implemented Safeguard | Location |
|---|---|---|---|
| **A01 Broken Access Control / CSRF** | Forged cross-origin POST requests against `/api/*` inference endpoints | `apiOriginGuardMiddleware` enforces `Origin` matching `Host` / `X-Forwarded-Host` on all state-changing `/api/*` routes; wildcard CORS is disabled. | `backend/middleware/securityHeaders.ts` |
| **A02 Cryptographic Failures** | Plaintext video/audio or speech transcripts intercepted in transit or replayed | Ephemeral RSA-2048 OAEP (SHA-256) key wrapping + per-request AES-256-GCM payload encryption with AAD endpoint binding, 5-minute timestamp window, and nonce replay cache. Unencrypted payloads to sensitive POST endpoints are rejected. | `src/frontend/security/e2ee.ts`, `backend/security/cryptoEngine.ts`, `backend/middleware/decryptPayload.ts` |
| **A03 Injection / Prompt Injection** | Malicious instructions embedded inside transcripts, filenames, or dictionary queries | `sanitizePromptText` strips control characters and wraps untrusted text in `<raw_transcript>` / `<input_text>` delimiters; dictionary queries are constrained to `^[a-zA-Z0-9\s'-]{1,64}$`. | `ml/geminiClient.ts`, `backend/middleware/validation.ts` |
| **A04 Insecure Design (DoS / Resource Exhaustion)** | Oversized video uploads or high-frequency inference flooding | Sliding-window per-IP rate limiting (`25 req/min` on ML endpoints, `90 req/min` general), explicit payload byte caps, and exponential-backoff retries on transient 429/503 responses. | `backend/middleware/rateLimiter.ts`, `backend/middleware/validation.ts` |
| **A05 Security Misconfiguration** | Information leakage via `X-Powered-By`, verbose stack traces, or missing headers | `x-powered-by` disabled; strict CSP, `X-Content-Type-Options: nosniff`, `Permissions-Policy`, `Cache-Control: no-store` on `/api/*`, and sanitized non-leaking error responses. | `backend/middleware/securityHeaders.ts`, `backend/app.ts` |
| **A09 Security Logging Failures** | Sensitive user video frames or dysarthric transcripts written to server logs | Zero-logging policy for user payloads: route handlers and error middleware never log `rawInput`, `videoBase64`, or synthesized audio buffers. | `backend/routes/api.ts`, `backend/app.ts` |

---

## 3. Sensitive User Input Handling & Privacy Policy

1. **Ephemeral In-Memory Processing**: Uploaded or recorded ASL video clips and speech transcripts are processed transiently in memory for inference and immediately discarded. No user media is persisted to server disk or third-party storage.
2. **Client-Side Session Journal**: Translation history is retained strictly in browser React state (`HistoryItem[]`) for the active session and can be cleared at any time by the user.
3. **Least-Privilege Media Permissions**: Camera and microphone streams are requested strictly on explicit user gesture (`Use Camera` or microphone orb tap) and all `MediaStream` tracks are explicitly stopped on deactivation or unmount.
4. **Secret Isolation**: `GEMINI_API_KEY` resides exclusively in server-side `process.env` inside `/ml/geminiClient.ts` and is never bundled into `/src/frontend/`.
