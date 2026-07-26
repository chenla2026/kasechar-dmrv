import fs from "node:fs";
import path from "node:path";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { createServer as createViteServer } from "vite";
import { getAuditLog, runBrainAnalysis } from "./brain/geminiBrain.mjs";
import { getSonnenerdeDemonstration } from "./controller/sonnenerdeDemo.mjs";

function loadLocalEnv() {
  const candidateFiles = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env.local"),
    path.resolve(process.cwd(), "../.env")
  ];
  for (const file of candidateFiles) {
    if (fs.existsSync(file)) {
      try {
        const lines = fs.readFileSync(file, "utf8").split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const idx = trimmed.indexOf("=");
          if (idx > 0) {
            const key = trimmed.slice(0, idx).trim();
            let val = trimmed.slice(idx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (process.env[key] === undefined || process.env[key] === "") {
              process.env[key] = val;
            }
          }
        }
      } catch (err) {}
    }
  }
}
loadLocalEnv();

const PORT = Number(process.env.PORT || 5173);
const DIST_DIR = path.resolve(process.cwd(), "dist");
const IS_PROD = process.argv.includes("--prod");

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".mjs", "application/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".webp", "image/webp"],
  [".json", "application/json; charset=utf-8"],
]);

const DEFAULT_HTML = path.join(DIST_DIR, "index.html");

function mimeType(filePath) {
  return MIME_TYPES.get(path.extname(filePath)) || "application/octet-stream";
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json",
    "cache-control": "no-store",
  });
  response.end(payload);
}

function sendText(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store",
  });
  response.end(body);
}

async function collectJson(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) {
    return {};
  }

  return JSON.parse(raw);
}

function safeServeStatic(response, requestPath) {
  let normalized = requestPath === "/" ? "/index.html" : requestPath;
  normalized = normalized.split("?")[0];
  const candidate = path.resolve(DIST_DIR, decodeURIComponent(normalized).replace(/^\//, ""));
  const safeRoot = DIST_DIR + path.sep;

  if (!candidate.startsWith(safeRoot) || !fs.existsSync(candidate) || fs.statSync(candidate).isDirectory()) {
    if (!fs.existsSync(DEFAULT_HTML)) {
      sendText(response, 500, "dist index missing, run npm run build first");
      return;
    }

    response.setHeader("content-type", "text/html; charset=utf-8");
    createReadStream(DEFAULT_HTML).pipe(response);
    return;
  }

  response.setHeader("content-type", mimeType(candidate));
  createReadStream(candidate).pipe(response);
}

async function run() {
  let vite;
  if (!IS_PROD) {
    vite = await createViteServer({
      server: {
        middlewareMode: true,
      },
    });
  }

  const server = createServer(async (request, response) => {
    const parsedUrl = new URL(request.url || "", `http://127.0.0.1:${PORT}`);
    const pathname = parsedUrl.pathname || "/";

    if (pathname === "/api/health") {
      sendJson(response, 200, {
        ok: true,
        modelConfigured: Boolean(process.env.GEMINI_API_KEY),
        environment: IS_PROD ? "production" : "development",
      });
      return;
    }

    if (pathname === "/api/demonstrations/sonnenerde" && request.method === "GET") {
      sendJson(response, 200, getSonnenerdeDemonstration());
      return;
    }

    if (pathname === "/api/audit-log" && request.method === "GET") {
      sendJson(response, 200, getAuditLog());
      return;
    }

    if (pathname === "/api/gemini/analyze" && request.method === "POST") {
      try {
        const clientIp = request.socket.remoteAddress || "127.0.0.1";
        const now = Date.now();
        if (!global.rateLimiter) {
          global.rateLimiter = new Map();
        }
        const userRate = global.rateLimiter.get(clientIp) || { count: 0, reset: now + 60000 };
        if (now > userRate.reset) {
          userRate.count = 0;
          userRate.reset = now + 60000;
        }
        userRate.count++;
        global.rateLimiter.set(clientIp, userRate);

        if (userRate.count > 100) {
          sendJson(response, 429, {
            action: "unknown",
            status: "error",
            model: "N/A",
            promptVersion: "N/A",
            inputType: "text",
            outputStatus: "blocked",
            recordedAt: new Date().toISOString(),
            result: { summary: "Rate limit exceeded. Please wait before submitting more requests.", confidence: 0 },
            errorMessage: "Rate limit exceeded (max 100 requests/min)",
            requestId: `req-rl-${Math.random().toString(36).slice(2, 10)}`,
            projectId: "unknown-project",
            track: "BOTH",
            inputEvidenceIds: [],
            sourceReferences: [],
            modelName: "N/A",
            modelVersion: "N/A",
            extractedAt: new Date().toISOString(),
            structuredOutput: { summary: "Rate limit exceeded", confidence: 0 },
            validationResult: { valid: false, issues: ["Rate limit exceeded"], unsupportedFields: [] },
            confidence: 0,
            outputHash: "rate-limit-hash",
            refusalReason: "Rate limit exceeded",
          });
          return;
        }

        const body = await collectJson(request);
        if (!body || typeof body !== "object") {
          throw new Error("Invalid request body: must be JSON object");
        }
        const validActions = ["extract-evidence", "classify-evidence", "detect-evidence-gaps", "due-diligence-summary"];
        if (body.action && !validActions.includes(body.action)) {
          throw new Error(`Invalid action parameter: ${body.action}`);
        }

        const analysis = await runBrainAnalysis(body);
        sendJson(response, 200, analysis);
      } catch (error) {
        sendJson(response, 500, {
          action: "unknown",
          status: "error",
          model: "N/A",
          promptVersion: "N/A",
          inputType: "text",
          outputStatus: "blocked",
          recordedAt: new Date().toISOString(),
          result: { summary: String(error), confidence: 0 },
          errorMessage: "Controller failed to process request: " + String(error),
          requestId: `req-err-${Math.random().toString(36).slice(2, 10)}`,
          projectId: "unknown-project",
          track: "BOTH",
          inputEvidenceIds: [],
          sourceReferences: [],
          modelName: "N/A",
          modelVersion: "N/A",
          extractedAt: new Date().toISOString(),
          structuredOutput: { summary: String(error), confidence: 0 },
          validationResult: { valid: false, issues: [String(error)], unsupportedFields: [] },
          confidence: 0,
          outputHash: "controller-error-hash",
          failureReason: String(error),
        });
      }
      return;
    }

    if (IS_PROD) {
      safeServeStatic(response, pathname);
      return;
    }

    if (vite) {
      vite.middlewares(request, response, () => {
        safeServeStatic(response, pathname);
      });
      return;
    }

    sendText(response, 500, "Server not ready");
  });

  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`KaseChar Gemini server listening on http://127.0.0.1:${PORT}`);
    // eslint-disable-next-line no-console
    console.log(`Mode: ${IS_PROD ? "production" : "development"}`);
  });
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
