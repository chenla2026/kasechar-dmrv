import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, FileText, RefreshCw, ShieldCheck, UploadCloud } from "lucide-react";
import type {
  AppScreen,
  AuditLogEvent,
  BatchForm,
  BrainAction,
  BrainRequest,
  ControlledStatus,
  EudrDecisionSignals,
  EvidenceRecord,
  EvidenceAsset,
  FacilityProfile,
  FeedstockLot,
  ProductionBatch,
  MeasurementAndCalibrationRecord,
  LaboratorySample,
  TransferAndInventoryEvent,
  EndUseInstance,
  MethodologyBindingRequest,
  MethodologyPreflightResponse,
  MethodologyPreflightStatus,
  VerraMonitoringRoute,
  DecisionSignals,
  GeminiExtraction,
  GeminiResult,
  SonnenerdeDemonstrationResponse,
  MonitoringWorkspaceResponse,
  GeminiAvailabilityResult,
  MonitoringEvidenceRecord,
} from "./types";
import { CONTROLLED_STATUS_TEXT } from "./types";
import {
  applyExtractionToBatch,
  buildBiocharChecklist,
  buildEudrChecklist,
  createEmptyBatch,
  generateReviewerRecommendations,
} from "./lib/mrvEngine";
import { getAuditLog, runBrainAnalysis } from "./controller/geminiController";
import { admitControlledDemoEvidence, checkControlledDocumentIntelligence, loadMonitoringWorkspace, refreshMonitoringReport, resetControlledDemo, submitMonitoringEvent, exportMonitoringPackage } from "./controller/monitoringController";
import {
  captureMethodologyDocument,
  createMethodologyUserAssertion,
  exportMethodologyPackageBlob,
  runMethodologyPreflight,
} from "./controller/methodologyController";
import "./styles.css";

type EvidenceTextType = "text" | "document" | "image" | "audio";

type FieldDef = {
  section: string;
  field: keyof BatchForm;
  label: string;
  type: "text" | "textarea";
};

type NavigationItem = { id: AppScreen; label: string; secondary?: boolean };

const SCREENS: NavigationItem[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "methodology-preflight", label: "Methodology pre-flight" },
  { id: "monitoring-workspace", label: "PDD Monitoring Workspace" },
  { id: "sonnenerde-demo", label: "Sonnenerde demo" },
  { id: "batch", label: "Biochar record" },
  { id: "evidence", label: "Evidence intake" },
  { id: "analysis", label: "Gemini panel" },
  { id: "checklist", label: "MRV checklist" },
  { id: "gaps", label: "MRV gap report & Review" },
  { id: "audit", label: "Audit log" },
  { id: "package", label: "Export package" },
  { id: "eudr-evidence", label: "EUDR Evidence Support", secondary: true },
  { id: "eudr-checklist", label: "EUDR Checklist (Support Only)", secondary: true },
  { id: "eudr-gaps", label: "EUDR Gap Report (Support Only)", secondary: true },
];

const WORKFLOW_SCREENS = SCREENS.filter((item) => !item.secondary && item.id !== "sonnenerde-demo");
const EUDR_SCREENS = SCREENS.filter((item) => item.secondary);
const SONNENERDE_SCREEN = SCREENS.find((item) => item.id === "sonnenerde-demo")!;
const CORE_WORKFLOW_SCREENS = WORKFLOW_SCREENS.filter((item) => ["dashboard", "methodology-preflight", "batch", "evidence", "checklist"].includes(item.id));
const MORE_WORKFLOW_SCREENS = WORKFLOW_SCREENS.filter((item) => !CORE_WORKFLOW_SCREENS.includes(item));
const CASE_FACT_KEYS = new Set(["projectId", "operator", "facility", "coordinates", "technology"]);

const HUMAN_DOCUMENT_LABELS: Record<string, string> = {
  "1_Project_Design_Document_GCSP1134.pdf": "Project Design Document",
  "1_PDD.pdf": "Project Design Document duplicate",
  "2_Validation_Report_GCSP1134.pdf": "Validation Report",
  "3_Validation_Statement_GCSP1134pdf.pdf": "Validation Statement",
  "4_ValidationFinding_Report_GCSP1134.pdf": "Validation Finding Report",
  "03_Austria_Project-Description_EN.pdf": "Austria Project Description",
  "Certificated.pdf": "Certificate document",
};

function humanDocumentLabel(fileName: string) {
  return HUMAN_DOCUMENT_LABELS[fileName] ?? fileName;
}

function humanEvidenceType(evidenceType: string) {
  return evidenceType.charAt(0) + evidenceType.slice(1).toLowerCase();
}

const BIOCHAR_FIELDS: FieldDef[] = [
  { section: "Project", field: "projectName", label: "Project name", type: "text" },
  { section: "Project", field: "batchId", label: "Batch ID", type: "text" },
  { section: "Project", field: "commodity", label: "Commodity", type: "text" },
  { section: "Project", field: "producerIdentity", label: "Producer identity", type: "text" },
  { section: "Project", field: "supplierName", label: "Supplier", type: "text" },
  { section: "Location", field: "country", label: "Country", type: "text" },
  { section: "Location", field: "region", label: "Region", type: "text" },
  { section: "Location", field: "plotPoint", label: "Plot point", type: "text" },
  { section: "Location", field: "latitude", label: "Latitude", type: "text" },
  { section: "Location", field: "longitude", label: "Longitude", type: "text" },
  { section: "Location", field: "productionDate", label: "Production date", type: "text" },
  { section: "Feedstock", field: "feedstockType", label: "Feedstock type", type: "text" },
  { section: "Feedstock", field: "sourceLocation", label: "Source location", type: "text" },
  { section: "Feedstock", field: "biomassOrigin", label: "Biomass origin", type: "text" },
  { section: "Feedstock", field: "contaminationRisk", label: "Contamination risk", type: "text" },
  { section: "Feedstock", field: "sustainabilityConcern", label: "Sustainability concern", type: "text" },
  { section: "Production", field: "pyrolysisDate", label: "Pyrolysis date", type: "text" },
  { section: "Production", field: "technologyType", label: "Technology", type: "text" },
  { section: "Production", field: "temperatureRange", label: "Temperature range", type: "text" },
  { section: "Production", field: "batchQuantity", label: "Production quantity", type: "text" },
  { section: "Production", field: "energyUse", label: "Energy use", type: "text" },
  { section: "Quality", field: "labReportAvailable", label: "Lab report availability", type: "text" },
  { section: "Quality", field: "carbonContent", label: "Carbon content", type: "text" },
  { section: "Quality", field: "moisture", label: "Moisture", type: "text" },
  { section: "Quality", field: "ashContent", label: "Ash content", type: "text" },
  { section: "Quality", field: "hcRatio", label: "H:C ratio", type: "text" },
  { section: "Quality", field: "stabilityEvidence", label: "Stability evidence", type: "textarea" },
  { section: "Quality", field: "contaminationIndicators", label: "Contamination indicators", type: "textarea" },
  { section: "Application", field: "applicationLocation", label: "Application location", type: "text" },
  { section: "Application", field: "applicationDate", label: "Application date", type: "text" },
  { section: "Application", field: "applicationQuantity", label: "Quantity applied", type: "text" },
  { section: "Application", field: "cropOrLandType", label: "Crop or land type", type: "text" },
  { section: "Application", field: "responsiblePerson", label: "Responsible person", type: "text" },
  { section: "Application", field: "geotagPhotoEvidence", label: "Geotag photo evidence", type: "text" },
  { section: "Permanence", field: "permanenceClass", label: "Permanence class", type: "text" },
  { section: "Permanence", field: "monitoringPlan", label: "Monitoring plan", type: "textarea" },
  { section: "Permanence", field: "reversalRisk", label: "Reversal risk", type: "text" },
  { section: "Permanence", field: "leakageRisk", label: "Leakage risk", type: "text" },
  { section: "Permanence", field: "doubleCountingRisk", label: "Double-counting risk", type: "text" },
];

const EUDR_FIELDS: FieldDef[] = [
  { section: "EUDR location", field: "country", label: "Country", type: "text" },
  { section: "EUDR location", field: "region", label: "Region", type: "text" },
  { section: "EUDR location", field: "plotPoint", label: "Plot point", type: "text" },
  { section: "EUDR location", field: "latitude", label: "Latitude", type: "text" },
  { section: "EUDR location", field: "longitude", label: "Longitude", type: "text" },
  { section: "EUDR location", field: "eudrProductionPlotGeolocation", label: "Plot geolocation", type: "text" },
  { section: "EUDR structured geo", field: "eudrLatitude", label: "Structured Latitude (WGS84)", type: "text" },
  { section: "EUDR structured geo", field: "eudrLongitude", label: "Structured Longitude (WGS84)", type: "text" },
  { section: "EUDR structured geo", field: "eudrPolygonGeometry", label: "Polygon Geometry (GeoJSON/WKT)", type: "textarea" },
  { section: "EUDR structured geo", field: "eudrCrs", label: "Coordinate Reference System (CRS)", type: "text" },
  { section: "EUDR structured geo", field: "eudrCoordinateSource", label: "Coordinate Source (GPS, Satellite, etc.)", type: "text" },
  { section: "EUDR structured geo", field: "eudrCaptureDate", label: "Capture Date", type: "text" },
  { section: "EUDR structured geo", field: "eudrLinkedPlotRecord", label: "Linked Plot Record", type: "text" },
  { section: "EUDR source", field: "eudrProductionPeriod", label: "Production date/period", type: "text" },
  { section: "EUDR source", field: "eudrCommodityBiomassSource", label: "Commodity/biomass", type: "text" },
  { section: "EUDR source", field: "eudrSupplierFarmerProducerIdentity", label: "Supplier/farmer/producer", type: "text" },
  { section: "EUDR evidence", field: "eudrNoDeforestationEvidence", label: "No deforestation", type: "textarea" },
  { section: "EUDR evidence", field: "eudrLegalityEvidence", label: "Legality evidence", type: "textarea" },
  { section: "EUDR evidence", field: "eudrLandUseHistoryEvidence", label: "Land-use history", type: "textarea" },
  { section: "EUDR evidence", field: "eudrSatelliteMapEvidence", label: "Satellite/map evidence", type: "textarea" },
  { section: "EUDR risk", field: "eudrRiskStatus", label: "Risk status", type: "text" },
];

const BLANK_EVIDENCE: GeminiExtraction = {
  feedstockEvidence: {},
  productionEvidence: {},
  qualityEvidence: {},
  applicationEvidence: {},
  storageEvidence: {},
  eudrEvidence: {},
};

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createDraftEvidence() {
  return {
    title: "",
    inputType: "text" as EvidenceTextType,
    sourceAttribution: "manual",
    rawText: "",
    notes: "",
    classifications: [] as string[],
    fileName: "",
    fileType: "",
  };
}

function groupBySection(fields: FieldDef[]) {
  const groups: Record<string, FieldDef[]> = {};
  for (const field of fields) {
    if (!groups[field.section]) groups[field.section] = [];
    groups[field.section].push(field);
  }
  return groups;
}

function statusClassName(status: ControlledStatus) {
  return `status-${status.toLowerCase()}`;
}

function mergeExtraction(current: GeminiExtraction, next: GeminiExtraction): GeminiExtraction {
  const join = (a: string | undefined, b: string | undefined) => {
    const incoming = (b ?? "").trim();
    return incoming || (a ?? "").trim();
  };
  return {
    feedstockEvidence: {
      feedstockType: join(current.feedstockEvidence.feedstockType, next.feedstockEvidence.feedstockType),
      sourceLocation: join(current.feedstockEvidence.sourceLocation, next.feedstockEvidence.sourceLocation),
      supplierName: join(current.feedstockEvidence.supplierName, next.feedstockEvidence.supplierName),
      biomassOrigin: join(current.feedstockEvidence.biomassOrigin, next.feedstockEvidence.biomassOrigin),
      contaminationRisk: join(current.feedstockEvidence.contaminationRisk, next.feedstockEvidence.contaminationRisk),
      sustainabilityConcern: join(current.feedstockEvidence.sustainabilityConcern, next.feedstockEvidence.sustainabilityConcern),
    },
    productionEvidence: {
      pyrolysisDate: join(current.productionEvidence.pyrolysisDate, next.productionEvidence.pyrolysisDate),
      technologyType: join(current.productionEvidence.technologyType, next.productionEvidence.technologyType),
      temperatureRange: join(current.productionEvidence.temperatureRange, next.productionEvidence.temperatureRange),
      batchId: join(current.productionEvidence.batchId, next.productionEvidence.batchId),
      batchQuantity: join(current.productionEvidence.batchQuantity, next.productionEvidence.batchQuantity),
      energyUse: join(current.productionEvidence.energyUse, next.productionEvidence.energyUse),
      producerIdentity: join(current.productionEvidence.producerIdentity, next.productionEvidence.producerIdentity),
    },
    qualityEvidence: {
      labReportAvailable: join(current.qualityEvidence.labReportAvailable, next.qualityEvidence.labReportAvailable),
      carbonContent: join(current.qualityEvidence.carbonContent, next.qualityEvidence.carbonContent),
      moisture: join(current.qualityEvidence.moisture, next.qualityEvidence.moisture),
      ashContent: join(current.qualityEvidence.ashContent, next.qualityEvidence.ashContent),
      hcRatio: join(current.qualityEvidence.hcRatio, next.qualityEvidence.hcRatio),
      stabilityEvidence: join(current.qualityEvidence.stabilityEvidence, next.qualityEvidence.stabilityEvidence),
      contaminationIndicators: join(current.qualityEvidence.contaminationIndicators, next.qualityEvidence.contaminationIndicators),
    },
    applicationEvidence: {
      applicationLocation: join(current.applicationEvidence.applicationLocation, next.applicationEvidence.applicationLocation),
      applicationDate: join(current.applicationEvidence.applicationDate, next.applicationEvidence.applicationDate),
      applicationQuantity: join(current.applicationEvidence.applicationQuantity, next.applicationEvidence.applicationQuantity),
      cropOrLandType: join(current.applicationEvidence.cropOrLandType, next.applicationEvidence.cropOrLandType),
      responsiblePerson: join(current.applicationEvidence.responsiblePerson, next.applicationEvidence.responsiblePerson),
      geotagPhotoEvidence: join(current.applicationEvidence.geotagPhotoEvidence, next.applicationEvidence.geotagPhotoEvidence),
    },
    storageEvidence: {
      permanenceClass: join(current.storageEvidence.permanenceClass, next.storageEvidence.permanenceClass),
      monitoringPlan: join(current.storageEvidence.monitoringPlan, next.storageEvidence.monitoringPlan),
      reversalRisk: join(current.storageEvidence.reversalRisk, next.storageEvidence.reversalRisk),
      leakageRisk: join(current.storageEvidence.leakageRisk, next.storageEvidence.leakageRisk),
      doubleCountingRisk: join(current.storageEvidence.doubleCountingRisk, next.storageEvidence.doubleCountingRisk),
    },
    eudrEvidence: {
      productionPlotGeolocation: join(current.eudrEvidence.productionPlotGeolocation, next.eudrEvidence.productionPlotGeolocation),
      productionPeriod: join(current.eudrEvidence.productionPeriod, next.eudrEvidence.productionPeriod),
      commodityOrBiomassSource: join(current.eudrEvidence.commodityOrBiomassSource, next.eudrEvidence.commodityOrBiomassSource),
      supplierFarmerProducerIdentity: join(current.eudrEvidence.supplierFarmerProducerIdentity, next.eudrEvidence.supplierFarmerProducerIdentity),
      noDeforestationEvidence: join(current.eudrEvidence.noDeforestationEvidence, next.eudrEvidence.noDeforestationEvidence),
      legalityEvidence: join(current.eudrEvidence.legalityEvidence, next.eudrEvidence.legalityEvidence),
      landUseHistoryEvidence: join(current.eudrEvidence.landUseHistoryEvidence, next.eudrEvidence.landUseHistoryEvidence),
      satelliteMapEvidence: join(current.eudrEvidence.satelliteMapEvidence, next.eudrEvidence.satelliteMapEvidence),
      riskStatus: join(current.eudrEvidence.riskStatus, next.eudrEvidence.riskStatus),
    },
  };
}

function statusFromGap(result: GeminiResult) {
  const g = result.eudrGapSummary;
  return {
    riskFlags: result.riskFlags ?? [],
    missingGeolocation: Boolean(g?.missingGeolocation),
    missingLegalityEvidence: Boolean(g?.missingLegalityEvidence),
    missingDeforestationEvidence: Boolean(g?.missingDeforestationEvidence),
    missingLandUseHistoryEvidence: Boolean(g?.missingLandUseHistoryEvidence),
    missingSatelliteEvidence: Boolean(g?.missingSatelliteEvidence),
    deforestationRiskReviewRequired: Boolean(g?.highDeforestationRisk),
  };
}

function FieldInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function FieldTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function renderFields(
  source: Record<string, FieldDef[]>,
  batch: BatchForm,
  onChange: <K extends keyof BatchForm>(field: K, value: BatchForm[K]) => void,
) {
  return (
    <div className="card-grid">
      {Object.entries(source).map(([section, fields]) => (
        <section className="card" key={section}>
          <h3>{section}</h3>
          {fields.map((field) =>
            field.type === "textarea" ? (
              <FieldTextarea
                key={`${section}-${String(field.field)}`}
                label={field.label}
                value={batch[field.field] || ""}
                onChange={(value) => onChange(field.field, value)}
              />
            ) : (
              <FieldInput
                key={`${section}-${String(field.field)}`}
                label={field.label}
                value={batch[field.field] || ""}
                onChange={(value) => onChange(field.field, value)}
              />
            ),
          )}
        </section>
      ))}
    </div>
  );
}

async function fileContentBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function csvIds(value: string) {
  return value.split(",").map((id) => id.trim()).filter(Boolean);
}

function methodologyStatusClass(status: MethodologyPreflightStatus) {
  if (status === "READY_FOR_INDEPENDENT_VERIFICATION") return "status-ready_for_audit_package";
  if (status === "NEEDS_HUMAN_REVIEW") return "status-needs_human_review";
  if (status === "NOT_ASSESSABLE") return "status-not_assessable";
  return "status-evidence_incomplete";
}

function MonitoringWorkspace() {
  const [workspace, setWorkspace] = useState<MonitoringWorkspaceResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [geminiResult, setGeminiResult] = useState<GeminiAvailabilityResult | null>(null);
  const [resetPending, setResetPending] = useState(false);
  const [event, setEvent] = useState({ monitoringPlanItemId: "mp-output", activityType: "Biochar output batch", eventTimestamp: "2025-08-01T10:00:00Z", batchOrLotId: "OPERATOR-001", value: "", unit: "t DM", operator: "Demo operator" });
  const [evidence, setEvidence] = useState({ evidenceType: "NONE", sourceLabel: "", mimeType: "application/pdf", fileSize: "", documentOrRecordDate: "2025-08-01", sourcePageOrLocation: "", gpsCoordinates: "", captureTimestamp: "", laboratoryOrThirdPartyIssuer: "", operatorOrSubmittingParty: "Demo operator" });
  const load = async () => { try { setWorkspace(await loadMonitoringWorkspace()); } catch (caught) { setError(caught instanceof Error ? caught.message : "Workspace unavailable."); } };
  useEffect(() => { void load(); }, []);
  const refresh = async () => { setBusy(true); setError(""); try { if (workspace) await refreshMonitoringReport(workspace.context.projectId); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Report refresh failed."); } finally { setBusy(false); } };
  const updatePlanItem = (itemId: string) => { const item = workspace?.monitoringPlan.find((entry) => entry.itemId === itemId); setEvent((current) => ({ ...current, monitoringPlanItemId: itemId, activityType: item?.projectActivity || current.activityType, unit: item?.unit || current.unit })); };
  const addActivity = async () => {
    if (!workspace) return;
    setBusy(true); setError("");
    try {
      const attachment = evidence.evidenceType === "NONE" ? undefined : {
        evidenceType: evidence.evidenceType as Exclude<MonitoringEvidenceRecord["evidenceType"], "USER_ASSERTION">,
        sourceLabel: evidence.sourceLabel,
        mimeType: evidence.mimeType,
        ...(evidence.fileSize ? { fileSize: Number(evidence.fileSize) } : {}),
        documentOrRecordDate: evidence.documentOrRecordDate,
        sourcePageOrLocation: evidence.sourcePageOrLocation,
        gpsCoordinates: evidence.gpsCoordinates,
        captureTimestamp: evidence.captureTimestamp,
        laboratoryOrThirdPartyIssuer: evidence.laboratoryOrThirdPartyIssuer,
        operatorOrSubmittingParty: evidence.operatorOrSubmittingParty || event.operator,
      };
      await submitMonitoringEvent({ projectId: workspace.context.projectId, reportingPeriod: workspace.context.reportingPeriod, ...event, ...(attachment ? { evidence: attachment } : {}) });
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Activity submission was rejected."); } finally { setBusy(false); }
  };
  const admitDemoEvidence = async () => { if (!workspace) return; setBusy(true); setError(""); try { await admitControlledDemoEvidence(workspace.context.projectId, workspace.context.reportingPeriod, "LABORATORY_RECORD", "KaseChar controlled demo"); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Controlled demo evidence was rejected."); } finally { setBusy(false); } };
  const reset = async () => { if (!workspace) return; setBusy(true); setError(""); try { setWorkspace(await resetControlledDemo(workspace.context.projectId)); setGeminiResult(null); setResetPending(false); } catch (caught) { setError(caught instanceof Error ? caught.message : "Demo reset was rejected."); } finally { setBusy(false); } };
  const runGeminiCheck = async () => { setBusy(true); setError(""); try { setGeminiResult(await checkControlledDocumentIntelligence()); } catch { setGeminiResult({ availability: "UNAVAILABLE", message: "Document intelligence is temporarily unavailable. Existing source-grounded monitoring records remain accessible.", sourceFileName: "1_Project_Design_Document_GCSP1134.pdf", sourcePageOrLocation: "p. 9", validationIssues: ["Live analysis was unavailable; deterministic monitoring records were not changed."] }); } finally { setBusy(false); } };
  const downloadPackage = async () => { if (!workspace?.report.packageAvailable) return; try { const { blob, filename } = await exportMonitoringPackage(workspace.context.projectId); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); } catch (caught) { setError(caught instanceof Error ? caught.message : "Package export rejected."); } };
  if (!workspace) return <section className="screen monitoring-workspace"><h2>PDD Monitoring Workspace</h2><p className="notice">{error || "Loading server-controlled project context..."}</p></section>;
  const { report } = workspace;
  return <section className="screen monitoring-workspace" data-testid="pdd-monitoring-workspace">
    <div className="monitoring-heading"><div><p className="eyebrow">PDD / Monitoring plan / Evidence / Reporting</p><h2>PDD Monitoring Workspace</h2><p>Operational monitoring support for a source-grounded biochar project. KaseChar does not verify removals, certify credits, or replace an independent VVB.</p></div><span className="status-pill status-evidence_incomplete">{report.status}</span></div>
    <div className="monitoring-context-grid"><article className="card"><h3>Project and methodology</h3><dl className="case-state-list"><div><dt>Project</dt><dd>{workspace.context.projectName} ({workspace.context.projectId})</dd></div><div><dt>PDD</dt><dd>{workspace.context.pddIdentifier} v{workspace.context.pddVersion}</dd></div><div><dt>Methodology</dt><dd>{workspace.context.methodologyId} v{workspace.context.methodologyVersion}</dd></div><div><dt>Reporting period</dt><dd>{workspace.context.reportingPeriod}</dd></div><div><dt>Operator / location</dt><dd>{workspace.context.operator}{" - "}{workspace.context.location}</dd></div></dl></article><article className="card"><h3>Evidence coverage</h3><strong className="monitoring-status">{report.coverage.supportedItemCount} of {report.coverage.requiredItemCount} materially supported</strong><div className="coverage-metrics"><span>Partial <b>{report.coverage.partiallySupportedItemCount}</b></span><span>Advisory <b>{report.coverage.advisoryOnlyItemCount}</b></span><span>Missing <b>{report.coverage.missingItemCount}</b></span><span>Conflicts <b>{report.coverage.conflictingItemCount}</b></span><span>Lab gaps <b>{report.coverage.laboratoryGapCount}</b></span><span>Review actions <b>{report.coverage.unresolvedReviewActionCount}</b></span></div><p className="notice">Forecasts are not observations. USER_ASSERTION records never close material monitoring gaps.</p></article></div>
    <section className="card"><div className="section-heading"><div><p className="eyebrow">Source-grounded plan</p><h3>Monitoring plan, coverage and provenance</h3></div><small>{workspace.monitoringPlan.length} controller records</small></div><div className="monitoring-plan-list">{workspace.monitoringPlan.map((item) => { const records = workspace.evidenceIndex.filter((record) => record.relatedMonitoringPlanItem === item.itemId); return <details key={item.itemId}><summary><div><strong>{item.projectActivity}</strong><span>{item.parameter}{" - "}{item.frequency}{" - "}{item.requiredEvidenceType}</span></div><span className={"status-pill " + (item.evidenceState === "MATERIALLY_SUPPORTED" || item.evidenceState === "SOURCE_GROUNDED" ? "status-assessable" : "status-evidence_incomplete")}>{item.evidenceState}</span></summary><p>{item.sourceFileName ? `${item.sourceFileName} - ${item.sourcePageOrLocation} - ${item.valueClass}` : item.validationIssues.join(" ")}</p><p><strong>Required:</strong> {item.requiredEvidenceType}. <strong>Validation:</strong> {item.validationIssues.join(" ") || "None"}</p>{records.length > 0 ? <ul className="evidence-record-list">{records.map((record) => <li key={record.evidenceId}><strong>{record.originalFilenameOrSourceLabel}</strong><span>{record.evidenceType} - {record.admissionStatus} - {record.materialClassification}</span><small>ID {record.evidenceId}; {record.mimeType}; {record.fileSize ?? "size not supplied"}; {record.provenanceMetadata.sourcePageOrLocation || "no page/location"}; SHA-256 {record.integrityMetadata.hash}</small><small>{record.sourceClassification}; {record.validationIssues.join(" ") || "No validation issues"}</small></li>)}</ul> : <p className="notice">No admitted or pending evidence record for this monitoring item.</p>}</details>; })}</div></section>
    <section className="card"><div className="section-heading"><div><p className="eyebrow">Activity and evidence capture</p><h3>Submit an activity with optional evidence metadata</h3></div><small>Server creates IDs, hashes, classifications, admissions and coverage.</small></div><div className="grid-2"><label className="field"><span>Monitoring-plan item</span><select value={event.monitoringPlanItemId} onChange={(change) => updatePlanItem(change.target.value)}>{workspace.monitoringPlan.map((item) => <option key={item.itemId} value={item.itemId}>{item.projectActivity}</option>)}</select></label>{([ ["Event timestamp", "eventTimestamp"], ["Batch or lot ID", "batchOrLotId"], ["Value", "value"], ["Unit", "unit"], ["Operator", "operator"] ] as const).map(([label, field]) => <FieldInput key={field} label={label} value={event[field]} onChange={(value) => setEvent((current) => ({ ...current, [field]: value }))} />)}</div><div className="evidence-capture-grid"><label className="field"><span>Evidence reference type</span><select value={evidence.evidenceType} onChange={(change) => setEvidence((current) => ({ ...current, evidenceType: change.target.value }))}><option value="NONE">No attachment � USER_ASSERTION only</option><option value="STRUCTURED_OPERATOR_RECORD">Structured operator record</option><option value="UPLOADED_DOCUMENT">Uploaded PDF/image metadata</option><option value="LABORATORY_RECORD">Laboratory-record metadata</option><option value="DEVICE_RECORD">Device-record metadata</option><option value="UNAVAILABLE">Evidence unavailable</option></select></label><FieldInput label="Source filename or label" value={evidence.sourceLabel} onChange={(value) => setEvidence((current) => ({ ...current, sourceLabel: value }))} /><FieldInput label="Record date" value={evidence.documentOrRecordDate} onChange={(value) => setEvidence((current) => ({ ...current, documentOrRecordDate: value }))} /><FieldInput label="Source page / location" value={evidence.sourcePageOrLocation} onChange={(value) => setEvidence((current) => ({ ...current, sourcePageOrLocation: value }))} /></div><button type="button" onClick={() => void addActivity()} disabled={busy}>Submit activity to server</button><p className="notice">A raw typed activity is USER_ASSERTION only. Attached metadata is pending review and cannot be made material by the browser.</p></section>
    <section className="card demo-evidence-card"><div className="section-heading"><div><p className="eyebrow">Controlled founder-demo step</p><h3>Admit DEMO EVIDENCE</h3></div><small>Explicitly not a real Sonnenerde operational record</small></div><p>Admit one server-controlled demonstration laboratory record. It links only to Laboratory sampling and results; the forecast and application gaps remain unresolved.</p><div className="methodology-actions"><button type="button" onClick={() => void admitDemoEvidence()} disabled={busy}>Admit controlled DEMO EVIDENCE</button>{workspace.demoResetAvailable && !resetPending && <button type="button" className="ghost" onClick={() => setResetPending(true)} disabled={busy}>Reset demo</button>}{workspace.demoResetAvailable && resetPending && <><span className="reset-confirmation">Reset only this controlled demo?</span><button type="button" className="ghost" onClick={() => setResetPending(false)} disabled={busy}>Cancel reset</button><button type="button" onClick={() => void reset()} disabled={busy}>Confirm reset demo</button></>}</div></section>
    <section className="card"><div className="section-heading"><div><p className="eyebrow">Evidence and activity timeline</p><h3>Server-controlled activity trail</h3></div><small>{workspace.timeline.length} server records</small></div><div className="monitoring-timeline">{workspace.timeline.map((entry) => <article key={entry.timelineId}><time>{entry.timestamp}</time><div><strong>{entry.label}</strong><span>{entry.category} - {entry.linkedMonitoringPlanItem || "project status"}</span></div><small>{entry.validationOutcome} - {entry.gapOrConflict}</small></article>)}</div></section>
    <section className="card"><div className="section-heading"><div><p className="eyebrow">Automated monitoring report</p><h3>Gaps, status and server package gate</h3></div><div className="methodology-actions"><button type="button" className="ghost" onClick={() => void refresh()} disabled={busy}>Refresh report</button>{report.packageAvailable ? <button type="button" onClick={() => void downloadPackage()}>Download review-support package</button> : <span className="status-pill status-evidence_incomplete">PACKAGE BLOCKED</span>}</div></div><p><strong>Missing evidence:</strong> {report.missingEvidence.join(", ") || "None"}</p><p><strong>Conflicts:</strong> {report.conflicts.join(", ") || "None"}</p><p><strong>Package gating reasons:</strong> {report.packageGatingReasons.join(", ") || "None"}</p><p className="notice">{report.disclaimer}</p></section>
    <section className="card gemini-check-card"><div className="section-heading"><div><p className="eyebrow">Protected document intelligence</p><h3>Source and rationale</h3></div><button type="button" className="ghost" onClick={() => void runGeminiCheck()} disabled={busy}>Check document intelligence</button></div>{geminiResult && <div className={geminiResult.availability === "AVAILABLE" ? "summary" : "notice"}><p>{geminiResult.message}</p><p>Source {geminiResult.sourceFileName} - {geminiResult.sourcePageOrLocation}; extracted {geminiResult.extractedAt || "not returned"}; model {geminiResult.modelName || "not returned"}; prompt version {geminiResult.promptVersion || "not returned"}; confidence {geminiResult.confidence ?? "not returned"}.</p><p>{geminiResult.validationIssues.join(" ") || "No validation issues returned."}</p></div>}</section>
    {error && <p className="notice" role="alert">{error}</p>}
  </section>;
}
function MethodologyPreflightWorkspace() {
  const [standard, setStandard] = useState<"VERRA" | "GOLD_STANDARD">("VERRA");
  const [selectedTrack, setSelectedTrack] = useState("");
  const [monitoringRoute, setMonitoringRoute] = useState<VerraMonitoringRoute>("NOT_ASSESSABLE");
  const [projectId, setProjectId] = useState("");
  const [documentDraft, setDocumentDraft] = useState({ sourceOrigin: "", sourcePageOrSection: "" });
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [assertionDraft, setAssertionDraft] = useState({ sourceOrigin: "", text: "" });
  const [assets, setAssets] = useState<EvidenceAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<MethodologyPreflightResponse | null>(null);
  const [facility, setFacility] = useState({
    facilityId: "", operator: "", facilityIdentity: "", location: "", technologyClassification: "", monitoringPlanVersion: "",
    sourceDocumentReference: "", facilityEvidenceIds: "", operatingPermitEvidenceIds: "", healthAndSafetyEvidenceIds: "", greenfieldEvidenceIds: "", additionalityBaselineEvidenceIds: "", monitoringPlanEvidenceIds: "", recordRetentionEvidenceIds: "",
  });
  const [lotDraft, setLotDraft] = useState({ lotId: "", supplier: "", sourceLocation: "", biomassClass: "", wetMass: "", dryMass: "", isWasteBiomass: false, priorFateEvidenceIds: "", sustainabilityAndLandRightsEvidenceIds: "", moistureEvidenceIds: "", chainOfCustodyEvidenceIds: "", sourceEvidenceIds: "" });
  const [batchDraft, setBatchDraft] = useState({ batchId: "", reactorOrFacilityId: "", batchStart: "", batchEnd: "", feedstockLotIds: "", wetInputMass: "", dryInputMass: "", biocharWetOutputMass: "", biocharDryOutputMass: "", processObservationEvidenceIds: "", productionTechnologyRoute: "", massBalanceReconciliationEvidenceIds: "", sourceEvidenceIds: "" });
  const [calibrationDraft, setCalibrationDraft] = useState({ recordId: "", deviceIdentity: "", measuredParameter: "", timestamp: "", calibrationValidFrom: "", calibrationValidTo: "", responsibleParty: "", rawRecordHash: "", calibrationCertificateEvidenceIds: "", sourceEvidenceIds: "" });
  const [laboratoryDraft, setLaboratoryDraft] = useState({ sampleId: "", productionBatchIds: "", laboratoryIdentity: "", qaStatus: "", custodyChainEvidenceIds: "", samplingProcedureEvidenceIds: "", laboratoryAccreditationEvidenceIds: "", rawResultsEvidenceIds: "", resultProvenanceEvidenceIds: "" });
  const [transferDraft, setTransferDraft] = useState({ eventId: "", sourceBatchId: "", quantity: "", destination: "", custodyHandoffEvidenceIds: "", transportEvidenceIds: "", lossEventEvidenceIds: "", sourceEvidenceIds: "" });
  const [endUseDraft, setEndUseDraft] = useState({ endUseId: "", usePathway: "SOIL", batchIds: "", quantity: "", applicationOrDeliveryDate: "", geolocation: "", recipientOrAccountableEndUser: "", finalNonCombustionUseEvidenceIds: "", pathwaySpecificEvidenceIds: "" });
  const [lots, setLots] = useState<FeedstockLot[]>([]);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [calibrations, setCalibrations] = useState<MeasurementAndCalibrationRecord[]>([]);
  const [samples, setSamples] = useState<LaboratorySample[]>([]);
  const [transfers, setTransfers] = useState<TransferAndInventoryEvent[]>([]);
  const [endUses, setEndUses] = useState<EndUseInstance[]>([]);

  const setDraft = <T extends Record<string, unknown>>(setter: (value: T) => void, current: T, field: keyof T, value: unknown) => setter({ ...current, [field]: value });
  const binding: MethodologyBindingRequest = standard === "VERRA"
    ? { standard: "VERRA", sourceDocumentReference: facility.sourceDocumentReference }
    : { standard: "GOLD_STANDARD", selectedTrack: selectedTrack as MethodologyBindingRequest["selectedTrack"], sourceDocumentReference: facility.sourceDocumentReference };

  const facilityProfile: FacilityProfile = {
    facilityId: facility.facilityId, operator: facility.operator, facilityIdentity: facility.facilityIdentity, location: facility.location,
    technologyClassification: facility.technologyClassification, monitoringPlanVersion: facility.monitoringPlanVersion,
    facilityEvidenceIds: csvIds(facility.facilityEvidenceIds), operatingPermitEvidenceIds: csvIds(facility.operatingPermitEvidenceIds), healthAndSafetyEvidenceIds: csvIds(facility.healthAndSafetyEvidenceIds), greenfieldEvidenceIds: csvIds(facility.greenfieldEvidenceIds), additionalityBaselineEvidenceIds: csvIds(facility.additionalityBaselineEvidenceIds), monitoringPlanEvidenceIds: csvIds(facility.monitoringPlanEvidenceIds), recordRetentionEvidenceIds: csvIds(facility.recordRetentionEvidenceIds),
  };

  const addDocument = async () => {
    if (!documentFile) { setError("Select a document to capture."); return; }
    setBusy(true); setError("");
    try {
      const asset = await captureMethodologyDocument({ projectId, sourceOrigin: documentDraft.sourceOrigin, sourcePageOrSection: documentDraft.sourcePageOrSection || undefined, fileName: documentFile.name, mediaType: documentFile.type || "application/pdf", contentBase64: await fileContentBase64(documentFile) });
      setAssets((current) => [...current, asset]); setDocumentDraft({ sourceOrigin: "", sourcePageOrSection: "" }); setDocumentFile(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Document capture was rejected."); }
    finally { setBusy(false); }
  };
  const addUserAssertion = async () => {
    setBusy(true); setError("");
    try { const assertion = await createMethodologyUserAssertion({ projectId, sourceOrigin: assertionDraft.sourceOrigin, text: assertionDraft.text }); setAssets((current) => [...current, assertion]); setAssertionDraft({ sourceOrigin: "", text: "" }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "User assertion was rejected."); }
    finally { setBusy(false); }
  };
  const runPreflight = async () => {
    setBusy(true); setError("");
    try { setResult(await runMethodologyPreflight({ projectId, methodologyBinding: binding, monitoringRoute, facilityProfile, feedstockLots: lots, productionBatches: batches, measurementAndCalibrationRecords: calibrations, laboratorySamples: samples, transferAndInventoryEvents: transfers, endUseInstances: endUses })); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Methodology pre-flight could not be run."); }
    finally { setBusy(false); }
  };
  const exportPackage = async () => {
    if (!result?.packageAvailable) return;
    try {
      const { blob, filename } = await exportMethodologyPackageBlob(result.assessmentRun.assessmentId);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(objectUrl);
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Package export was rejected."); }
  };
  const sourceField = (label: string, value: string, onChange: (value: string) => void) => <FieldInput label={label} value={value} onChange={onChange} />;

  return <section className="screen methodology-workspace" data-testid="methodology-preflight">
    <div className="methodology-heading"><div><p className="eyebrow">Evidence-controlled methodology workflow</p><h2>Methodology pre-flight</h2><p>Build a source-linked evidence package for independent verification. KaseChar does not certify, issue credits, submit registries, or replace a VVB.</p></div></div>
    <div className="methodology-steps"><span>1. Select pack</span><span>2. Facility Passport</span><span>3. Lineage records</span><span>4. Deterministic gaps</span><span>5. Verification package</span></div>
    <div className="card methodology-selector">
      <div><h3>Methodology pack</h3><p>Version-pinned selection is controller normalized on assessment.</p></div>
      <label className="field"><span>Standard</span><select value={standard} onChange={(event) => { setStandard(event.target.value as "VERRA" | "GOLD_STANDARD"); setResult(null); }}><option value="VERRA">Verra VM0044 v1.2 - ACTIVE</option><option value="GOLD_STANDARD">Gold Standard PARC - DRAFT</option></select></label>
      <label className="field"><span>Monitoring route</span><select value={monitoringRoute} onChange={(event) => setMonitoringRoute(event.target.value as VerraMonitoringRoute)}><option value="NOT_ASSESSABLE">NOT_ASSESSABLE</option><option value="HIGH_TECH_MONITORED">HIGH_TECH_MONITORED</option><option value="LOW_TECH_WITH_MEASURED_DATA">LOW_TECH_WITH_MEASURED_DATA</option><option value="LOW_TECH_CONSERVATIVE_ROUTE">LOW_TECH_CONSERVATIVE_ROUTE</option></select></label>
      {standard === "GOLD_STANDARD" && <div className="draft-adapter"><strong>GOLD STANDARD PARC: UNDER DEVELOPMENT - NOT A CURRENT CERTIFICATION OR CREDITING PATHWAY.</strong><label className="field"><span>Informational proposed track</span><select value={selectedTrack} onChange={(event) => setSelectedTrack(event.target.value)}><option value="">Select if applicable</option><option value="DISTRIBUTED">DISTRIBUTED</option><option value="MECHANIZED_TRANSITION">MECHANIZED_TRANSITION</option><option value="INDUSTRIAL_PRECISION">INDUSTRIAL_PRECISION</option></select></label></div>}
    </div>

    <div className="card source-asset-panel">
      <div><h3>Controlled source evidence</h3><p>Captured documents are hashed and stored by the controller. A document hash alone is not admitted methodology evidence.</p></div>
      {sourceField("Project / case ID", projectId, setProjectId)}
      <div className="grid-2">{sourceField("Source origin", documentDraft.sourceOrigin, (value) => setDraft(setDocumentDraft, documentDraft, "sourceOrigin", value))}{sourceField("Source page or section", documentDraft.sourcePageOrSection, (value) => setDraft(setDocumentDraft, documentDraft, "sourcePageOrSection", value))}</div>
      <label className="field"><span>Document file</span><input type="file" accept="application/pdf,text/plain,image/jpeg,image/png" onChange={(event) => setDocumentFile(event.target.files?.[0] ?? null)} /></label>
      <button type="button" onClick={() => void addDocument()} disabled={busy}>Capture document evidence</button>
      <div className="user-assertion-panel"><strong>Unverified user assertion - cannot satisfy methodology evidence requirements.</strong>{sourceField("Assertion source", assertionDraft.sourceOrigin, (value) => setDraft(setAssertionDraft, assertionDraft, "sourceOrigin", value))}<FieldTextarea label="Manual note" value={assertionDraft.text} onChange={(value) => setDraft(setAssertionDraft, assertionDraft, "text", value)} /><button type="button" className="ghost" onClick={() => void addUserAssertion()} disabled={busy}>Record user assertion</button></div>
      {assets.length > 0 && <ul className="evidence-asset-list">{assets.map((asset) => <li key={asset.evidenceId}><strong>{asset.evidenceId}</strong><span>{asset.evidenceClass} • {asset.sourceOrigin}</span><small>{asset.contentHash ?? "No document hash for user assertion"}</small></li>)}</ul>}
    </div>

    <div className="card facility-passport"><h3>Facility Passport and Monitoring Plan</h3><div className="grid-2">{sourceField("Facility ID", facility.facilityId, (value) => setDraft(setFacility, facility, "facilityId", value))}{sourceField("Operator", facility.operator, (value) => setDraft(setFacility, facility, "operator", value))}{sourceField("Facility identity", facility.facilityIdentity, (value) => setDraft(setFacility, facility, "facilityIdentity", value))}{sourceField("Location", facility.location, (value) => setDraft(setFacility, facility, "location", value))}{sourceField("Technology classification", facility.technologyClassification, (value) => setDraft(setFacility, facility, "technologyClassification", value))}{sourceField("Monitoring Plan version", facility.monitoringPlanVersion, (value) => setDraft(setFacility, facility, "monitoringPlanVersion", value))}{sourceField("Methodology source document reference", facility.sourceDocumentReference, (value) => setDraft(setFacility, facility, "sourceDocumentReference", value))}{sourceField("Facility evidence IDs", facility.facilityEvidenceIds, (value) => setDraft(setFacility, facility, "facilityEvidenceIds", value))}{sourceField("Greenfield evidence IDs", facility.greenfieldEvidenceIds, (value) => setDraft(setFacility, facility, "greenfieldEvidenceIds", value))}{sourceField("Additionality and baseline evidence IDs", facility.additionalityBaselineEvidenceIds, (value) => setDraft(setFacility, facility, "additionalityBaselineEvidenceIds", value))}{sourceField("Permit evidence IDs", facility.operatingPermitEvidenceIds, (value) => setDraft(setFacility, facility, "operatingPermitEvidenceIds", value))}{sourceField("Health and safety evidence IDs", facility.healthAndSafetyEvidenceIds, (value) => setDraft(setFacility, facility, "healthAndSafetyEvidenceIds", value))}{sourceField("Monitoring Plan evidence IDs", facility.monitoringPlanEvidenceIds, (value) => setDraft(setFacility, facility, "monitoringPlanEvidenceIds", value))}{sourceField("Record-retention evidence IDs", facility.recordRetentionEvidenceIds, (value) => setDraft(setFacility, facility, "recordRetentionEvidenceIds", value))}</div></div>

    <div className="lineage-heading"><div><p className="eyebrow">Batch lineage</p><h3>Feedstock lot {"->"} Production batch {"->"} Laboratory sample {"->"} Transfer/inventory {"->"} End-use instance {"->"} Evidence Passport {"->"} Verification package</h3></div><small>{lots.length} lots | {batches.length} batches | {samples.length} samples | {transfers.length} transfers | {endUses.length} end uses</small></div>
    <div className="lineage-grid">
      <article className="card"><h3>Add feedstock lot</h3>{sourceField("Lot ID", lotDraft.lotId, (value) => setDraft(setLotDraft, lotDraft, "lotId", value))}{sourceField("Supplier", lotDraft.supplier, (value) => setDraft(setLotDraft, lotDraft, "supplier", value))}{sourceField("Source location", lotDraft.sourceLocation, (value) => setDraft(setLotDraft, lotDraft, "sourceLocation", value))}{sourceField("Biomass class", lotDraft.biomassClass, (value) => setDraft(setLotDraft, lotDraft, "biomassClass", value))}{sourceField("Wet mass", lotDraft.wetMass, (value) => setDraft(setLotDraft, lotDraft, "wetMass", value))}{sourceField("Dry mass", lotDraft.dryMass, (value) => setDraft(setLotDraft, lotDraft, "dryMass", value))}<label className="checkbox-field"><input type="checkbox" checked={lotDraft.isWasteBiomass} onChange={(event) => setDraft(setLotDraft, lotDraft, "isWasteBiomass", event.target.checked)} /> Waste biomass classification supported</label>{sourceField("Prior-fate evidence IDs", lotDraft.priorFateEvidenceIds, (value) => setDraft(setLotDraft, lotDraft, "priorFateEvidenceIds", value))}{sourceField("Sustainability and land-rights evidence IDs", lotDraft.sustainabilityAndLandRightsEvidenceIds, (value) => setDraft(setLotDraft, lotDraft, "sustainabilityAndLandRightsEvidenceIds", value))}{sourceField("Moisture evidence IDs", lotDraft.moistureEvidenceIds, (value) => setDraft(setLotDraft, lotDraft, "moistureEvidenceIds", value))}{sourceField("Custody evidence IDs", lotDraft.chainOfCustodyEvidenceIds, (value) => setDraft(setLotDraft, lotDraft, "chainOfCustodyEvidenceIds", value))}{sourceField("Source evidence IDs", lotDraft.sourceEvidenceIds, (value) => setDraft(setLotDraft, lotDraft, "sourceEvidenceIds", value))}<button type="button" onClick={() => { setLots((current) => [...current, { lotId: lotDraft.lotId, supplier: lotDraft.supplier, sourceLocation: lotDraft.sourceLocation, biomassClass: lotDraft.biomassClass, isWasteBiomass: lotDraft.isWasteBiomass, wetMass: lotDraft.wetMass, dryMass: lotDraft.dryMass, priorFateEvidenceIds: csvIds(lotDraft.priorFateEvidenceIds), sustainabilityAndLandRightsEvidenceIds: csvIds(lotDraft.sustainabilityAndLandRightsEvidenceIds), moistureEvidenceIds: csvIds(lotDraft.moistureEvidenceIds), chainOfCustodyEvidenceIds: csvIds(lotDraft.chainOfCustodyEvidenceIds), sourceEvidenceIds: csvIds(lotDraft.sourceEvidenceIds) }]); }}>Add lot</button></article>
      <article className="card"><h3>Add production batch</h3>{sourceField("Batch ID", batchDraft.batchId, (value) => setDraft(setBatchDraft, batchDraft, "batchId", value))}{sourceField("Reactor or facility ID", batchDraft.reactorOrFacilityId, (value) => setDraft(setBatchDraft, batchDraft, "reactorOrFacilityId", value))}{sourceField("Linked lot IDs", batchDraft.feedstockLotIds, (value) => setDraft(setBatchDraft, batchDraft, "feedstockLotIds", value))}{sourceField("Production route", batchDraft.productionTechnologyRoute, (value) => setDraft(setBatchDraft, batchDraft, "productionTechnologyRoute", value))}{sourceField("Batch start (ISO date)", batchDraft.batchStart, (value) => setDraft(setBatchDraft, batchDraft, "batchStart", value))}{sourceField("Batch end (ISO date)", batchDraft.batchEnd, (value) => setDraft(setBatchDraft, batchDraft, "batchEnd", value))}{sourceField("Wet input mass", batchDraft.wetInputMass, (value) => setDraft(setBatchDraft, batchDraft, "wetInputMass", value))}{sourceField("Dry input mass", batchDraft.dryInputMass, (value) => setDraft(setBatchDraft, batchDraft, "dryInputMass", value))}{sourceField("Biochar wet output mass", batchDraft.biocharWetOutputMass, (value) => setDraft(setBatchDraft, batchDraft, "biocharWetOutputMass", value))}{sourceField("Biochar dry output mass", batchDraft.biocharDryOutputMass, (value) => setDraft(setBatchDraft, batchDraft, "biocharDryOutputMass", value))}{sourceField("Process observation evidence IDs", batchDraft.processObservationEvidenceIds, (value) => setDraft(setBatchDraft, batchDraft, "processObservationEvidenceIds", value))}{sourceField("Mass-reconciliation evidence IDs", batchDraft.massBalanceReconciliationEvidenceIds, (value) => setDraft(setBatchDraft, batchDraft, "massBalanceReconciliationEvidenceIds", value))}{sourceField("Source evidence IDs", batchDraft.sourceEvidenceIds, (value) => setDraft(setBatchDraft, batchDraft, "sourceEvidenceIds", value))}<p className="notice">Mass and inventory reconciliation are calculated by the controller from captured, review-admitted evidence.</p><button type="button" onClick={() => { setBatches((current) => [...current, { batchId: batchDraft.batchId, reactorOrFacilityId: batchDraft.reactorOrFacilityId, batchStart: batchDraft.batchStart, batchEnd: batchDraft.batchEnd, feedstockLotIds: csvIds(batchDraft.feedstockLotIds), wetInputMass: batchDraft.wetInputMass, dryInputMass: batchDraft.dryInputMass, biocharWetOutputMass: batchDraft.biocharWetOutputMass, biocharDryOutputMass: batchDraft.biocharDryOutputMass, processObservationEvidenceIds: csvIds(batchDraft.processObservationEvidenceIds), productionTechnologyRoute: batchDraft.productionTechnologyRoute, massBalanceReconciliationEvidenceIds: csvIds(batchDraft.massBalanceReconciliationEvidenceIds), sourceEvidenceIds: csvIds(batchDraft.sourceEvidenceIds) }]); }}>Add batch</button></article>
      <article className="card"><h3>Link calibration and laboratory</h3>{sourceField("Calibration record ID", calibrationDraft.recordId, (value) => setDraft(setCalibrationDraft, calibrationDraft, "recordId", value))}{sourceField("Device identity", calibrationDraft.deviceIdentity, (value) => setDraft(setCalibrationDraft, calibrationDraft, "deviceIdentity", value))}{sourceField("Measured parameter", calibrationDraft.measuredParameter, (value) => setDraft(setCalibrationDraft, calibrationDraft, "measuredParameter", value))}{sourceField("Measurement timestamp (ISO date)", calibrationDraft.timestamp, (value) => setDraft(setCalibrationDraft, calibrationDraft, "timestamp", value))}{sourceField("Calibration valid from (ISO date)", calibrationDraft.calibrationValidFrom, (value) => setDraft(setCalibrationDraft, calibrationDraft, "calibrationValidFrom", value))}{sourceField("Responsible party", calibrationDraft.responsibleParty, (value) => setDraft(setCalibrationDraft, calibrationDraft, "responsibleParty", value))}{sourceField("Raw record hash", calibrationDraft.rawRecordHash, (value) => setDraft(setCalibrationDraft, calibrationDraft, "rawRecordHash", value))}{sourceField("Calibration valid to (ISO date)", calibrationDraft.calibrationValidTo, (value) => setDraft(setCalibrationDraft, calibrationDraft, "calibrationValidTo", value))}{sourceField("Calibration certificate evidence IDs", calibrationDraft.calibrationCertificateEvidenceIds, (value) => setDraft(setCalibrationDraft, calibrationDraft, "calibrationCertificateEvidenceIds", value))}{sourceField("Calibration source evidence IDs", calibrationDraft.sourceEvidenceIds, (value) => setDraft(setCalibrationDraft, calibrationDraft, "sourceEvidenceIds", value))}<button type="button" onClick={() => { setCalibrations((current) => [...current, { ...calibrationDraft, calibrationCertificateEvidenceIds: csvIds(calibrationDraft.calibrationCertificateEvidenceIds), sourceEvidenceIds: csvIds(calibrationDraft.sourceEvidenceIds) }]); }}>Add calibration</button><hr />{sourceField("Laboratory sample ID", laboratoryDraft.sampleId, (value) => setDraft(setLaboratoryDraft, laboratoryDraft, "sampleId", value))}{sourceField("Linked batch IDs", laboratoryDraft.productionBatchIds, (value) => setDraft(setLaboratoryDraft, laboratoryDraft, "productionBatchIds", value))}{sourceField("Laboratory identity", laboratoryDraft.laboratoryIdentity, (value) => setDraft(setLaboratoryDraft, laboratoryDraft, "laboratoryIdentity", value))}{sourceField("QA status", laboratoryDraft.qaStatus, (value) => setDraft(setLaboratoryDraft, laboratoryDraft, "qaStatus", value))}{sourceField("Custody-chain evidence IDs", laboratoryDraft.custodyChainEvidenceIds, (value) => setDraft(setLaboratoryDraft, laboratoryDraft, "custodyChainEvidenceIds", value))}{sourceField("Sampling-procedure evidence IDs", laboratoryDraft.samplingProcedureEvidenceIds, (value) => setDraft(setLaboratoryDraft, laboratoryDraft, "samplingProcedureEvidenceIds", value))}{sourceField("Laboratory-accreditation evidence IDs", laboratoryDraft.laboratoryAccreditationEvidenceIds, (value) => setDraft(setLaboratoryDraft, laboratoryDraft, "laboratoryAccreditationEvidenceIds", value))}{sourceField("Raw-results evidence IDs", laboratoryDraft.rawResultsEvidenceIds, (value) => setDraft(setLaboratoryDraft, laboratoryDraft, "rawResultsEvidenceIds", value))}{sourceField("Result-provenance evidence IDs", laboratoryDraft.resultProvenanceEvidenceIds, (value) => setDraft(setLaboratoryDraft, laboratoryDraft, "resultProvenanceEvidenceIds", value))}<button type="button" onClick={() => { setSamples((current) => [...current, { sampleId: laboratoryDraft.sampleId, productionBatchIds: csvIds(laboratoryDraft.productionBatchIds), laboratoryIdentity: laboratoryDraft.laboratoryIdentity, qaStatus: laboratoryDraft.qaStatus, custodyChainEvidenceIds: csvIds(laboratoryDraft.custodyChainEvidenceIds), samplingProcedureEvidenceIds: csvIds(laboratoryDraft.samplingProcedureEvidenceIds), laboratoryAccreditationEvidenceIds: csvIds(laboratoryDraft.laboratoryAccreditationEvidenceIds), rawResultsEvidenceIds: csvIds(laboratoryDraft.rawResultsEvidenceIds), resultProvenanceEvidenceIds: csvIds(laboratoryDraft.resultProvenanceEvidenceIds) }]); }}>Add sample</button></article>
      <article className="card"><h3>Reconcile movement to end use</h3>{sourceField("Transfer event ID", transferDraft.eventId, (value) => setDraft(setTransferDraft, transferDraft, "eventId", value))}{sourceField("Source batch ID", transferDraft.sourceBatchId, (value) => setDraft(setTransferDraft, transferDraft, "sourceBatchId", value))}{sourceField("Destination", transferDraft.destination, (value) => setDraft(setTransferDraft, transferDraft, "destination", value))}{sourceField("Transfer quantity", transferDraft.quantity, (value) => setDraft(setTransferDraft, transferDraft, "quantity", value))}{sourceField("Custody handoff evidence IDs", transferDraft.custodyHandoffEvidenceIds, (value) => setDraft(setTransferDraft, transferDraft, "custodyHandoffEvidenceIds", value))}{sourceField("Transport evidence IDs", transferDraft.transportEvidenceIds, (value) => setDraft(setTransferDraft, transferDraft, "transportEvidenceIds", value))}{sourceField("Loss-event evidence IDs", transferDraft.lossEventEvidenceIds, (value) => setDraft(setTransferDraft, transferDraft, "lossEventEvidenceIds", value))}{sourceField("Transfer source evidence IDs", transferDraft.sourceEvidenceIds, (value) => setDraft(setTransferDraft, transferDraft, "sourceEvidenceIds", value))}<button type="button" onClick={() => { setTransfers((current) => [...current, { eventId: transferDraft.eventId, sourceBatchId: transferDraft.sourceBatchId, quantity: transferDraft.quantity, destination: transferDraft.destination, custodyHandoffEvidenceIds: csvIds(transferDraft.custodyHandoffEvidenceIds), transportEvidenceIds: csvIds(transferDraft.transportEvidenceIds), lossEventEvidenceIds: csvIds(transferDraft.lossEventEvidenceIds), sourceEvidenceIds: csvIds(transferDraft.sourceEvidenceIds) }]); }}>Add transfer</button><hr />{sourceField("End-use ID", endUseDraft.endUseId, (value) => setDraft(setEndUseDraft, endUseDraft, "endUseId", value))}{sourceField("Linked batch IDs", endUseDraft.batchIds, (value) => setDraft(setEndUseDraft, endUseDraft, "batchIds", value))}<label>Use pathway<select value={endUseDraft.usePathway} onChange={(event) => setDraft(setEndUseDraft, endUseDraft, "usePathway", event.target.value)}><option value="SOIL">SOIL</option><option value="NON_SOIL">NON_SOIL</option><option value="OTHER">OTHER</option></select></label>{sourceField("End-use quantity", endUseDraft.quantity, (value) => setDraft(setEndUseDraft, endUseDraft, "quantity", value))}{sourceField("Application or delivery date (ISO date)", endUseDraft.applicationOrDeliveryDate, (value) => setDraft(setEndUseDraft, endUseDraft, "applicationOrDeliveryDate", value))}{sourceField("Geolocation", endUseDraft.geolocation, (value) => setDraft(setEndUseDraft, endUseDraft, "geolocation", value))}{sourceField("Recipient / accountable end user", endUseDraft.recipientOrAccountableEndUser, (value) => setDraft(setEndUseDraft, endUseDraft, "recipientOrAccountableEndUser", value))}{sourceField("Final non-combustion evidence IDs", endUseDraft.finalNonCombustionUseEvidenceIds, (value) => setDraft(setEndUseDraft, endUseDraft, "finalNonCombustionUseEvidenceIds", value))}{sourceField("Pathway-specific evidence IDs", endUseDraft.pathwaySpecificEvidenceIds, (value) => setDraft(setEndUseDraft, endUseDraft, "pathwaySpecificEvidenceIds", value))}<button type="button" onClick={() => { setEndUses((current) => [...current, { endUseId: endUseDraft.endUseId, usePathway: endUseDraft.usePathway as EndUseInstance["usePathway"], batchIds: csvIds(endUseDraft.batchIds), quantity: endUseDraft.quantity, applicationOrDeliveryDate: endUseDraft.applicationOrDeliveryDate, geolocation: endUseDraft.geolocation, recipientOrAccountableEndUser: endUseDraft.recipientOrAccountableEndUser, finalNonCombustionUseEvidenceIds: csvIds(endUseDraft.finalNonCombustionUseEvidenceIds), pathwaySpecificEvidenceIds: csvIds(endUseDraft.pathwaySpecificEvidenceIds) }]); }}>Add end use</button></article>
    </div>
    <div className="methodology-actions"><button type="button" onClick={() => void runPreflight()} disabled={busy}>Run deterministic methodology pre-flight</button>{result?.packageAvailable && <button type="button" className="ghost" onClick={() => void exportPackage()}>Export independent-review package</button>}</div>
    {error && <p className="notice">{error}</p>}
    {result && <section className="card preflight-result"><div className="preflight-result-heading"><div><p className="eyebrow">Controller assessment</p><h3>{result.assessmentRun.methodologyBinding.methodologyId} {result.assessmentRun.methodologyBinding.methodologyVersion}</h3></div><span className={"status-pill " + methodologyStatusClass(result.status)}>{result.status}</span></div>{result.methodologyNotice && <p className="draft-adapter"><strong>{result.methodologyNotice}</strong></p>}<p><strong>Monitoring route:</strong> {result.monitoringRoute}</p><p><strong>Assessment ID:</strong> {result.assessmentRun.assessmentId}</p><p><strong>Output hash:</strong> {result.assessmentRun.outputHash}</p><div className="methodology-domain-list">{result.assessmentRun.deterministicGateResults.map((domain) => <article key={domain.requirementId}><div><strong>{domain.requirementId}</strong><span>{domain.label}</span></div><span className={"status-pill " + methodologyStatusClass(domain.status)}>{domain.status}</span><small>{domain.gateCodes.join(", ") || "Source-linked evidence supported"}</small></article>)}</div>{result.gateCodes.length > 0 && <div className="gap-list"><strong>Deterministic gate codes</strong>{result.gateCodes.map((code) => <p key={code}>{code}</p>)}</div>}{result.packageAvailable && <p className="summary">Evidence package complete for independent review. Not a verification, certification, credit decision, or registry submission.</p>}</section>}
  </section>;
}

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("dashboard");
  const [batch, setBatch] = useState<BatchForm>(createEmptyBatch());
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);
  const [draft, setDraft] = useState(createDraftEvidence);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [auditLog, setAuditLog] = useState<AuditLogEvent[]>([]);
  const [analysisBusy, setAnalysisBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [biocharSignals, setBiocharSignals] = useState<DecisionSignals>({
    riskFlags: [],
    notAssessable: false,
    needsHumanReview: false,
  });
  const [eudrSignals, setEudrSignals] = useState<EudrDecisionSignals>({
    riskFlags: [],
    notAssessable: false,
    missingGeolocation: false,
    missingLegalityEvidence: false,
    missingDeforestationEvidence: false,
    missingLandUseHistoryEvidence: false,
    missingSatelliteEvidence: false,
    deforestationRiskReviewRequired: false,
    needsHumanReview: false,
  });
  const [lastExtraction, setLastExtraction] = useState<GeminiExtraction>(BLANK_EVIDENCE);
  const [biocharSummary, setBiocharSummary] = useState("");
  const [eudrSummary, setEudrSummary] = useState("");
  const [sonnenerdeDemo, setSonnenerdeDemo] = useState<SonnenerdeDemonstrationResponse | null>(null);
  const [sonnenerdeLoading, setSonnenerdeLoading] = useState(false);
  const [sonnenerdeError, setSonnenerdeError] = useState("");

  const biocharChecklist = useMemo(() => buildBiocharChecklist(batch), [batch]);
  const eudrChecklist = useMemo(() => buildEudrChecklist(batch), [batch]);
  const biocharStatus: ControlledStatus = "NOT_ASSESSABLE";
  const eudrStatus: ControlledStatus = "NOT_ASSESSABLE";


  const sonnenerdeAssessment = sonnenerdeDemo?.assessment ?? null;
  const sonnenerdeAvailable = sonnenerdeDemo?.availability === "AVAILABLE";
  const sonnenerdeDocuments = sonnenerdeDemo?.documents ?? [];
  const sonnenerdeDuplicateCount = sonnenerdeDocuments.filter((document) => document.integrityStatus === "DUPLICATE_IDENTICAL").length;
  const sonnenerdeFacts = (sonnenerdeDemo?.projectFields ?? []).filter((field) => CASE_FACT_KEYS.has(field.key));

  const selectedEvidence = evidence.find((item) => item.id === selectedEvidenceId) ?? null;
  const biocharBySection = useMemo(() => groupBySection(BIOCHAR_FIELDS), []);
  const eudrBySection = useMemo(() => groupBySection(EUDR_FIELDS), []);

  useEffect(() => {
    void refreshAuditLog();
  }, []);

  useEffect(() => {
    if (screen === "sonnenerde-demo" && !sonnenerdeDemo && !sonnenerdeLoading) {
      void loadSonnenerdeDemonstration();
    }
  }, [screen, sonnenerdeDemo, sonnenerdeLoading]);

  const updateField = <K extends keyof BatchForm>(field: K, value: BatchForm[K]) => {
    setBatch((current) => ({ ...current, [field]: value }));
  };

  const updateDraftEvidenceText = (patch: Partial<ReturnType<typeof createDraftEvidence>>) => {
    setDraft((current) => ({ ...current, ...patch }));
  };

  async function refreshAuditLog() {
    const next = await getAuditLog();
    setAuditLog(next);
  }

  async function loadSonnenerdeDemonstration() {
    setSonnenerdeLoading(true);
    setSonnenerdeError("");
    try {
      const response = await fetch("/api/demonstrations/sonnenerde");
      if (!response.ok) throw new Error("The controlled local evidence endpoint did not return a successful response.");
      const payload = await response.json() as SonnenerdeDemonstrationResponse;
      setSonnenerdeDemo(payload);
    } catch (error) {
      setSonnenerdeDemo(null);
      setSonnenerdeError("Sonnenerde evidence is unavailable: " + String(error));
    } finally {
      setSonnenerdeLoading(false);
    }
  }

  function addEvidence() {
    if (!draft.title.trim() || !draft.rawText.trim()) {
      setStatusMessage("Title and evidence text are required.");
      return;
    }

    const next = {
      ...draft,
      id: uid("evidence"),
      uploadedAt: new Date().toISOString(),
      title: draft.title.trim(),
      sourceAttribution: draft.sourceAttribution || "USER_ASSERTION",
      classifications: draft.classifications.length > 0 ? draft.classifications : ["USER_ASSERTION"],
    } as EvidenceRecord;

    setEvidence((current) => [next, ...current]);
    setSelectedEvidenceId(next.id);
    setDraft(createDraftEvidence());
    setStatusMessage("Evidence added to registry.");
  }

  function onAttachFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    updateDraftEvidenceText({
      sourceAttribution: `file:${file.name}`,
      fileName: file.name,
      fileType: file.type,
      notes: draft.notes || `Uploaded file: ${file.name}`,
    });
    setStatusMessage(`Attached ${file.name}`);
  }

  async function runAction(action: BrainAction) {
    if (!selectedEvidence) {
      setStatusMessage("Select evidence first.");
      return;
    }

    setAnalysisBusy(true);
    setStatusMessage(`Running ${action}...`);

    const request: BrainRequest = {
      action,
      evidenceId: selectedEvidence.id,
      evidenceText: selectedEvidence.rawText,
      metadata: {
        sourceLabel: selectedEvidence.sourceAttribution,
        inputType: selectedEvidence.inputType,
        evidenceCount: evidence.length,
        fileName: selectedEvidence.fileName,
      },
      context: { batchContext: batch },
    };

    try {
      const response = await runBrainAnalysis(request);
      const riskFlags = response.result.riskFlags ?? [];
      const confidence = typeof response.result.confidence === "number" ? response.result.confidence : 0.5;

      if (response.result.extraction) {
        setBatch((current) => applyExtractionToBatch(current, response.result.extraction!));
        setLastExtraction((current) => mergeExtraction(current, response.result.extraction!));
      }

      if (response.result.classifications?.length) {
        setEvidence((current) =>
          current.map((item) =>
            item.id === selectedEvidence.id
              ? {
                  ...item,
                  classifications: Array.from(
                    new Set([...(item.classifications || []), ...(response.result.classifications || [])]),
                  ),
                }
              : item,
          ),
        );
      }

      setEvidence((current) =>
        current.map((item) =>
          item.id === selectedEvidence.id
            ? {
                ...item,
                lastGeminiResultAt: response.recordedAt,
                lastGeminiSummary: response.result.summary || response.result.rationale,
              }
            : item,
        ),
      );

      setBiocharSignals((current) => ({
        ...current,
        riskFlags,
        notAssessable: confidence < 0.2 || confidence === 0,
        needsHumanReview: riskFlags.length > 0 || confidence < 0.35,
      }));

      const gapSignals = statusFromGap(response.result);
      setEudrSignals((current) => ({
        ...current,
        riskFlags,
        notAssessable: confidence < 0.2 || confidence === 0,
        needsHumanReview: riskFlags.length > 0 || Boolean(gapSignals.deforestationRiskReviewRequired),
        missingGeolocation: gapSignals.missingGeolocation,
        missingLegalityEvidence: gapSignals.missingLegalityEvidence,
        missingDeforestationEvidence: gapSignals.missingDeforestationEvidence,
        missingLandUseHistoryEvidence: gapSignals.missingLandUseHistoryEvidence,
        missingSatelliteEvidence: gapSignals.missingSatelliteEvidence,
        deforestationRiskReviewRequired:
          gapSignals.deforestationRiskReviewRequired || current.deforestationRiskReviewRequired,
      }));

      setBiocharSummary(response.result.summary || "");
      setEudrSummary(response.result.summary || "");
      setStatusMessage(response.result.summary || "Analysis complete.");
    } catch (error) {
      setStatusMessage(`Analysis failed: ${String(error)}`);
    }

    await refreshAuditLog();
    setAnalysisBusy(false);
  }

  const reviewerRecs = generateReviewerRecommendations(
    batch,
    biocharStatus,
    eudrStatus,
    biocharSignals,
    eudrSignals,
    evidence,
  );

  const renderReviewerRecommendationsBlock = (trackFilter?: "BIOCHAR" | "EUDR" | "BOTH", presentation: "cards" | "queue" = "cards") => {
    const filtered = trackFilter
      ? reviewerRecs.filter((r) => r.track === trackFilter || r.track === "BOTH")
      : reviewerRecs;
    if (filtered.length === 0) {
      return <p className="notice" style={{ marginTop: 16 }}>No reviewer routing recommendations triggered. Evidence gates pass without gap warnings.</p>;
    }
    if (presentation === "queue") {
      return (
        <section className="review-queue-block" aria-label="Reviewer routing recommendations">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Review queue</p>
              <h3>Reviewer routing</h3>
            </div>
            <small>Workflow support only</small>
          </div>
          <div className="review-queue" role="list">
            {filtered.map((rec, idx) => (
              <article key={rec.type + "-" + idx} className="review-queue-row" role="listitem">
                <strong>{rec.type.replace(/_/g, " ")}</strong>
                <span className={"priority-badge priority-" + rec.priority.toLowerCase()}>{rec.priority}</span>
                <p>{rec.reason}</p>
                <small>{rec.track} track</small>
              </article>
            ))}
          </div>
        </section>
      );
    }
    return (
      <div className="recs-block" style={{ marginTop: 24 }}>
        <h3>Reviewer Routing Recommendations (Workflow Support)</h3>
        <p className="notice" style={{ marginBottom: 12 }}>
          These workflow recommendations identify technical evidence gaps and route to human specialists. They do not issue legal conclusions or auto-assign users.
        </p>
        <div className="stat-grid">
          {filtered.map((rec, idx) => (
            <article key={rec.type + "-" + idx} className="card" style={{ borderLeft: rec.priority === "HIGH" ? "4px solid #e11d48" : "4px solid #f59e0b" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "0.9rem", color: "#1e293b" }}>{rec.type.replace(/_/g, " ")}</strong>
                <span className="status-pill" style={{ fontSize: "0.75rem", background: rec.priority === "HIGH" ? "#ffe4e6" : "#fef3c7", color: rec.priority === "HIGH" ? "#9f1239" : "#92400e" }}>
                  {rec.priority} PRIORITY
                </span>
              </div>
              <p style={{ marginTop: 8, fontSize: "0.85rem", color: "#475569" }}>{rec.reason}</p>
              <small style={{ marginTop: 4, display: "block", color: "#64748b" }}>Track: {rec.track}</small>
            </article>
          ))}
        </div>
      </div>
    );
  };

  const sharedStatusRow = (
    <section className="status-row">
      <div className={`status-pill ${statusClassName(biocharStatus)}`}>
        <CheckCircle2 size={14} />
        {CONTROLLED_STATUS_TEXT[biocharStatus]}
      </div>
      <div className={`status-pill ${statusClassName(eudrStatus)}`}>
        <Activity size={14} />
        {CONTROLLED_STATUS_TEXT[eudrStatus]}
      </div>
    </section>
  );

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand-lockup">
          <p className="eyebrow">Evidence intelligence</p>
          <h1>KaseChar <span>Biochar dMRV</span></h1>
          <p className="product-subtitle">Evidence-controlled carbon documentation workspace</p>
          <p className="disclaimer">
            Evidence support and dMRV tracking only. KaseChar does not certify compliance, issue credits, or submit authority filings.
          </p>
        </div>
        <aside className="system-status" aria-label="Current evidence statuses">
          <span className="status-caption">Current evidence status</span>
          {sharedStatusRow}
        </aside>
      </header>

      <nav className="workflow-nav" aria-label="KaseChar workflows">
        <div className="nav-primary">
          {CORE_WORKFLOW_SCREENS.map((item) => (
            <button type="button" key={item.id} className={screen === item.id ? "active" : ""} onClick={() => setScreen(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="demo-selector">
          <span>Document case</span>
          <button type="button" className={screen === SONNENERDE_SCREEN.id ? "active" : ""} onClick={() => setScreen(SONNENERDE_SCREEN.id)}>
            {SONNENERDE_SCREEN.label}
          </button>
        </div>
        <details className="nav-more">
          <summary>More workflows</summary>
          <div>
            {MORE_WORKFLOW_SCREENS.map((item) => (
              <button type="button" key={item.id} className={screen === item.id ? "active" : ""} onClick={() => setScreen(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        </details>
        <details className="nav-eudr">
          <summary>Optional EUDR support</summary>
          <div>
            {EUDR_SCREENS.map((item) => (
              <button type="button" key={item.id} className={screen === item.id ? "active" : ""} onClick={() => setScreen(item.id)}>
                {item.label.replace("EUDR ", "")}
              </button>
            ))}
          </div>
        </details>
      </nav>

      {statusMessage ? <p className="notice status-message">{statusMessage}</p> : null}
      {screen === "dashboard" && (
        <section className="screen dashboard-screen">
          <div className="dashboard-heading">
            <div>
              <p className="eyebrow">Evidence workspace</p>
              <h2>Biochar dMRV review</h2>
              <p>Evidence-controlled status for the primary Biochar track, with EUDR shown as separate optional support.</p>
            </div>
          </div>
          <div className="dashboard-summary">
            <article className="summary-card summary-primary">
              <div className="summary-icon"><CheckCircle2 size={18} /></div>
              <div>
                <span className="metric-label">Primary track</span>
                <h3>Biochar dMRV</h3>
                <strong className={"status-pill " + statusClassName(biocharStatus)}>{CONTROLLED_STATUS_TEXT[biocharStatus]}</strong>
                <p>Production, quality, permanence, and application evidence remain governed by deterministic gates.</p>
              </div>
            </article>
            <article className="summary-card summary-secondary">
              <div>
                <span className="metric-label">Secondary support</span>
                <h3>EUDR</h3>
                <strong className={"status-pill " + statusClassName(eudrStatus)}>{CONTROLLED_STATUS_TEXT[eudrStatus]}</strong>
                <p>Optional support track.</p>
              </div>
            </article>
          </div>
          <div className="metric-grid">
            <article><span>Biochar checklist</span><strong>{biocharChecklist.completed}/{biocharChecklist.total}</strong><small>completed fields</small></article>
            <article><span>Biochar risk flags</span><strong>{biocharSignals.riskFlags?.length || 0}</strong><small>technical flags</small></article>
            <article><span>EUDR checklist</span><strong>{eudrChecklist.completed}/{eudrChecklist.total}</strong><small>support fields</small></article>
            <article><span>EUDR risk flags</span><strong>{eudrSignals.riskFlags?.length || 0}</strong><small>support flags</small></article>
          </div>
          {renderReviewerRecommendationsBlock(undefined, "queue")}
        </section>
      )}

      {screen === "sonnenerde-demo" && (
        <section className="screen evidence-demo" data-testid="sonnenerde-demonstration" aria-label="CONTROLLED LOCAL DOCUMENT DEMONSTRATION">
          <header className="case-header">
            <div>
              <p className="eyebrow">CONTROLLED LOCAL DOCUMENT CASE</p>
              <h2>Sonnenerde PyroDry</h2>
              <p className="case-context">
                {sonnenerdeAvailable ? "GCSP1134 \u2022 " + sonnenerdeDocuments.length + " source documents \u2022 " + sonnenerdeDuplicateCount + " duplicate detected" : "External local evidence unavailable"}
              </p>
            </div>
            <div className="case-actions">
              <span className={"status-pill " + (sonnenerdeAvailable ? "status-evidence_incomplete" : "status-not_assessable")}>
                {sonnenerdeAvailable ? "EVIDENCE_INCOMPLETE" : "EVIDENCE_UNAVAILABLE"}
              </span>
              <button type="button" className="ghost case-recheck" onClick={() => void loadSonnenerdeDemonstration()} disabled={sonnenerdeLoading}>
                <RefreshCw size={14} /> {sonnenerdeLoading ? "Checking external evidence..." : "Recheck local evidence"}
              </button>
            </div>
          </header>
          <p className="case-disclosure">
            This case demonstrates source-grounded document assessment. Forecasts are not actual production or carbon-removal results.
          </p>
          {sonnenerdeError && <p className="notice">{sonnenerdeError}</p>}
          {sonnenerdeDemo?.availability === "EVIDENCE_UNAVAILABLE" && (
            <article className="card" data-testid="sonnenerde-evidence-unavailable">
              <h3>EVIDENCE_UNAVAILABLE</h3>
              <p>{sonnenerdeDemo.message}</p>
              <p>Unavailable or failed-integrity files: {sonnenerdeDemo.unavailableDocuments?.join(", ") || "not specified"}</p>
            </article>
          )}
          {sonnenerdeDemo?.availability === "AVAILABLE" && (
            <>
              <div className="case-overview">
                <article className="card facts-card">
                  <h3>Project facts</h3>
                  {sonnenerdeFacts.map((field) => (
                    <div key={field.key} className="evidence-field">
                      <strong>{field.label}</strong>
                      <span>{field.value}</span>
                      <p className="source-reference">{field.sources.map((reference) => humanDocumentLabel(reference.fileName) + " \u2022 p. " + reference.page + " \u2022 " + humanEvidenceType(reference.evidenceType)).join("; ")}</p>
                    </div>
                  ))}
                </article>
                <article className="card evidence-state-card">
                  <h3>Evidence state</h3>
                  <dl className="case-state-list">
                    <div><dt>Documents available</dt><dd>{sonnenerdeDocuments.length}</dd></div>
                    <div><dt>Duplicate PDD</dt><dd>{sonnenerdeDuplicateCount} detected</dd></div>
                    <div><dt>Operational evidence</dt><dd>Missing</dd></div>
                    <div><dt>Audit readiness</dt><dd>False</dd></div>
                  </dl>
                </article>
                <article className="card forecast-card">
                  <div className="forecast-heading"><h3>Forecast-only</h3><span>FORECAST ONLY</span></div>
                  <p>Not actual production or carbon removal.</p>
                  <div className="forecast-values">
                    {sonnenerdeDemo.forecastFields?.map((field) => (
                      <div key={field.key} className="evidence-field">
                        <strong>{field.label}</strong>
                        <span>{field.value}</span>
                        <p className="source-reference">{field.sources.map((reference) => humanDocumentLabel(reference.fileName) + " \u2022 p. " + reference.page + " \u2022 Forecast").join("; ")}</p>
                      </div>
                    ))}
                  </div>
                </article>
              </div>

              <section className="case-section review-section">
                <div className="section-heading">
                  <div><p className="eyebrow">Deterministic review</p><h3>Evidence gaps and review queue</h3></div>
                  <small>Controller-provided gaps and conflicts</small>
                </div>
                <div className="review-table" role="table" aria-label="Evidence gaps and review queue">
                  <div className="review-table-header" role="row"><span>Category</span><span>Status</span><span>Reviewer route</span><span>Reason</span></div>
                  {sonnenerdeDemo.evidenceGaps?.map((gap) => (
                    <div key={gap} className="review-table-row" role="row"><span>Evidence gap</span><span className="status-pill status-evidence_incomplete">EVIDENCE_INCOMPLETE</span><span>Evidence intake</span><span>{gap}</span></div>
                  ))}
                  {sonnenerdeDemo.conflicts?.map((conflict) => (
                    <div key={conflict} className="review-table-row" role="row"><span>Conflict</span><span className="status-pill status-needs_human_review">NEEDS_HUMAN_REVIEW</span><span>Human review</span><span>{conflict}</span></div>
                  ))}
                </div>
              </section>

              <section className="case-section source-provenance">
                <div className="section-heading">
                  <div><p className="eyebrow">Document control</p><h3>Source provenance</h3></div>
                  <small>Canonical PDD and exact file records</small>
                </div>
                <div className="source-records">
                  {sonnenerdeDocuments.map((document) => (
                    <article key={document.fileName} className="source-record">
                      <div className="source-record-summary">
                        <div><strong>{humanDocumentLabel(document.fileName)}</strong><span>{document.pageCount} pages {"\u2022"} {document.integrityStatus.replace(/_/g, " ")}</span></div>
                        <span className={"status-pill " + (document.integrityStatus === "VERIFIED" ? "status-assessable" : "status-needs_human_review")}>{document.integrityStatus}</span>
                      </div>
                      <details className="file-details">
                        <summary>File details</summary>
                        <p><strong>Exact filename:</strong> {document.fileName}</p>
                        <p><strong>Date:</strong> {document.documentDate}{document.documentVersion ? " \u2022 version " + document.documentVersion : ""}</p>
                        <p><strong>SHA-256:</strong> {document.sha256}</p>
                        {document.canonicalFileName ? <p><strong>Canonical PDD:</strong> {document.canonicalFileName}</p> : null}
                      </details>
                    </article>
                  ))}
                </div>
              </section>

              <section className="case-section assessment-section">
                <div className="section-heading"><div><p className="eyebrow">Controller assessment</p><h3>Deterministic assessment statuses</h3></div><small>Audit readiness remains false</small></div>
                {sonnenerdeAssessment && (
                  <ul className="assessment-list">
                    {Object.entries(sonnenerdeAssessment).map(([field, status]) => (
                      <li key={field} className="assessment-row"><strong>{field}</strong><span className={"status-pill " + statusClassName(String(status) as ControlledStatus)}>{String(status)}</span></li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </section>
      )}

      {screen === "methodology-preflight" && <MethodologyPreflightWorkspace />}
      {screen === "monitoring-workspace" && <MonitoringWorkspace />}

      {screen === "batch" && (
        <section className="screen">
          <h2>Biochar batch record</h2>
          {renderFields(biocharBySection, batch, updateField)}
        </section>
      )}

      {screen === "eudr-evidence" && (
        <section className="screen">
          <h2>EUDR evidence</h2>
          <div className="notice" style={{ marginBottom: 10 }}>
            This panel supports EUDR due diligence evidence gathering and evidence-gap tracking.
          </div>
          {renderFields(eudrBySection, batch, updateField)}
        </section>
      )}

      {screen === "evidence" && (
        <section className="screen">
          <h2>Evidence intake</h2>
          <p className="notice">Manual text and uploads are USER_ASSERTION records only and cannot satisfy material methodology gates. They support advisory extraction and human workflow reviews only.</p>
          <div className="grid-2">
            <article className="card">
              <h3>Add evidence</h3>
              <FieldInput
                label="Title"
                value={draft.title}
                onChange={(value) => updateDraftEvidenceText({ title: value })}
              />
              <FieldTextarea
                label="Evidence text"
                value={draft.rawText}
                onChange={(value) => updateDraftEvidenceText({ rawText: value })}
              />
              <FieldTextarea
                label="Provenance notes"
                value={draft.notes}
                onChange={(value) => updateDraftEvidenceText({ notes: value })}
              />
              <label className="field">
                <span>Input type</span>
                <select
                  value={draft.inputType}
                  onChange={(event) =>
                    updateDraftEvidenceText({
                      inputType: event.target.value as EvidenceTextType,
                    })
                  }
                >
                  <option value="text">text</option>
                  <option value="document">document</option>
                  <option value="image">image</option>
                  <option value="audio">audio</option>
                </select>
              </label>
              <label className="file-row">
                <UploadCloud size={16} />
                <input type="file" onChange={onAttachFile} />
              </label>
              <button type="button" onClick={addEvidence}>
                Add evidence
              </button>
            </article>
            <article className="card">
              <h3>Source registry</h3>
              {evidence.length === 0 ? (
                <p>No evidence yet.</p>
              ) : (
                <ul className="evidence-list">
                  {evidence.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={selectedEvidenceId === item.id ? "selected" : ""}
                        onClick={() => setSelectedEvidenceId(item.id)}
                      >
                        <strong>{item.title}</strong>
                        <p>{item.classifications.join(", ") || "unclassified"}</p>
                        <p>{item.sourceAttribution}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>
        </section>
      )}

      {screen === "analysis" && (
        <section className="screen">
          <h2>Gemini analysis panel</h2>
          <p className="notice">
            AI output is advisory. It can extract and classify EUDR-relevant fields, detect evidence gaps, and prepare
            support summaries only.
          </p>
          <div className="analysis-row">
            <button onClick={() => void runAction("extract-evidence")} disabled={analysisBusy || !selectedEvidence}>
              Extract evidence
            </button>
            <button onClick={() => void runAction("classify-evidence")} disabled={analysisBusy || !selectedEvidence}>
              Classify evidence
            </button>
            <button onClick={() => void runAction("detect-evidence-gaps")} disabled={analysisBusy || !selectedEvidence}>
              Detect evidence gaps
            </button>
            <button
              onClick={() => void runAction("due-diligence-summary")}
              disabled={analysisBusy || !selectedEvidence}
            >
              Draft support summary
            </button>
          </div>
          {analysisBusy && <p>Gemini is processing...</p>}
          {selectedEvidence && (
            <article className="card" style={{ marginTop: 16 }}>
              <h3>Selected evidence provenance</h3>
              <p><strong>Title:</strong> {selectedEvidence.title}</p>
              <p><strong>Source Attribution:</strong> {selectedEvidence.sourceAttribution || selectedEvidence.fileName || "Manual Entry"}</p>
              <p><strong>Uploaded:</strong> {selectedEvidence.uploadedAt}</p>
              <p><strong>Last Summary:</strong> {selectedEvidence.lastGeminiSummary || "none"}</p>
              {selectedEvidence.lastGeminiResultAt && <p><strong>Extracted At:</strong> {selectedEvidence.lastGeminiResultAt}</p>}
            </article>
          )}
          {lastExtraction && Object.keys(lastExtraction).length > 0 && (
            <article className="card" style={{ marginTop: 16 }}>
              <h3>Active Extraction Provenance</h3>
              <p style={{ fontSize: "0.85rem", color: "#475569" }}>
                All extracted fields below are verified against input evidence sources. Unsupported AI inferences are rejected or routed to human review.
              </p>
            </article>
          )}
          {biocharSummary && <p className="summary">Biochar summary: {biocharSummary}</p>}
          {eudrSummary && <p className="summary">EUDR summary: {eudrSummary}</p>}
        </section>
      )}

      {screen === "checklist" && (
        <section className="screen">
          <h2>Biochar MRV checklist</h2>
          <div className="checklist">
            {biocharChecklist.items.map((item) => (
              <article key={item.id} className={`check-item ${item.status}`}>
                <p>
                  {item.section} - {item.label}
                </p>
                <strong>{item.status}</strong>
              </article>
            ))}
          </div>
        </section>
      )}

      {screen === "gaps" && (
        <section className="screen">
          <h2>Biochar gap report</h2>
          <ul className="gap-list">
            {biocharChecklist.missing.map((item) => (
              <li key={item.id}>{item.label}</li>
            ))}
          </ul>
          <p>Needs human review: {biocharSignals.needsHumanReview ? "Yes" : "No"}</p>
          {renderReviewerRecommendationsBlock("BIOCHAR")}
        </section>
      )}

      {screen === "eudr-checklist" && (
        <section className="screen">
          <h2>EUDR checklist</h2>
          <div className="checklist">
            {eudrChecklist.items.map((item) => (
              <article key={item.id} className={`check-item ${item.status}`}>
                <p>
                  {item.section} - {item.label}
                </p>
                <strong>{item.status}</strong>
              </article>
            ))}
          </div>
        </section>
      )}

      {screen === "eudr-gaps" && (
        <section className="screen">
          <h2>EUDR gap report</h2>
          <p className="notice">This report is support-only and must be confirmed with legal/compliance review.</p>
          <h3>Missing fields</h3>
          <ul className="gap-list">
            {eudrChecklist.missing.map((item) => (
              <li key={item.id}>{item.label}</li>
            ))}
          </ul>
          <h3>EUDR signals</h3>
          <ul className="gap-list">
            <li>Geolocation detected: {eudrSignals.missingGeolocation ? "No" : "Yes"}</li>
            <li>Legality evidence: {eudrSignals.missingLegalityEvidence ? "Missing" : "Present"}</li>
            <li>Deforestation evidence: {eudrSignals.missingDeforestationEvidence ? "Missing" : "Present"}</li>
            <li>Land-use history evidence: {eudrSignals.missingLandUseHistoryEvidence ? "Missing" : "Present"}</li>
            <li>Satellite/map evidence: {eudrSignals.missingSatelliteEvidence ? "Missing" : "Present"}</li>
            <li>Deforestation risk review required: {eudrSignals.deforestationRiskReviewRequired ? "Yes" : "No"}</li>
          </ul>
          {renderReviewerRecommendationsBlock("EUDR")}
        </section>
      )}

      {screen === "audit" && (
        <section className="screen">
          <h2>Audit log</h2>
          <button type="button" onClick={() => void refreshAuditLog()} className="ghost">
            <RefreshCw size={14} /> Reload audit log
          </button>
          <ol className="audit-list">
            {auditLog.map((entry) => (
              <li key={entry.id || entry.eventId} style={{ marginBottom: 16, borderBottom: "1px solid #e2e8f0", paddingBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>
                    {entry.timestamp.slice(0, 19)} — {entry.action} — Track: {entry.track || "BOTH"}
                  </strong>
                  <span className="status-pill" style={{ background: entry.validationStatus === "VALID" ? "#dcfce7" : "#fee2e2", color: entry.validationStatus === "VALID" ? "#166534" : "#991b1b" }}>
                    {entry.validationStatus || "VALID"}
                  </span>
                </div>
                <p style={{ margin: "4px 0", fontSize: "0.85rem", color: "#475569" }}>
                  Model: <strong>{entry.modelName || entry.model}</strong> | Prompt: <strong>{entry.promptVersion}</strong> | Status: <strong>{entry.outputStatus}</strong>
                </p>
                <p style={{ margin: "4px 0", fontSize: "0.9rem" }}>{entry.summary || "No summary"}</p>
                {entry.issues && entry.issues.length > 0 && (
                  <div style={{ color: "#b91c1c", fontSize: "0.8rem", marginTop: 4 }}>
                    <strong>Issues:</strong> {entry.issues.join("; ")}
                  </div>
                )}
                <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 4, fontFamily: "monospace" }}>
                  <div>Event Hash: {entry.eventHash || "N/A"}</div>
                  <div>Prev Hash: {entry.prevHash || "GENESIS"}</div>
                  <div>Output Ref: {entry.outputReference || "N/A"}</div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {screen === "package" && (
        <section className="screen">
          <h2>Export / audit package</h2>
          <p className="notice">Client-side package generation has been removed from the browser.</p>
          <p>Use the Methodology pre-flight workflow for server-controlled package availability and export controls.</p>
          {renderReviewerRecommendationsBlock()}
        </section>
      )}
    </div>
  );
}
