import fs from "node:fs";
import path from "node:path";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { createServer as createViteServer } from "vite";
import { getAuditLog, runBrainAnalysis } from "./brain/geminiBrain.mjs";
import { getSonnenerdeDemonstration } from "./controller/sonnenerdeDemo.mjs";
import { captureMethodologyDocument, getMethodologyVerificationPackage, registerMethodologyUserAssertion, runMethodologyPreflight } from "./controller/methodologyPreflight.mjs";
import { admitControlledDemoEvidence, checkControlledDocumentIntelligence, getMonitoringPackage, getMonitoringReport, getMonitoringWorkspace, resetControlledDemo, submitMonitoringEvent } from "./controller/monitoringWorkspace.mjs";
const IS_PRODUCTION = process.env.NODE_ENV === "production" || process.argv.includes("--prod");

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
if (process.env.KASECHAR_SKIP_LOCAL_ENV !== "1") loadLocalEnv();

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

const MAX_JSON_REQUEST_BYTES = 7 * 1024 * 1024;

async function collectJson(request) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    totalBytes += buffer.length;
    if (totalBytes > MAX_JSON_REQUEST_BYTES) {
      throw new Error("JSON request exceeds the server size limit.");
    }
    chunks.push(buffer);
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

    if (pathname === "/api/methodology/documents" && request.method === "POST") {
      try {
        const document = captureMethodologyDocument(await collectJson(request));
        sendJson(response, 201, document);
      } catch (error) {
        sendJson(response, 400, { error: "Methodology document capture was rejected.", details: String(error) });
      }
      return;
    }

    if (pathname === "/api/methodology/user-assertions" && request.method === "POST") {
      try {
        const assertion = registerMethodologyUserAssertion(await collectJson(request));
        sendJson(response, 201, assertion);
      } catch (error) {
        sendJson(response, 400, { error: "Methodology user assertion was rejected.", details: String(error) });
      }
      return;
    }

    if (pathname === "/api/methodology/preflight" && request.method === "POST") {
      try {
        const body = await collectJson(request);
        const result = runMethodologyPreflight(body);
        sendJson(response, 200, result);
      } catch (error) {
        sendJson(response, 400, { error: "Methodology pre-flight was rejected.", details: String(error) });
      }
      return;
    }

    if (pathname === "/api/methodology/packages" && request.method === "POST") {
      try {
        sendJson(response, 200, getMethodologyVerificationPackage(await collectJson(request)));
      } catch (error) {
        sendJson(response, 400, { error: "Methodology package export was rejected.", details: String(error) });
      }
      return;
    }

    if (pathname === "/api/monitoring/workspace" && request.method === "GET") {
      try { sendJson(response, 200, getMonitoringWorkspace(parsedUrl.searchParams.get("projectId") || "GCSP1134")); } catch { sendJson(response, 400, { error: "Monitoring workspace unavailable." }); }
      return;
    }
    if (pathname === "/api/monitoring/events" && request.method === "POST") {
      try { sendJson(response, 201, submitMonitoringEvent(await collectJson(request))); } catch (error) { sendJson(response, 400, { error: error instanceof Error ? error.message : "Monitoring event rejected." }); }
      return;
    }
    if (pathname === "/api/monitoring/demo-evidence" && request.method === "POST") {
      if (IS_PRODUCTION) { sendJson(response, 404, { error: "Controlled demo endpoint is unavailable." }); return; }
      try { sendJson(response, 201, admitControlledDemoEvidence(await collectJson(request))); } catch (error) { sendJson(response, 400, { error: error instanceof Error ? error.message : "Controlled demo evidence was rejected." }); }
      return;
    }
    if (pathname === "/api/monitoring/demo-reset" && request.method === "POST") {
      if (IS_PRODUCTION) { sendJson(response, 404, { error: "Controlled demo endpoint is unavailable." }); return; }
      try { sendJson(response, 200, resetControlledDemo(await collectJson(request))); } catch (error) { sendJson(response, 400, { error: error instanceof Error ? error.message : "Demo reset was rejected." }); }
      return;
    }
    if (pathname === "/api/monitoring/report" && request.method === "POST") {
      try { const body = await collectJson(request); sendJson(response, 200, getMonitoringReport(body.projectId || "GCSP1134")); } catch { sendJson(response, 400, { error: "Monitoring report unavailable." }); }
      return;
    }
    if (pathname === "/api/monitoring/packages" && request.method === "POST") {
      try { const pkg = getMonitoringPackage(await collectJson(request)); response.writeHead(200, { "content-type": "application/json", "content-disposition": `attachment; filename="${pkg.filename}"`, "cache-control": "no-store" }); response.end(pkg.body); } catch { sendJson(response, 400, { error: "Monitoring report is not ready for package export." }); }
      return;
    }
    if (pathname === "/api/monitoring/gemini-check" && request.method === "POST") {
      try { sendJson(response, 200, await checkControlledDocumentIntelligence()); } catch { sendJson(response, 200, { availability: "UNAVAILABLE", message: "Document intelligence is temporarily unavailable. Existing source-grounded monitoring records remain accessible.", sourceFileName: "1_Project_Design_Document_GCSP1134.pdf", sourcePageOrLocation: "p. 9", validationIssues: ["Live analysis was unavailable; deterministic monitoring records were not changed."] }); }
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
