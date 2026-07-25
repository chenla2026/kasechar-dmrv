import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, FileText, RefreshCw, ShieldCheck, UploadCloud } from "lucide-react";
import type {
  AppScreen,
  AuditLogEvent,
  AuditPackage,
  BatchForm,
  BiocharControlledStatus,
  BrainAction,
  BrainRequest,
  ControlledStatus,
  EudrAuditPackage,
  EudrControlledStatus,
  EudrDecisionSignals,
  EvidenceRecord,
  DecisionSignals,
  GeminiExtraction,
  GeminiResult,
} from "./types";
import { CONTROLLED_STATUS_TEXT } from "./types";
import {
  applyExtractionToBatch,
  buildBiocharChecklist,
  buildEudrChecklist,
  createAuditPackagePayload,
  createEudrAuditPackagePayload,
  createEmptyBatch,
  generateReviewerRecommendations,
  inferBiocharControlledStatus,
  inferEudrControlledStatus,
} from "./lib/mrvEngine";
import { getAuditLog, runBrainAnalysis } from "./controller/geminiController";
import "./styles.css";

type EvidenceTextType = "text" | "document" | "image" | "audio";

type FieldDef = {
  section: string;
  field: keyof BatchForm;
  label: string;
  type: "text" | "textarea";
};

const SCREENS: { id: AppScreen; label: string; secondary?: boolean }[] = [
  { id: "dashboard", label: "Dashboard" },
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

  const [biocharPackageReady, setBiocharPackageReady] = useState(false);
  const [eudrPackageReady, setEudrPackageReady] = useState(false);
  const [lastExtraction, setLastExtraction] = useState<GeminiExtraction>(BLANK_EVIDENCE);
  const [biocharPackage, setBiocharPackage] = useState<AuditPackage | null>(null);
  const [eudrPackage, setEudrPackage] = useState<EudrAuditPackage | null>(null);
  const [biocharSummary, setBiocharSummary] = useState("");
  const [eudrSummary, setEudrSummary] = useState("");

  const biocharChecklist = useMemo(() => buildBiocharChecklist(batch), [batch]);
  const eudrChecklist = useMemo(() => buildEudrChecklist(batch), [batch]);

  const biocharStatus = useMemo(
    () => inferBiocharControlledStatus(batch, { ...biocharSignals, packageReady: biocharPackageReady }),
    [batch, biocharSignals, biocharPackageReady],
  );

  const eudrStatus = useMemo(
    () => inferEudrControlledStatus(batch, { ...eudrSignals, packageReady: eudrPackageReady }),
    [batch, eudrSignals, eudrPackageReady],
  );

  const selectedEvidence = evidence.find((item) => item.id === selectedEvidenceId) ?? null;
  const biocharBySection = useMemo(() => groupBySection(BIOCHAR_FIELDS), []);
  const eudrBySection = useMemo(() => groupBySection(EUDR_FIELDS), []);

  useEffect(() => {
    void refreshAuditLog();
  }, []);

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

  function preparePackages() {
    const nextBiocharStatus: BiocharControlledStatus = inferBiocharControlledStatus(batch, {
      ...biocharSignals,
      packageReady: true,
    });
    const nextEudrStatus: EudrControlledStatus = inferEudrControlledStatus(batch, {
      ...eudrSignals,
      packageReady: true,
    });

    setBiocharPackage(
      createAuditPackagePayload(
        batch,
        evidence,
        lastExtraction,
        {
          ...biocharSignals,
          needsHumanReview:
            nextBiocharStatus === "NEEDS_HUMAN_REVIEW" || biocharSignals.needsHumanReview,
        },
        nextBiocharStatus,
      ),
    );

    setEudrPackage(
      createEudrAuditPackagePayload(
        batch,
        evidence,
        lastExtraction,
        {
          ...eudrSignals,
          needsHumanReview: nextEudrStatus === "DEFORESTATION_RISK_REVIEW_REQUIRED" || eudrSignals.needsHumanReview,
        },
        nextEudrStatus,
      ),
    );

    setBiocharPackageReady(true);
    setEudrPackageReady(true);
    setStatusMessage("Generated Biochar and EUDR support packages.");
  }

  const reviewerRecs = generateReviewerRecommendations(
    batch,
    biocharStatus,
    eudrStatus,
    biocharSignals,
    eudrSignals,
    evidence,
  );

  const renderReviewerRecommendationsBlock = (trackFilter?: "BIOCHAR" | "EUDR" | "BOTH") => {
    const filtered = trackFilter
      ? reviewerRecs.filter((r) => r.track === trackFilter || r.track === "BOTH")
      : reviewerRecs;
    if (filtered.length === 0) {
      return <p className="notice" style={{ marginTop: 16 }}>No reviewer routing recommendations triggered. Evidence gates pass without gap warnings.</p>;
    }
    return (
      <div className="recs-block" style={{ marginTop: 24 }}>
        <h3>Reviewer Routing Recommendations (Workflow Support)</h3>
        <p className="notice" style={{ marginBottom: 12 }}>
          These workflow recommendations identify technical evidence gaps and route to human specialists. They do not issue legal conclusions or auto-assign users.
        </p>
        <div className="stat-grid">
          {filtered.map((rec, idx) => (
            <article key={`${rec.type}-${idx}`} className="card" style={{ borderLeft: rec.priority === "HIGH" ? "4px solid #e11d48" : "4px solid #f59e0b" }}>
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
        <div>
          <h1>KaseChar Biochar dMRV</h1>
          <h2>Primary Track: Biochar dMRV | Secondary Track: Optional EUDR Evidence Support</h2>
          <p className="notice" style={{ marginTop: 8 }}>
            This module provides evidence support and dMRV tracking only. KaseChar does not certify legal compliance or submit filings to EU authorities.
          </p>
        </div>
        <div className="status">{sharedStatusRow}</div>
      </header>

      <nav className="tabs">
        {SCREENS.map((item) => (
          <button
            type="button"
            key={item.id}
            className={`${screen === item.id ? "active" : ""} ${item.secondary ? "secondary-tab" : ""}`}
            style={item.secondary ? { borderLeft: "2px solid #0284c7", marginLeft: 4 } : undefined}
            onClick={() => setScreen(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {statusMessage ? <p className="notice">{statusMessage}</p> : null}
      {screen === "dashboard" && (
        <section className="screen">
          <h2>Project dashboard</h2>
          <div className="stat-grid">
            <article>
              <CheckCircle2 />
              <h3>Biochar track</h3>
              <strong className={`status-pill ${statusClassName(biocharStatus)}`}>
                {CONTROLLED_STATUS_TEXT[biocharStatus]}
              </strong>
            </article>
            <article>
              <Activity />
              <h3>EUDR support track</h3>
              <strong className={`status-pill ${statusClassName(eudrStatus)}`}>
                {CONTROLLED_STATUS_TEXT[eudrStatus]}
              </strong>
            </article>
            <article>
              <FileText />
              <h3>Biochar checklist completion</h3>
              <strong>
                {biocharChecklist.completed}/{biocharChecklist.total}
              </strong>
            </article>
            <article>
              <FileText />
              <h3>EUDR checklist completion</h3>
              <strong>
                {eudrChecklist.completed}/{eudrChecklist.total}
              </strong>
            </article>
            <article>
              <ShieldCheck />
              <h3>Biochar risk flags</h3>
              <strong>{biocharSignals.riskFlags?.length || 0}</strong>
            </article>
            <article>
              <ShieldCheck />
              <h3>EUDR risk flags</h3>
              <strong>{eudrSignals.riskFlags?.length || 0}</strong>
            </article>
          </div>
          {renderReviewerRecommendationsBlock()}
        </section>
      )}

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
          <p className="notice">
            Two separate outputs are generated: Biochar MRV package and EUDR evidence support package.
          </p>
          <button type="button" onClick={preparePackages} disabled={analysisBusy}>
            Generate package outputs
          </button>
          {renderReviewerRecommendationsBlock()}
          <h3>Biochar package</h3>
          <pre>{JSON.stringify(biocharPackage, null, 2)}</pre>
          <h3>EUDR package</h3>
          <pre>{JSON.stringify(eudrPackage, null, 2)}</pre>
        </section>
      )}
    </div>
  );
}
