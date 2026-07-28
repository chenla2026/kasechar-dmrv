import type { EvidenceAsset, MethodologyDocumentCaptureInput, MethodologyPreflightRequest, MethodologyPreflightResponse, MethodologyUserAssertionInput } from "../types";

const jsonRequest = { method: "POST", headers: { "content-type": "application/json" } };

async function post<T>(path: string, body: unknown, message: string): Promise<T> {
  const response = await fetch(path, { ...jsonRequest, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(message);
  return (await response.json()) as T;
}

export const captureMethodologyDocument = (input: MethodologyDocumentCaptureInput) => post<EvidenceAsset>("/api/methodology/documents", input, "The controller rejected this document capture.");
export const createMethodologyUserAssertion = (input: MethodologyUserAssertionInput) => post<EvidenceAsset>("/api/methodology/user-assertions", input, "The controller rejected this user assertion.");
export const runMethodologyPreflight = (request: MethodologyPreflightRequest) => post<MethodologyPreflightResponse>("/api/methodology/preflight", request, "The controller could not complete the methodology pre-flight.");

export async function exportMethodologyPackageBlob(assessmentId: string): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch("/api/methodology/packages", { ...jsonRequest, body: JSON.stringify({ assessmentId }) });
  if (!response.ok) {
    throw new Error("A ready independent-review package is not available.");
  }

  const contentDisposition = response.headers.get("content-disposition") || "";
  let filename = `methodology-package-${assessmentId}.json`;
  const match = /filename=\"?([^;\"]+)\"?/i.exec(contentDisposition);
  if (match?.[1]) {
    filename = match[1];
  }

  return { blob: await response.blob(), filename };
}
