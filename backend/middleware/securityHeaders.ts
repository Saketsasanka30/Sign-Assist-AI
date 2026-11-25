import type { NextFunction, Request, Response } from "express";

const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://db.onlinewebfonts.com https://cdnjs.cloudflare.com",
  "font-src 'self' data: https://fonts.gstatic.com https://db.onlinewebfonts.com https://cdnjs.cloudflare.com",
  "img-src 'self' data: blob: https://huggingface.co https://datasets-server.huggingface.co",
  "media-src 'self' blob: data: https://d8j0ntlcm91z4.cloudfront.net",
  "connect-src 'self' https://storage.googleapis.com https://huggingface.co https://datasets-server.huggingface.co",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Content-Security-Policy", CSP_POLICY);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(self), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cache-Control", req.path.startsWith("/api/") ? "no-store" : "no-cache");

  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
}

/**
 * Enforces same-origin verification on mutating /api/* calls to mitigate CSRF without wildcard CORS.
 */
export function apiOriginGuardMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.path.startsWith("/api/")) {
    next();
    return;
  }

  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }

  const originHeader = req.headers.origin;
  const hostHeader = (req.headers["x-forwarded-host"] || req.headers.host || "")
    .toString()
    .split(",")[0]
    .trim();

  if (originHeader && hostHeader) {
    try {
      const originHost = new URL(originHeader).host;
      if (originHost !== hostHeader) {
        res.status(403).json({ error: "Cross-origin request rejected." });
        return;
      }
    } catch {
      res.status(403).json({ error: "Invalid origin header." });
      return;
    }
  }

  next();
}
