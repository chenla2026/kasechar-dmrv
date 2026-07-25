import type { AuditLogEvent, BrainRequest, BrainResponse, BrainAction } from "../types";

const ENDPOINTS = {
  analyze: "/api/gemini/analyze",
  logs: "/api/audit-log",
};

const requestDefaults = {
  method: "POST",
  headers: {
    "content-type": "application/json",
  },
};

export async function runBrainAnalysis(request: BrainRequest): Promise<BrainResponse> {
  const response = await fetch(ENDPOINTS.analyze, {
    ...requestDefaults,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const body = await response.text();
    return {
      action: request.action,
      status: "error",
      model: "N/A",
      promptVersion: "N/A",
      inputType: request.metadata.inputType,
      outputStatus: "blocked",
      recordedAt: new Date().toISOString(),
      result: {
        summary: body || "Server unavailable",
        confidence: 0,
      },
      errorMessage: `Request failed (${response.status} ${response.statusText}): ${body}`,
      requestId: `req-err-${Math.random().toString(36).slice(2, 10)}`,
      projectId: request.metadata.projectId || "unknown-project",
      track: request.metadata.track || "BOTH",
      inputEvidenceIds: request.metadata.inputEvidenceIds || [request.evidenceId],
      sourceReferences: request.metadata.sourceReferences || [request.metadata.sourceLabel],
      modelName: "N/A",
      modelVersion: "N/A",
      extractedAt: new Date().toISOString(),
      structuredOutput: {
        summary: body || "Server unavailable",
        confidence: 0,
      },
      validationResult: {
        valid: false,
        issues: [body || "Server unavailable"],
        unsupportedFields: [],
      },
      confidence: 0,
      outputHash: "error-hash",
      failureReason: `Request failed (${response.status} ${response.statusText}): ${body}`,
    };
  }

  const body = (await response.json()) as BrainResponse;

  return body;
}

export async function getAuditLog(): Promise<AuditLogEvent[]> {
  const response = await fetch(ENDPOINTS.logs);
  if (!response.ok) {
    return [];
  }

  return (await response.json()) as AuditLogEvent[];
}

export function requestHasValidAction(value: string): value is BrainAction {
  return [
    "extract-evidence",
    "classify-evidence",
    "detect-evidence-gaps",
    "due-diligence-summary",
  ].includes(value);
}
