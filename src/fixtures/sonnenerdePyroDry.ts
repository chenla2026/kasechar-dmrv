import type {
  BatchForm,
  ControlledDemonstrationAvailability,
  ControlledDemonstrationAssessment,
  DemonstrationDocument,
  EvidenceSourceReference,
} from "../types";

const EVIDENCE_ROOT = "../projects/biochar/Sonnenerde_PyroDry";
const PDD_HASH = "b3118be7fa8be647ee4c148eb14ea074fdf7710c499e75749c353acaa23a093d";

function source(fileName: string, page: number, documentDate: string, sha256: string, evidenceType: EvidenceSourceReference["evidenceType"], documentVersion?: string): EvidenceSourceReference {
  return { fileName, page, documentDate, documentVersion, sha256, evidenceType };
}

export const SONNENERDE_PYRODRY_DOCUMENTS: DemonstrationDocument[] = [
  { fileName: "03_Austria_Project-Description_EN.pdf", localEvidencePath: EVIDENCE_ROOT + "\\03_Austria_Project-Description_EN.pdf", sha256: "38f7b67c2f57d73bc9c96c3f32ee0cce14e83d0f85bf53aaf8efebc66c45cdfd", pageCount: 2, readable: true, documentDate: "2026-03-25 (PDF metadata)", integrityStatus: "VERIFIED" },
  { fileName: "1_Project_Design_Document_GCSP1134.pdf", localEvidencePath: EVIDENCE_ROOT + "\\1_Project_Design_Document_GCSP1134.pdf", sha256: PDD_HASH, pageCount: 37, readable: true, documentDate: "2025-07-07", documentVersion: "3.0", integrityStatus: "VERIFIED" },
  { fileName: "1_PDD.pdf", localEvidencePath: EVIDENCE_ROOT + "\\1_PDD.pdf", sha256: PDD_HASH, pageCount: 37, readable: true, documentDate: "2025-07-07", documentVersion: "3.0", integrityStatus: "DUPLICATE_IDENTICAL", canonicalFileName: "1_Project_Design_Document_GCSP1134.pdf" },
  { fileName: "2_Validation_Report_GCSP1134.pdf", localEvidencePath: EVIDENCE_ROOT + "\\2_Validation_Report_GCSP1134.pdf", sha256: "f290be4e912d0524ff23d0156e84a761d9c2fb4a1ac09d6826b239e7f4178b17", pageCount: 12, readable: true, documentDate: "2025-07-11", documentVersion: "1", integrityStatus: "VERIFIED" },
  { fileName: "3_Validation_Statement_GCSP1134pdf.pdf", localEvidencePath: EVIDENCE_ROOT + "\\3_Validation_Statement_GCSP1134pdf.pdf", sha256: "cae4ea858ac48cadc04129befa6de18fe8293b0c169e273af95b788574643925", pageCount: 1, readable: true, documentDate: "2025-07-11", documentVersion: "20.03.2025 (template)", integrityStatus: "VERIFIED" },
  { fileName: "4_ValidationFinding_Report_GCSP1134.pdf", localEvidencePath: EVIDENCE_ROOT + "\\4_ValidationFinding_Report_GCSP1134.pdf", sha256: "299e6ad5c80c9d93558c8a5086f8b162755e048001f89493b78af028729ca3bd", pageCount: 3, readable: true, documentDate: "2025-07-11", integrityStatus: "VERIFIED" },
  { fileName: "Certificated.pdf", localEvidencePath: EVIDENCE_ROOT + "\\Certificated.pdf", sha256: "cb497e032cd79f6c1e15ff615a4a0f86bd197a8545dfca8853d5263fd9f872cb", pageCount: 2, readable: true, documentDate: "2026-07-26", integrityStatus: "VERIFIED" },
];

const PDD_DATE = "2025-07-07";
export const SONNENERDE_PYRODRY_FIELD_EVIDENCE: Record<string, EvidenceSourceReference[]> = {
  projectId: [source("1_Project_Design_Document_GCSP1134.pdf", 1, PDD_DATE, PDD_HASH, "DIRECT", "3.0")],
  commodity: [source("1_Project_Design_Document_GCSP1134.pdf", 4, PDD_DATE, PDD_HASH, "DIRECT", "3.0")],
  country: [source("1_Project_Design_Document_GCSP1134.pdf", 1, PDD_DATE, PDD_HASH, "DIRECT", "3.0")],
  region: [source("03_Austria_Project-Description_EN.pdf", 1, "2026-03-25 (PDF metadata)", "38f7b67c2f57d73bc9c96c3f32ee0cce14e83d0f85bf53aaf8efebc66c45cdfd", "DIRECT")],
  plotPoint: [source("1_Project_Design_Document_GCSP1134.pdf", 4, PDD_DATE, PDD_HASH, "DIRECT", "3.0")],
  latitude: [source("1_Project_Design_Document_GCSP1134.pdf", 4, PDD_DATE, PDD_HASH, "DIRECT", "3.0")],
  longitude: [source("1_Project_Design_Document_GCSP1134.pdf", 4, PDD_DATE, PDD_HASH, "DIRECT", "3.0")],
  projectName: [source("1_Project_Design_Document_GCSP1134.pdf", 1, PDD_DATE, PDD_HASH, "DIRECT", "3.0")],
  operator: [source("3_Validation_Statement_GCSP1134pdf.pdf", 1, "2025-07-11", "cae4ea858ac48cadc04129befa6de18fe8293b0c169e273af95b788574643925", "DIRECT")],
  facilityAddress: [source("1_Project_Design_Document_GCSP1134.pdf", 1, PDD_DATE, PDD_HASH, "DIRECT", "3.0")],
  facilityCoordinates: [source("1_Project_Design_Document_GCSP1134.pdf", 4, PDD_DATE, PDD_HASH, "DIRECT", "3.0")],
  technology: [source("1_Project_Design_Document_GCSP1134.pdf", 9, PDD_DATE, PDD_HASH, "DIRECT", "3.0")],
  feedstockCategories: [source("1_Project_Design_Document_GCSP1134.pdf", 11, PDD_DATE, PDD_HASH, "DIRECT", "3.0")],
  intendedApplications: [source("1_Project_Design_Document_GCSP1134.pdf", 30, PDD_DATE, PDD_HASH, "DIRECT", "3.0"), source("1_Project_Design_Document_GCSP1134.pdf", 31, PDD_DATE, PDD_HASH, "DIRECT", "3.0")],
  methodology: [source("1_Project_Design_Document_GCSP1134.pdf", 1, PDD_DATE, PDD_HASH, "DIRECT", "3.0")],
  forecastYield: [source("1_Project_Design_Document_GCSP1134.pdf", 8, PDD_DATE, PDD_HASH, "FORECAST", "3.0")],
  forecastBiocharOutput: [source("1_Project_Design_Document_GCSP1134.pdf", 9, PDD_DATE, PDD_HASH, "FORECAST", "3.0")],
  forecastPermanentSink: [source("1_Project_Design_Document_GCSP1134.pdf", 8, PDD_DATE, PDD_HASH, "FORECAST", "3.0")],
};

export const SONNENERDE_PYRODRY_BATCH: BatchForm = {
  id: "GCSP1134", projectName: "Sonnenerde PyroDry", batchId: "", commodity: "Biochar", producerIdentity: "Sonnenerde GmbH", supplierName: "",
  country: "Austria", region: "Riedlingsdorf, Burgenland", plotPoint: "47.3300432692775,16.153561287932853 (pyrolysis unit)", latitude: "47.3300432692775", longitude: "16.153561287932853", productionDate: "",
  feedstockType: "Woody residues from composting and landscape management; grain husks; paper fibre sludge; mushroom substrate", sourceLocation: "", biomassOrigin: "Organic residues from biomass processing and waste wood from landscape management", contaminationRisk: "", sustainabilityConcern: "",
  pyrolysisDate: "", technologyType: "NGE T-Cracker DH 5000 D pyrolysis unit", temperatureRange: "", batchQuantity: "", energyUse: "",
  labReportAvailable: "", carbonContent: "", moisture: "", ashContent: "", hcRatio: "", stabilityEvidence: "", contaminationIndicators: "",
  applicationLocation: "", applicationDate: "", applicationQuantity: "", cropOrLandType: "", responsiblePerson: "", geotagPhotoEvidence: "",
  eudrProductionPlotGeolocation: "", eudrProductionPeriod: "", eudrCommodityBiomassSource: "", eudrSupplierFarmerProducerIdentity: "", eudrNoDeforestationEvidence: "", eudrLegalityEvidence: "", eudrLandUseHistoryEvidence: "", eudrSatelliteMapEvidence: "", eudrRiskStatus: "", eudrLatitude: "", eudrLongitude: "", eudrPolygonGeometry: "", eudrCrs: "WGS84", eudrCoordinateSource: "", eudrCaptureDate: "", eudrLinkedPlotRecord: "",
  permanenceClass: "", monitoringPlan: "", reversalRisk: "", leakageRisk: "", doubleCountingRisk: "",
  notes: "Controlled document-ingestion and evidence-mapping demonstration only. No actual batch, laboratory, transport, application, permit, certification, registry, or removal evidence is represented.",
};

export const SONNENERDE_PYRODRY_FORECASTS = {
  feedstockToBiocharYield: "0.4 t biochar (DM) / t feedstock (DM)", plannedFeedstockConsumption: "2,500 t (DM) per year", nominalBiocharProduction: "1,000 t (DM) per year", fiveYearCSinkPotential: "9,000 tCO2eq", fiveYearPermanentCSinkForecast: "6,750 tCO2eq",
} as const;

export const SONNENERDE_PYRODRY_PROJECT_CONFIGURATION = {
  projectId: "GCSP1134",
  pddIssueDate: "07.07.2025",
  pddVersion: "3.0",
  methodology: "Global Biochar C-Sink 3.1",
} as const;

export const SONNENERDE_PYRODRY_AVAILABILITY: ControlledDemonstrationAvailability = {
  projectConfigurationComplete: false, feedstockBatchEligibility: false, actualBatchMassBalance: false, laboratoryQualityAndStability: false, actualCarbonRemovalQuantity: false, transportChainOfCustodyAndApplication: false, permitAndLegalEvidence: false, certificationAndRegistryEvidence: false, dryMatterMethodAndElectricityFactorEvidence: false,
};

export const SONNENERDE_PYRODRY_CONFLICTS = [
  "DUPLICATE_PDD_FILES", "LOCATION_SPELLING_INCONSISTENCY", "PDD_ISSUE_DATE_FOOTER_METADATA_INCONSISTENCY", "CH4_DOCUMENTATION_GAP", "FORECAST_POTENTIAL_VERSUS_PERMANENT_FORECAST_WORDING", "PUBLIC_CONSULTATION_INFORMATION_MISSING", "CORRECTIVE_ACTION_EVIDENCE_MISSING", "ACTUAL_OPERATIONAL_AND_LABORATORY_RECORDS_MISSING",
] as const;

/** Test-only static expectation. Runtime Sonnenerde assessment is server-owned in server/controller/sonnenerdeDemo.mjs. */
export const SONNENERDE_PYRODRY_ASSESSMENT: ControlledDemonstrationAssessment = { fileIngestion: "VERIFIED", projectIdentity: "VERIFIED", projectConfiguration: "EVIDENCE_INCOMPLETE", feedstockEligibility: "EVIDENCE_INCOMPLETE", actualBatchMassBalance: "NOT_ASSESSABLE", laboratoryQualityAndStability: "NOT_ASSESSABLE", actualCarbonRemovalQuantity: "NOT_ASSESSABLE", transportChainOfCustodyAndApplication: "NOT_ASSESSABLE", permitAndLegalStatus: "NEEDS_HUMAN_REVIEW", certificationAndRegistryValidity: "NEEDS_HUMAN_REVIEW", dryMatterMethodAndElectricityFactor: "NEEDS_HUMAN_REVIEW", documentControlConflicts: "NEEDS_HUMAN_REVIEW", auditReady: false };
