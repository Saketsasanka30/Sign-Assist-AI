import express, { type Express } from "express";
import path from "path";
import { apiRouter } from "./routes/api";
import {
  apiOriginGuardMiddleware,
  securityHeadersMiddleware,
} from "./middleware/securityHeaders";

export function createBackendApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(securityHeadersMiddleware);
  app.use(apiOriginGuardMiddleware);

  app.use(express.json({ limit: "160mb" }));
  app.use(express.urlencoded({ limit: "160mb", extended: false }));

  // Serve local MediaPipe WASM binaries for client-side hand skeletal tracking
  const mediapipeWasmDir = path.join(
    process.cwd(),
    "node_modules",
    "@mediapipe",
    "tasks-vision",
    "wasm"
  );
  app.use("/mediapipe/wasm", express.static(mediapipeWasmDir, { maxAge: "1d" }));

  app.use("/api", apiRouter);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = typeof err?.status === "number" ? err.status : 500;
    const message = status < 500 ? err.message : "Internal server error.";
    res.status(status).json({ error: message });
  });

  return app;
}
