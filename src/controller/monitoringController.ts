import type { GeminiAvailabilityResult, MonitoringEvent, MonitoringEvidenceRecord, MonitoringEvidenceType, MonitoringReport, MonitoringWorkspaceResponse } from "../types";

type EvidenceMetadataInput = {
  evidenceType: Exclude<MonitoringEvidenceType, "USER_ASSERTION">;
  sourceLabel: string;
  mimeType?: string;
  fileSize?: number;
  documentOrRecordDate?: string;
  sourcePageOrLocation?: string;
  gpsCoordinates?: string;
  captureTimestamp?: string;
  laboratoryOrThirdPartyIssuer?: string;
  operatorOrSubmittingParty: string;
};

type MonitoringEventInput = Pick<MonitoringEvent, "projectId" | "reportingPeriod" | "activityType" | "eventTimestamp" | "batchOrLotId" | "value" | "unit" | "operator"> & {
  monitoringPlanItemId: string;
  evidence?: EvidenceMetadataInput;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : "Monitoring controller request failed.");
  return body as T;
}
const post = <T>(url: string, body: unknown) => request<T>(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
export const loadMonitoringWorkspace = (projectId = "GCSP1134") => request<MonitoringWorkspaceResponse>(`/api/monitoring/workspace?projectId=${encodeURIComponent(projectId)}`);
export const submitMonitoringEvent = (event: MonitoringEventInput) => post<MonitoringEvent>("/api/monitoring/events", event);
export const admitControlledDemoEvidence = (projectId: string, reportingPeriod: string, evidenceType: MonitoringEvidenceRecord["evidenceType"], responsibleParty: string) => post<MonitoringEvidenceRecord>("/api/monitoring/demo-evidence", { projectId, reportingPeriod, evidenceType, responsibleParty });
export const resetControlledDemo = (projectId: string) => post<MonitoringWorkspaceResponse>("/api/monitoring/demo-reset", { projectId, confirmed: true });
export const refreshMonitoringReport = (projectId = "GCSP1134") => post<MonitoringReport>("/api/monitoring/report", { projectId });
export const checkControlledDocumentIntelligence = () => post<GeminiAvailabilityResult>("/api/monitoring/gemini-check", {});
export async function exportMonitoringPackage(projectId = "GCSP1134"): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch("/api/monitoring/packages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectId }) });
  if (!response.ok) throw new Error("Monitoring report is not ready for package export.");
  const disposition = response.headers.get("content-disposition") || "";
  const filename = /filename=\"?([^;\"]+)/i.exec(disposition)?.[1] || `monitoring-package-${projectId}.json`;
  return { blob: await response.blob(), filename };
}