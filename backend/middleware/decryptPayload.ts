import type { NextFunction, Request, Response } from "express";
import {
  cryptoEngine,
  SecurityEnvelopeError,
  type EncryptedEnvelope,
} from "../security/cryptoEngine";

/**
 * Unwraps and authenticates AES-256-GCM + RSA-OAEP encrypted client payloads.
 */
export function decryptPayloadMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    const body = req.body as EncryptedEnvelope;
    const expectedEndpoint = req.originalUrl.split("?")[0];
    const decrypted = cryptoEngine.decryptEnvelope(body, expectedEndpoint);
    req.body = decrypted;
    next();
  } catch (err) {
    if (err instanceof SecurityEnvelopeError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    res.status(400).json({ error: "Unable to verify encrypted payload." });
  }
}
