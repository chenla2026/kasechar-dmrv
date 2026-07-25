import fs from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadLocalEnv() {
  const candidateFiles = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "../../.env.local"),
    path.resolve(__dirname, "../../.env")
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

const MODEL_NAME = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
const HIGH_REASONING_MODEL = process.env.GEMINI_PRO_MODEL ?? "gemini-1.5-pro";
const PROMPT_VERSION = "kasechar-brain-v3-provenance";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";

const DATA_DIR = path.resolve(__dirname, "../data");
const AUDIT_LOG_FILE = path.join(DATA_DIR, "audit-log.json");

let AUDIT_LOG = [];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadAuditLog() {
  ensureDataDir();
  if (fs.existsSync(AUDIT_LOG_FILE)) {
    try {
      const raw = fs.readFileSync(AUDIT_LOG_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        AUDIT_LOG = parsed;
      }
    } catch (error) {
      console.error("Failed to read audit log file:", error);
      AUDIT_LOG = [];
    }
  }
}

loadAuditLog();

function saveAuditLog() {
  ensureDataDir();
  try {
    fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(AUDIT_LOG, null, 2), "utf8");
  } catch (error) {
    console.error("Failed to save audit log file:", error);
  }
}

function now() {
  return new Date().toISOString();
}

function ensureArray(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
}

function sanitizeStrings(values) {
  return values
    .filter((entry) => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toText(value) {
  if (typeof value === "string") {
    return value.trim();
  }
  return "";
}

function clampConfidence(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.5;
  }
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function computeHash(data) {
  return createHash("sha256").update(typeof data === "string" ? data : JSON.stringify(data)).digest("hex");
}

function normalizeExtraction(raw) {
  return {
    feedstockEvidence: {
      feedstockType: toText(raw?.feedstockEvidence?.feedstockType),
      sourceLocation: toText(raw?.feedstockEvidence?.sourceLocation),
      supplierName: toText(raw?.feedstockEvidence?.supplierName),
      biomassOrigin: toText(raw?.feedstockEvidence?.biomassOrigin),
      contaminationRisk: toText(raw?.feedstockEvidence?.contaminationRisk),
      sustainabilityConcern: toText(raw?.feedstockEvidence?.sustainabilityConcern),
    },
    productionEvidence: {
      pyrolysisDate: toText(raw?.productionEvidence?.pyrolysisDate),
      technologyType: toText(raw?.productionEvidence?.technologyType),
      temperatureRange: toText(raw?.productionEvidence?.temperatureRange),
      batchId: toText(raw?.productionEvidence?.batchId),
      batchQuantity: toText(raw?.productionEvidence?.batchQuantity),
      energyUse: toText(raw?.productionEvidence?.energyUse),
      producerIdentity: toText(raw?.productionEvidence?.producerIdentity),
    },
    qualityEvidence: {
      labReportAvailable: toText(raw?.qualityEvidence?.labReportAvailable),
      carbonContent: toText(raw?.qualityEvidence?.carbonContent),
      moisture: toText(raw?.qualityEvidence?.moisture),
      ashContent: toText(raw?.qualityEvidence?.ashContent),
      hcRatio: toText(raw?.qualityEvidence?.hcRatio),
      stabilityEvidence: toText(raw?.qualityEvidence?.stabilityEvidence),
      contaminationIndicators: toText(raw?.qualityEvidence?.contaminationIndicators),
    },
    applicationEvidence: {
      applicationLocation: toText(raw?.applicationEvidence?.applicationLocation),
      applicationDate: toText(raw?.applicationEvidence?.applicationDate),
      applicationQuantity: toText(raw?.applicationEvidence?.applicationQuantity),
      cropOrLandType: toText(raw?.applicationEvidence?.cropOrLandType),
      responsiblePerson: toText(raw?.applicationEvidence?.responsiblePerson),
      geotagPhotoEvidence: toText(raw?.applicationEvidence?.geotagPhotoEvidence),
    },
    storageEvidence: {
      permanenceClass: toText(raw?.storageEvidence?.permanenceClass),
      monitoringPlan: toText(raw?.storageEvidence?.monitoringPlan),
      reversalRisk: toText(raw?.storageEvidence?.reversalRisk),
      leakageRisk: toText(raw?.storageEvidence?.leakageRisk),
      doubleCountingRisk: toText(raw?.storageEvidence?.doubleCountingRisk),
    },
    eudrEvidence: {
      productionPlotGeolocation: toText(raw?.eudrEvidence?.productionPlotGeolocation),
      productionPeriod: toText(raw?.eudrEvidence?.productionPeriod),
      commodityOrBiomassSource: toText(raw?.eudrEvidence?.commodityOrBiomassSource),
      supplierFarmerProducerIdentity: toText(raw?.eudrEvidence?.supplierFarmerProducerIdentity),
      noDeforestationEvidence: toText(raw?.eudrEvidence?.noDeforestationEvidence),
      legalityEvidence: toText(raw?.eudrEvidence?.legalityEvidence),
      landUseHistoryEvidence: toText(raw?.eudrEvidence?.landUseHistoryEvidence),
      satelliteMapEvidence: toText(raw?.eudrEvidence?.satelliteMapEvidence),
      riskStatus: toText(raw?.eudrEvidence?.riskStatus),
      latitude: toText(raw?.eudrEvidence?.latitude),
      longitude: toText(raw?.eudrEvidence?.longitude),
      polygonGeometry: toText(raw?.eudrEvidence?.polygonGeometry),
      crs: toText(raw?.eudrEvidence?.crs),
      coordinateSource: toText(raw?.eudrEvidence?.coordinateSource),
      captureDate: toText(raw?.eudrEvidence?.captureDate),
      linkedPlotRecord: toText(raw?.eudrEvidence?.linkedPlotRecord),
    },
  };
}

function normalizeGapSummary(raw) {
  return {
    missingRequiredFields: ensureArray(raw?.missingRequiredFields),
    missingGeolocation: Boolean(raw?.missingGeolocation),
    missingLegalityEvidence: Boolean(raw?.missingLegalityEvidence),
  };
}

function normalizeEudrGapSummary(raw) {
  return {
    missingRequiredFields: ensureArray(raw?.missingRequiredFields),
    missingGeolocation: Boolean(raw?.missingGeolocation),
    missingLegalityEvidence: Boolean(raw?.missingLegalityEvidence),
    missingDeforestationEvidence: Boolean(raw?.missingDeforestationEvidence),
    missingLandUseHistoryEvidence: Boolean(raw?.missingLandUseHistoryEvidence),
    missingSatelliteEvidence: Boolean(raw?.missingSatelliteEvidence),
    highDeforestationRisk: Boolean(raw?.highDeforestationRisk),
  };
}

function parseJsonFromModel(rawText) {
  if (typeof rawText !== "string") return null;
  const fencedMatch = rawText.match(/```json([\s\S]*?)```/i);
  const extracted = fencedMatch ? fencedMatch[1] : rawText;
  const first = extracted.indexOf("{");
  const last = extracted.lastIndexOf("}");
  const candidate = first >= 0 && last > first ? extracted.slice(first, last + 1) : extracted;
  try {
    return JSON.parse(candidate);
  } catch (error) {
    return null;
  }
}

function buildPrompt(action, payload) {
  const context = JSON.stringify(payload.context?.batchContext ?? {});
  const evidenceText = String(payload?.evidenceText || payload?.context?.evidenceText || "");
  const base =
    "You are a protected evidence engine inside a compliance support tool for KaseChar Biochar dMRV and EUDR evidence support.\n" +
    "Return strict JSON only.\n" +
    "Do not make legal or credit decisions. Do not claim legal compliance or approve carbon credits.\n" +
    "Do not invent values or default measurements. Every extracted value must be explicitly supported by the input evidence text.\n" +
    "If evidence is ambiguous or conflicting, include explicit riskFlags describing the contradiction.\n" +
    `Context JSON:\n${context}\n\nInput Evidence Text to Analyze:\n${evidenceText}`;

  if (action === "extract-evidence") {
    return `${base}\n\nAction: extract-evidence.\n` +
      `From evidence text, return JSON with this exact root keys:\n` +
      `{\n` +
      `  "extraction": {\n` +
      `    "feedstockEvidence": {"feedstockType":"", "sourceLocation":"", "supplierName":"", "biomassOrigin":"", "contaminationRisk":"", "sustainabilityConcern":""},\n` +
      `    "productionEvidence": {"pyrolysisDate":"", "technologyType":"", "temperatureRange":"", "batchId":"", "batchQuantity":"", "energyUse":"", "producerIdentity":""},\n` +
      `    "qualityEvidence": {"labReportAvailable":"", "carbonContent":"", "moisture":"", "ashContent":"", "hcRatio":"", "stabilityEvidence":"", "contaminationIndicators":""},\n` +
      `    "applicationEvidence": {"applicationLocation":"", "applicationDate":"", "applicationQuantity":"", "cropOrLandType":"", "responsiblePerson":"", "geotagPhotoEvidence":""},\n` +
      `    "storageEvidence": {"permanenceClass":"", "monitoringPlan":"", "reversalRisk":"", "leakageRisk":"", "doubleCountingRisk":""},\n` +
      `    "eudrEvidence": {"productionPlotGeolocation":"", "productionPeriod":"", "commodityOrBiomassSource":"", "supplierFarmerProducerIdentity":"", "noDeforestationEvidence":"", "legalityEvidence":"", "landUseHistoryEvidence":"", "satelliteMapEvidence":"", "riskStatus":"", "latitude":"", "longitude":"", "polygonGeometry":"", "crs":"", "coordinateSource":"", "captureDate":"", "linkedPlotRecord":""}\n` +
      `  },\n` +
      `  "findings": [],\n` +
      `  "missingEvidence": [],\n` +
      `  "riskFlags": [],\n` +
      `  "riskStatus": "",\n` +
      `  "summary": "",\n` +
      `  "confidence": 0\n` +
      `}`;
  }

  if (action === "classify-evidence") {
    return `${base}\n\nAction: classify-evidence.\n` +
      `From evidence text, return JSON with keys:\n` +
      `{ "classifications": [], "confidence": 0, "rationale": "", "missingEvidence": [], "riskFlags": [], "riskStatus": "" }`;
  }

  if (action === "detect-evidence-gaps") {
    return `${base}\n\nAction: detect-evidence-gaps.\n` +
      `From context and evidence, analyze for missing evidence, conflicting information across sources, and EUDR geolocation/legality gaps. Return JSON with keys:\n` +
      `{ "gapSummary": { "missingRequiredFields": [], "missingGeolocation": false, "missingLegalityEvidence": false },` +
      ` "eudrGapSummary": { "missingRequiredFields": [], "missingGeolocation": false, "missingLegalityEvidence": false, "missingDeforestationEvidence": false, "missingLandUseHistoryEvidence": false, "missingSatelliteEvidence": false, "highDeforestationRisk": false },` +
      ` "riskFlags": [], "riskStatus": "", "confidence": 0, "summary": "" }`;
  }

  return `${base}\n\nAction: due-diligence-summary.\n` +
    `From evidence and context, synthesize a due-diligence support summary. Highlight any conflicting evidence or high-risk factors. Return JSON with keys:\n` +
    `{ "summary": "", "riskFlags": [], "riskStatus": "", "confidence": 0, "gapSummary": {"missingRequiredFields": []}, "eudrGapSummary": {"missingRequiredFields": []} }`;
}

async function invokeModel(prompt, modelName) {
  const activeKey = (process.env.GEMINI_API_KEY || GEMINI_API_KEY || "").trim();
  const mode = (process.env.GEMINI_MODE || (activeKey ? "live" : "fixture")).trim().toLowerCase();

  if (mode === "live" && !activeKey) {
    return { status: "blocked", error: "GEMINI_API_KEY missing while GEMINI_MODE=live. Live execution rejected." };
  }

  if (mode === "fixture" || !activeKey) {
    return {
      status: "ok",
      upstreamStatus: null,
      upstreamStatusText: "FIXTURE_MODE",
      parsed: {
        summary: "[FIXTURE MODE: Real Gemini execution unverified — GEMINI_API_KEY not set or GEMINI_MODE=fixture] Extracted dMRV parameters from evidence.",
        confidence: 0.95,
        riskStatus: "ASSESSABLE",
        riskFlags: ["[FIXTURE MODE] Real Gemini execution unverified; using safe demonstration fixture."],
        extraction: {
          feedstockEvidence: {
            feedstockType: "Forestry thinnings",
            sourceLocation: "Parc Naturel Régional des Landes",
            supplierName: "Landes Biomass Coop",
            biomassOrigin: "Sustainably managed pine forest",
            contaminationRisk: "Low",
            sustainabilityConcern: "None - FSC certified",
          },
          productionEvidence: {
            pyrolysisDate: "2026-06-01",
            technologyType: "Continuous rotary kiln pyrolysis",
            temperatureRange: "550-600 C",
            batchQuantity: "50 metric tons",
            energyUse: "Self-sustaining syngas loop",
          },
          qualityEvidence: {
            labReportAvailable: "Yes - Report #LR-2026-99",
            carbonContent: "84.5%",
            moisture: "3.2%",
            ashContent: "6.1%",
            hcRatio: "0.28",
            stabilityEvidence: "H:Corg < 0.4 indicates >1000 yr permanence",
          },
          storageEvidence: {
            permanenceClass: "Class A (>1000 yrs)",
            monitoringPlan: "Annual soil sampling and GPS tracking",
            reversalRisk: "Negligible",
            leakageRisk: "None",
            doubleCountingRisk: "None - registered exclusively on KaseChar",
          },
          eudrEvidence: {
            productionPlotGeolocation: "GPS 44.8378, -0.5792",
            productionPeriod: "2025 Q4",
            commodityOrBiomassSource: "Wood chips from thinning",
            supplierFarmerProducerIdentity: "Bavaria Timber GmbH",
            noDeforestationEvidence: "Copernicus satellite verification shows forest cover unchanged since 2018",
            legalityEvidence: "German harvesting permit #GER-2025-8891 verified",
            latitude: "48.1351",
            longitude: "11.5820",
            crs: "WGS84",
            coordinateSource: "GPS",
          },
        },
        findings: ["Extracted pyrolysis and quality parameters", "Verified H:C ratio meets permanence threshold"],
        missingEvidence: [],
        classifications: ["BIOCHAR_PRODUCTION", "LAB_REPORT", "EUDR_LEGALITY"],
      },
    };
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: activeKey,
      backend: "google",
    });
    const res = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        temperature: 0.05,
        responseMimeType: "application/json",
      },
    });

    const rawText = res.text || "";
    const parsed = parseJsonFromModel(rawText);

    if (!parsed) {
      return { status: "failed", error: "Model response was not parseable JSON", upstreamStatus: 200, upstreamStatusText: "OK - Unparseable JSON" };
    }

    return { status: "ok", parsed, upstreamStatus: 200, upstreamStatusText: "OK" };
  } catch (err) {
    const status = err.status || err.statusCode || 500;
    const msg = err.message || String(err);
    return { status: "failed", error: `${status}: ${msg}`, upstreamStatus: status, upstreamStatusText: "SDK Error" };
  }
}

function normalizeResult(action, parsed) {
  const riskFlags = [...new Set(sanitizeStrings(ensureArray(parsed.riskFlags)).map((item) => item))];
  const base = {
    confidence: clampConfidence(parsed.confidence),
    riskFlags,
    summary: toText(parsed.summary),
    rationale: toText(parsed.rationale),
    findings: sanitizeStrings(ensureArray(parsed.findings)),
    missingEvidence: sanitizeStrings(ensureArray(parsed.missingEvidence)),
    classifications: sanitizeStrings(ensureArray(parsed.classifications)),
    riskStatus: toText(parsed.riskStatus),
    gapSummary: normalizeGapSummary(parsed.gapSummary),
    eudrGapSummary: normalizeEudrGapSummary(parsed.eudrGapSummary),
  };

  if (action === "extract-evidence") {
    return {
      extraction: normalizeExtraction(parsed.extraction),
      findings: base.findings,
      missingEvidence: base.missingEvidence,
      riskFlags,
      riskStatus: base.riskStatus,
      summary: base.summary,
      confidence: base.confidence,
      gapSummary: base.gapSummary,
      eudrGapSummary: base.eudrGapSummary,
    };
  }

  if (action === "classify-evidence") {
    return {
      classifications: base.classifications,
      rationale: base.rationale,
      confidence: base.confidence,
      riskFlags,
      riskStatus: base.riskStatus,
      missingEvidence: base.missingEvidence,
      gapSummary: base.gapSummary,
      eudrGapSummary: base.eudrGapSummary,
      summary: base.summary,
    };
  }

  if (action === "detect-evidence-gaps") {
    return {
      confidence: base.confidence,
      riskFlags,
      riskStatus: base.riskStatus,
      gapSummary: base.gapSummary,
      eudrGapSummary: base.eudrGapSummary,
      summary: base.summary,
      missingEvidence: base.missingEvidence,
      classifications: base.classifications,
    };
  }

  return {
    summary: base.summary,
    classifications: base.classifications,
    riskFlags,
    riskStatus: base.riskStatus,
    confidence: base.confidence,
    gapSummary: base.gapSummary,
    eudrGapSummary: base.eudrGapSummary,
    missingEvidence: base.missingEvidence,
  };
}

function classifyOutputStatus(actionResult, raw) {
  if (actionResult === "blocked") return "blocked";
  if (actionResult === "failed") return "missing";
  const confidence = clampConfidence(raw.confidence);
  if (confidence < 0.5) return "missing";
  return "accepted";
}

function verifyTraceability(extraction, evidenceText) {
  const issues = [];
  const unsupportedFields = [];
  const fieldProvenance = {};
  if (!extraction || typeof extraction !== "object") {
    return { valid: true, issues, unsupportedFields, fieldProvenance };
  }

  const normText = (evidenceText || "").toLowerCase();

  for (const [groupKey, groupVals] of Object.entries(extraction)) {
    if (!groupVals || typeof groupVals !== "object") continue;
    for (const [fieldKey, fieldVal] of Object.entries(groupVals)) {
      if (!fieldVal || typeof fieldVal !== "string" || !fieldVal.trim()) continue;
      const valText = fieldVal.trim();
      const words = valText.toLowerCase().split(/\s+/).filter((w) => w.length >= 3 && !["the", "and", "for", "with", "from"].includes(w));
      
      let found = false;
      if (words.length === 0) {
        found = true;
      } else {
        const matchingWords = words.filter((w) => normText.includes(w));
        if (matchingWords.length > 0 || normText.includes(valText.toLowerCase())) {
          found = true;
        }
      }

      if (!found) {
        unsupportedFields.push(fieldKey);
        issues.push(`[PROVENANCE FAILURE] Extracted value '${valText}' for '${fieldKey}' was not found in input evidence source`);
        groupVals[fieldKey] = "";
      } else {
        fieldProvenance[fieldKey] = {
          evidenceIds: [],
          sourceReferences: [],
          value: valText,
          extractedAt: now(),
          supportedByEvidence: true,
        };
      }
    }
  }

  return {
    valid: unsupportedFields.length === 0,
    issues,
    unsupportedFields,
    fieldProvenance,
  };
}

export function recordAudit(event) {
  const eventId = event.eventId || event.id || randomUUID();
  const timestamp = event.timestamp || now();
  const prevRecord = AUDIT_LOG[0];
  const prevHash = prevRecord ? (prevRecord.eventHash || computeHash(JSON.stringify(prevRecord))) : "GENESIS_HASH";
  
  const auditRecord = {
    ...event,
    id: eventId,
    eventId,
    timestamp,
    actor: event.actor || "system:gemini-controller",
    projectId: event.projectId || "default-project",
    track: event.track || "BOTH",
    validationStatus: event.validationStatus || (event.status === "error" ? "INVALID" : "VALID"),
    inputEvidenceIds: ensureArray(event.inputEvidenceIds || []),
    outputReference: event.outputReference || "N/A",
    modelName: event.modelName || event.model || MODEL_NAME,
    promptVersion: event.promptVersion || PROMPT_VERSION,
    prevHash,
  };

  const eventHash = computeHash(JSON.stringify({ ...auditRecord, eventHash: undefined }));
  auditRecord.eventHash = eventHash;

  AUDIT_LOG.unshift(auditRecord);
  while (AUDIT_LOG.length > 500) {
    AUDIT_LOG.pop();
  }

  saveAuditLog();
  return auditRecord;
}

export function getAuditLog() {
  return AUDIT_LOG;
}

export async function runBrainAnalysis(payload) {
  const action = String(payload?.action || "extract-evidence");
  const requestStart = now();
  const evidenceText = String(payload?.evidenceText || "");
  const requestId = `req-${randomUUID().slice(0, 8)}`;
  const projectId = String(payload?.metadata?.projectId || payload?.context?.batchContext?.batchId || "default-project");
  const track = payload?.metadata?.track || "BOTH";
  const inputEvidenceIds = ensureArray(payload?.metadata?.inputEvidenceIds || [payload?.evidenceId || ""]).filter(Boolean);
  const sourceReferences = ensureArray(payload?.metadata?.sourceReferences || [payload?.metadata?.sourceLabel || payload?.metadata?.fileName || ""]).filter(Boolean);

  const selectedModel = (action === "due-diligence-summary" || action === "detect-evidence-gaps") && payload?.metadata?.useProModel ? HIGH_REASONING_MODEL : MODEL_NAME;

  if (!evidenceText.trim()) {
    const blockedResult = {
      confidence: 0,
      summary: "No evidence text provided.",
    };
    const blockedHash = computeHash(blockedResult);
    const blocked = {
      action,
      status: "error",
      model: selectedModel,
      modelName: selectedModel,
      promptVersion: PROMPT_VERSION,
      inputType: payload?.metadata?.inputType || "text",
      outputStatus: "blocked",
      recordedAt: now(),
      result: blockedResult,
      errorMessage: "No evidence text provided",
      requestId,
      projectId,
      track,
      inputEvidenceIds,
      sourceReferences,
      extractedAt: now(),
      structuredOutput: blockedResult,
      validationResult: { valid: false, issues: ["No evidence text provided"], unsupportedFields: [] },
      confidence: 0,
      outputHash: blockedHash,
      failureReason: "No evidence text provided",
    };

    recordAudit({
      eventId: randomUUID(),
      timestamp: requestStart,
      actor: "system:gemini-controller",
      projectId,
      track,
      action: blocked.action,
      status: blocked.status,
      validationStatus: "BLOCKED",
      inputEvidenceIds,
      outputReference: blockedHash,
      model: blocked.model,
      modelName: blocked.modelName,
      promptVersion: blocked.promptVersion,
      inputType: blocked.inputType,
      outputStatus: blocked.outputStatus,
      sourceLabel: sourceReferences[0] || "manual",
      sourceEvidenceCount: payload?.metadata?.evidenceCount || inputEvidenceIds.length,
      summary: blocked.result.summary,
      issues: [blocked.errorMessage],
    });

    return blocked;
  }

  const prompt = buildPrompt(action, payload);
  const rawModel = await invokeModel(prompt, selectedModel);

  if (rawModel.status === "blocked") {
    const blockedResult = {
      confidence: 0,
      summary: rawModel.error || "Blocked by controller policy",
    };
    const blockedHash = computeHash(blockedResult);
    const blocked = {
      action,
      status: "error",
      model: selectedModel,
      modelName: selectedModel,
      promptVersion: PROMPT_VERSION,
      inputType: payload?.metadata?.inputType || "text",
      outputStatus: "blocked",
      recordedAt: now(),
      result: blockedResult,
      errorMessage: rawModel.error || "Blocked",
      requestId,
      projectId,
      track,
      inputEvidenceIds,
      sourceReferences,
      extractedAt: now(),
      structuredOutput: blockedResult,
      validationResult: { valid: false, issues: [rawModel.error || "Blocked"], unsupportedFields: [] },
      confidence: 0,
      outputHash: blockedHash,
      refusalReason: rawModel.error || "Blocked by model guardrails",
    };

    recordAudit({
      eventId: randomUUID(),
      timestamp: requestStart,
      actor: "system:gemini-controller",
      projectId,
      track,
      action: blocked.action,
      status: blocked.status,
      validationStatus: "BLOCKED",
      inputEvidenceIds,
      outputReference: blockedHash,
      model: blocked.model,
      modelName: blocked.modelName,
      promptVersion: blocked.promptVersion,
      inputType: blocked.inputType,
      outputStatus: blocked.outputStatus,
      sourceLabel: sourceReferences[0] || "manual",
      sourceEvidenceCount: payload?.metadata?.evidenceCount || inputEvidenceIds.length,
      summary: blocked.result.summary,
      issues: [blocked.errorMessage],
    });

    return blocked;
  }

  if (rawModel.status === "failed") {
    const failedResult = {
      confidence: 0,
      summary: rawModel.error || "Model invocation failed",
    };
    const failedHash = computeHash(failedResult);
    const error = {
      action,
      status: "error",
      upstreamStatus: rawModel.upstreamStatus || 500,
      upstreamStatusText: rawModel.upstreamStatusText || "Upstream Error",
      model: selectedModel,
      modelName: selectedModel,
      promptVersion: PROMPT_VERSION,
      inputType: payload?.metadata?.inputType || "text",
      outputStatus: "missing",
      recordedAt: now(),
      result: failedResult,
      errorMessage: rawModel.error || "Model invocation failed",
      requestId,
      projectId,
      track,
      inputEvidenceIds,
      sourceReferences,
      extractedAt: now(),
      structuredOutput: failedResult,
      validationResult: { valid: false, issues: [rawModel.error || "Failed"], unsupportedFields: [] },
      confidence: 0,
      outputHash: failedHash,
      failureReason: rawModel.error || "Model invocation failed",
    };

    recordAudit({
      eventId: randomUUID(),
      timestamp: requestStart,
      actor: "system:gemini-controller",
      projectId,
      track,
      action: error.action,
      status: error.status,
      validationStatus: "INVALID",
      inputEvidenceIds,
      outputReference: failedHash,
      model: error.model,
      modelName: error.modelName,
      promptVersion: error.promptVersion,
      inputType: error.inputType,
      outputStatus: error.outputStatus,
      sourceLabel: sourceReferences[0] || "manual",
      sourceEvidenceCount: payload?.metadata?.evidenceCount || inputEvidenceIds.length,
      summary: error.result.summary,
      issues: [error.errorMessage],
    });

    return error;
  }

  const output = normalizeResult(action, rawModel.parsed);
  
  let validationResult = { valid: true, issues: [], unsupportedFields: [], fieldProvenance: {} };
  if (action === "extract-evidence" && output.extraction) {
    validationResult = verifyTraceability(output.extraction, evidenceText);
    if (!validationResult.valid) {
      output.riskFlags = [...output.riskFlags, ...validationResult.unsupportedFields.map(f => `[UNSUPPORTED EXTRACTION] Field '${f}' unverified against evidence source`)];
    }
    for (const prov of Object.values(validationResult.fieldProvenance)) {
      prov.evidenceIds = inputEvidenceIds;
      prov.sourceReferences = sourceReferences;
    }
    output.fieldProvenance = validationResult.fieldProvenance;
  }

  output.validationResult = {
    valid: validationResult.valid,
    issues: validationResult.issues,
    unsupportedFields: validationResult.unsupportedFields,
  };

  const outputStatus = classifyOutputStatus("ok", output);
  const outputHash = computeHash(output);
  output.outputHash = outputHash;

  const response = {
    action,
    status: outputStatus === "missing" || !validationResult.valid ? "partial" : "success",
    upstreamStatus: rawModel.upstreamStatus || 200,
    upstreamStatusText: rawModel.upstreamStatusText || "OK",
    model: selectedModel,
    modelName: selectedModel,
    promptVersion: PROMPT_VERSION,
    inputType: payload?.metadata?.inputType || "text",
    outputStatus: !validationResult.valid ? "missing" : outputStatus,
    recordedAt: now(),
    result: {
      extraction: output.extraction,
      findings: output.findings,
      gapSummary: output.gapSummary,
      eudrGapSummary: output.eudrGapSummary,
      classifications: output.classifications,
      riskFlags: output.riskFlags,
      riskStatus: output.riskStatus,
      summary: output.summary,
      rationale: output.rationale,
      confidence: output.confidence,
      missingEvidence: output.missingEvidence,
      fieldProvenance: output.fieldProvenance,
      validationResult: output.validationResult,
      outputHash,
    },
    requestId,
    projectId,
    track,
    inputEvidenceIds,
    sourceReferences,
    extractedAt: now(),
    structuredOutput: output,
    validationResult: output.validationResult,
    confidence: output.confidence,
    outputHash,
  };

  recordAudit({
    eventId: randomUUID(),
    timestamp: requestStart,
    actor: "system:gemini-controller",
    projectId,
    track,
    action,
    status: response.status,
    validationStatus: validationResult.valid ? "VALID" : "UNSUPPORTED",
    inputEvidenceIds,
    outputReference: outputHash,
    model: response.modelName,
    modelName: response.modelName,
    promptVersion: response.promptVersion,
    inputType: response.inputType,
    outputStatus: response.outputStatus,
    sourceLabel: sourceReferences[0] || "manual",
    sourceEvidenceCount: payload?.metadata?.evidenceCount || inputEvidenceIds.length,
    summary: response.result.summary || response.result.rationale,
    issues: [...(response.result.missingEvidence || []), ...(response.result.riskFlags || []), ...validationResult.issues],
  });

  return response;
}
