export const BIOCHAR_CONTROLLED_STATUSES = [
  "ASSESSABLE",
  "NOT_ASSESSABLE",
  "NEEDS_HUMAN_REVIEW",
  "EVIDENCE_INCOMPLETE",
  "READY_FOR_AUDIT_PACKAGE",
] as const;

export const EUDR_CONTROLLED_STATUSES = [
  "EUDR_EVIDENCE_READY",
  "EUDR_EVIDENCE_INCOMPLETE",
  "GEOLOCATION_MISSING",
  "LEGALITY_EVIDENCE_MISSING",
  "DEFORESTATION_RISK_REVIEW_REQUIRED",
  "NEEDS_HUMAN_REVIEW",
  "NOT_ASSESSABLE",
] as const;

export const CONTROLLED_STATUSES = [
  ...BIOCHAR_CONTROLLED_STATUSES,
  ...EUDR_CONTROLLED_STATUSES,
] as const;

export type BiocharControlledStatus = (typeof BIOCHAR_CONTROLLED_STATUSES)[number];
export type EudrControlledStatus = (typeof EUDR_CONTROLLED_STATUSES)[number];
export type ControlledStatus = BiocharControlledStatus | EudrControlledStatus;

export const CONTROLLED_STATUS_TEXT: Record<ControlledStatus, string> = {
  ASSESSABLE: "Ready for internal review",
  NEEDS_HUMAN_REVIEW: "Needs reviewer decision",
  EVIDENCE_INCOMPLETE: "Missing evidence required",
  READY_FOR_AUDIT_PACKAGE: "Audit package ready",
  NOT_ASSESSABLE: "Not assessable without stronger evidence",
  EUDR_EVIDENCE_READY: "EUDR evidence ready",
  EUDR_EVIDENCE_INCOMPLETE: "EUDR evidence incomplete",
  GEOLOCATION_MISSING: "Geolocation missing",
  LEGALITY_EVIDENCE_MISSING: "Legality evidence missing",
  DEFORESTATION_RISK_REVIEW_REQUIRED: "Deforestation risk review required",
};

export type EvidenceInputType = "text" | "document" | "image" | "audio";

export type AppScreen =
  | "dashboard"
  | "batch"
  | "evidence"
  | "analysis"
  | "checklist"
  | "gaps"
  | "eudr-evidence"
  | "eudr-checklist"
  | "eudr-gaps"
  | "audit"
  | "package"
  | "sonnenerde-demo";

export interface BatchForm {
  id: string;
  projectName: string;
  batchId: string;
  commodity: string;
  producerIdentity: string;
  supplierName: string;

  country: string;
  region: string;
  plotPoint: string;
  latitude: string;
  longitude: string;
  productionDate: string;

  feedstockType: string;
  sourceLocation: string;
  biomassOrigin: string;
  contaminationRisk: string;
  sustainabilityConcern: string;

  pyrolysisDate: string;
  technologyType: string;
  temperatureRange: string;
  batchQuantity: string;
  energyUse: string;

  labReportAvailable: string;
  carbonContent: string;
  moisture: string;
  ashContent: string;
  hcRatio: string;
  stabilityEvidence: string;
  contaminationIndicators: string;

  applicationLocation: string;
  applicationDate: string;
  applicationQuantity: string;
  cropOrLandType: string;
  responsiblePerson: string;
  geotagPhotoEvidence: string;

  eudrProductionPlotGeolocation: string;
  eudrProductionPeriod: string;
  eudrCommodityBiomassSource: string;
  eudrSupplierFarmerProducerIdentity: string;
  eudrNoDeforestationEvidence: string;
  eudrLegalityEvidence: string;
  eudrLandUseHistoryEvidence: string;
  eudrSatelliteMapEvidence: string;
  eudrRiskStatus: string;

  // Structured EUDR Geolocation fields
  eudrLatitude?: string;
  eudrLongitude?: string;
  eudrPolygonGeometry?: string;
  eudrCrs?: string;
  eudrCoordinateSource?: string;
  eudrCaptureDate?: string;
  eudrLinkedPlotRecord?: string;

  permanenceClass: string;
  monitoringPlan: string;
  reversalRisk: string;
  leakageRisk: string;
  doubleCountingRisk: string;

  notes: string;
}

export interface EvidenceRecord {
  id: string;
  title: string;
  inputType: EvidenceInputType;
  sourceAttribution: string;
  rawText: string;
  notes: string;
  uploadedAt: string;
  fileName?: string;
  fileType?: string;
  classifications: string[];
  lastGeminiResultAt?: string;
  lastGeminiSummary?: string;
}

export type EvidenceAssertionStatus = "DIRECT" | "FORECAST" | "DOCUMENTARY";
export type EvidenceIntegrityStatus = "VERIFIED" | "DUPLICATE_IDENTICAL";
export type DemonstrationControlledStatus = "VERIFIED" | BiocharControlledStatus;

export interface EvidenceSourceReference {
  fileName: string;
  page: number;
  documentDate: string;
  documentVersion?: string;
  sha256: string;
  evidenceType: EvidenceAssertionStatus;
}

export interface DemonstrationDocument {
  fileName: string;
  localEvidencePath?: string;
  sha256: string;
  pageCount: number;
  readable: boolean;
  documentDate: string;
  documentVersion?: string;
  integrityStatus: EvidenceIntegrityStatus;
  canonicalFileName?: string;
}

export interface ControlledDemonstrationAvailability {
  projectConfigurationComplete: boolean;
  feedstockBatchEligibility: boolean;
  actualBatchMassBalance: boolean;
  laboratoryQualityAndStability: boolean;
  actualCarbonRemovalQuantity: boolean;
  transportChainOfCustodyAndApplication: boolean;
  permitAndLegalEvidence: boolean;
  certificationAndRegistryEvidence: boolean;
  dryMatterMethodAndElectricityFactorEvidence: boolean;
}

export interface ControlledDemonstrationAssessment {
  fileIngestion: DemonstrationControlledStatus;
  projectIdentity: DemonstrationControlledStatus;
  projectConfiguration: BiocharControlledStatus;
  feedstockEligibility: BiocharControlledStatus;
  actualBatchMassBalance: BiocharControlledStatus;
  laboratoryQualityAndStability: BiocharControlledStatus;
  actualCarbonRemovalQuantity: BiocharControlledStatus;
  transportChainOfCustodyAndApplication: BiocharControlledStatus;
  permitAndLegalStatus: BiocharControlledStatus;
  certificationAndRegistryValidity: BiocharControlledStatus;
  dryMatterMethodAndElectricityFactor: BiocharControlledStatus;
  documentControlConflicts: BiocharControlledStatus;
  auditReady: false;
}

export type LocalEvidenceAvailability = "AVAILABLE" | "EVIDENCE_UNAVAILABLE";

export interface SonnenerdeDemonstrationField {
  key: string;
  label: string;
  value: string;
  sources: EvidenceSourceReference[];
}

export interface SonnenerdeDemonstrationResponse {
  availability: LocalEvidenceAvailability;
  label: "CONTROLLED LOCAL DOCUMENT DEMONSTRATION";
  message: string;
  documents?: DemonstrationDocument[];
  unavailableDocuments?: string[];
  projectFields?: SonnenerdeDemonstrationField[];
  forecastFields?: SonnenerdeDemonstrationField[];
  evidenceGaps?: string[];
  conflicts?: string[];
  evidenceAvailability?: ControlledDemonstrationAvailability;
  assessment?: ControlledDemonstrationAssessment;
}

export interface GeminiExtraction {
  feedstockEvidence: {
    feedstockType?: string;
    sourceLocation?: string;
    supplierName?: string;
    biomassOrigin?: string;
    contaminationRisk?: string;
    sustainabilityConcern?: string;
  };
  productionEvidence: {
    pyrolysisDate?: string;
    technologyType?: string;
    temperatureRange?: string;
    batchId?: string;
    batchQuantity?: string;
    energyUse?: string;
    producerIdentity?: string;
  };
  qualityEvidence: {
    labReportAvailable?: string;
    carbonContent?: string;
    moisture?: string;
    ashContent?: string;
    hcRatio?: string;
    stabilityEvidence?: string;
    contaminationIndicators?: string;
  };
  applicationEvidence: {
    applicationLocation?: string;
    applicationDate?: string;
    applicationQuantity?: string;
    cropOrLandType?: string;
    responsiblePerson?: string;
    geotagPhotoEvidence?: string;
  };
  storageEvidence: {
    permanenceClass?: string;
    monitoringPlan?: string;
    reversalRisk?: string;
    leakageRisk?: string;
    doubleCountingRisk?: string;
  };
  eudrEvidence: {
    productionPlotGeolocation?: string;
    productionPeriod?: string;
    commodityOrBiomassSource?: string;
    supplierFarmerProducerIdentity?: string;
    noDeforestationEvidence?: string;
    legalityEvidence?: string;
    landUseHistoryEvidence?: string;
    satelliteMapEvidence?: string;
    riskStatus?: string;
    latitude?: string;
    longitude?: string;
    polygonGeometry?: string;
    crs?: string;
    coordinateSource?: string;
    captureDate?: string;
    linkedPlotRecord?: string;
  };
}

export interface FieldProvenance {
  evidenceIds: string[];
  sourceReferences: string[];
  value: string;
  extractedAt: string;
  supportedByEvidence: boolean;
}

export interface GeminiResult {
  extraction?: GeminiExtraction;
  missingEvidence?: string[];
  findings?: string[];
  gapSummary?: {
    missingRequiredFields?: string[];
    missingGeolocation?: boolean;
    missingLegalityEvidence?: boolean;
  };
  eudrGapSummary?: {
    missingRequiredFields?: string[];
    missingGeolocation?: boolean;
    missingLegalityEvidence?: boolean;
    missingDeforestationEvidence?: boolean;
    missingLandUseHistoryEvidence?: boolean;
    missingSatelliteEvidence?: boolean;
    highDeforestationRisk?: boolean;
  };
  classifications?: string[];
  riskFlags?: string[];
  riskStatus?: string;
  summary?: string;
  rationale?: string;
  confidence?: number;
  fieldProvenance?: Record<string, FieldProvenance>;
  validationResult?: {
    valid: boolean;
    issues: string[];
    unsupportedFields: string[];
  };
  outputHash?: string;
}

export type BrainAction =
  | "extract-evidence"
  | "classify-evidence"
  | "detect-evidence-gaps"
  | "due-diligence-summary";

export interface BrainRequest {
  action: BrainAction;
  evidenceId: string;
  evidenceText: string;
  metadata: {
    sourceLabel: string;
    inputType: EvidenceInputType;
    evidenceCount: number;
    fileName?: string;
    projectId?: string;
    track?: "BIOCHAR" | "EUDR" | "BOTH";
    inputEvidenceIds?: string[];
    sourceReferences?: string[];
  };
  context: {
    batchContext: Partial<BatchForm>;
  };
}

export interface BrainResponse {
  action: BrainAction;
  status: "success" | "partial" | "error";
  model: string;
  promptVersion: string;
  inputType: EvidenceInputType;
  outputStatus: "accepted" | "missing" | "blocked";
  recordedAt: string;
  result: GeminiResult;
  errorMessage?: string;
  // Upgraded contract & provenance fields:
  requestId: string;
  projectId: string;
  track: "BIOCHAR" | "EUDR" | "BOTH";
  inputEvidenceIds: string[];
  sourceReferences: string[];
  modelName: string;
  modelVersion?: string;
  extractedAt: string;
  structuredOutput: GeminiResult;
  validationResult: {
    valid: boolean;
    issues: string[];
    unsupportedFields: string[];
  };
  confidence: number;
  uncertainty?: string;
  outputHash: string;
  failureReason?: string;
  refusalReason?: string;
}

export interface AuditLogEvent {
  id: string;
  eventId: string;
  timestamp: string;
  actor: string;
  projectId: string;
  track: "BIOCHAR" | "EUDR" | "BOTH";
  action: BrainAction | string;
  status: "success" | "partial" | "error";
  validationStatus: "VALID" | "INVALID" | "BLOCKED" | "PARTIAL" | "UNSUPPORTED";
  inputEvidenceIds: string[];
  outputReference: string;
  model: string;
  modelName: string;
  promptVersion: string;
  inputType: EvidenceInputType;
  outputStatus: "accepted" | "missing" | "blocked";
  sourceLabel?: string;
  sourceEvidenceCount?: number;
  summary?: string;
  issues?: string[];
  prevHash: string;
  eventHash: string;
}

export interface ChecklistItem {
  id: string;
  section: string;
  label: string;
  value: string;
  required: true;
  status: "complete" | "missing";
}

export type ReviewerRecommendationType =
  | "LEGAL_REVIEW"
  | "GIS_REVIEW"
  | "SOURCING_REVIEW"
  | "BIOCHAR_MRV_REVIEW"
  | "LABORATORY_REVIEW"
  | "HUMAN_PROJECT_REVIEW";

export interface ReviewerRecommendation {
  type: ReviewerRecommendationType;
  reason: string;
  track: "BIOCHAR" | "EUDR" | "BOTH";
  priority: "HIGH" | "MEDIUM" | "LOW";
}

export interface AuditPackage {
  packageId?: string;
  generatedAt: string;
  status: BiocharControlledStatus;
  project: Pick<
    BatchForm,
    | "id"
    | "projectName"
    | "batchId"
    | "commodity"
    | "producerIdentity"
    | "country"
    | "region"
    | "plotPoint"
    | "latitude"
    | "longitude"
    | "productionDate"
  >;
  checklist: {
    completed: number;
    total: number;
    missing: ChecklistItem[];
  };
  evidenceDocuments: Array<{
    id: string;
    title: string;
    sourceAttribution: string;
    uploadedAt: string;
    inputType: EvidenceInputType;
    classification: string[];
  }>;
  extractedEvidence: GeminiExtraction;
  evidenceGaps: string[];
  auditNotes: string;
  controllerSummary: {
    riskFlags: string[];
    confidence: number;
    missingEvidence: string[];
  };
  outputHash?: string;
  reviewerRecommendations: ReviewerRecommendation[];
  provenanceSummary?: {
    modelName: string;
    promptVersion: string;
    inputEvidenceIds: string[];
    sourceReferences: string[];
    auditEventHashes: string[];
  };
}

export interface EudrAuditPackage {
  packageId?: string;
  generatedAt: string;
  status: EudrControlledStatus;
  project: Pick<
    BatchForm,
    | "id"
    | "projectName"
    | "batchId"
    | "country"
    | "region"
    | "eudrProductionPlotGeolocation"
    | "eudrProductionPeriod"
    | "eudrCommodityBiomassSource"
  >;
  checklist: {
    completed: number;
    total: number;
    missing: ChecklistItem[];
  };
  eudrEvidence: {
    productionGeolocation: string;
    commodityOrBiomassSource: string;
    producerOrSupplierIdentity: string;
    productionPeriod: string;
    noDeforestationEvidence: string;
    legalityEvidence: string;
    landUseHistoryEvidence: string;
    satelliteOrMapEvidence: string;
    riskStatus: string;
    latitude?: string;
    longitude?: string;
    polygonGeometry?: string;
    crs?: string;
    coordinateSource?: string;
    captureDate?: string;
    linkedPlotRecord?: string;
  };
  missingEvidence: string[];
  extractedEvidence: Pick<
    GeminiExtraction,
    "eudrEvidence"
  >;
  evidenceGaps: string[];
  controllerSummary: {
    riskFlags: string[];
    confidence: number;
  };
  outputHash?: string;
  reviewerRecommendations: ReviewerRecommendation[];
  provenanceSummary?: {
    modelName: string;
    promptVersion: string;
    inputEvidenceIds: string[];
    sourceReferences: string[];
    auditEventHashes: string[];
  };
}

export interface DecisionSignals {
  riskFlags?: string[];
  notAssessable?: boolean;
  needsHumanReview?: boolean;
}

export interface EudrDecisionSignals {
  riskFlags?: string[];
  notAssessable?: boolean;
  missingGeolocation?: boolean;
  missingLegalityEvidence?: boolean;
  missingDeforestationEvidence?: boolean;
  missingLandUseHistoryEvidence?: boolean;
  missingSatelliteEvidence?: boolean;
  deforestationRiskReviewRequired?: boolean;
  needsHumanReview?: boolean;
}
