import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const EVIDENCE_ROOT = path.resolve(process.cwd(), "../projects/biochar/Sonnenerde_PyroDry");
const PDD_HASH = "b3118be7fa8be647ee4c148eb14ea074fdf7710c499e75749c353acaa23a093d";

const documents = [
  { fileName: "03_Austria_Project-Description_EN.pdf", sha256: "38f7b67c2f57d73bc9c96c3f32ee0cce14e83d0f85bf53aaf8efebc66c45cdfd", pageCount: 2, documentDate: "2026-03-25 (PDF metadata)", integrityStatus: "VERIFIED" },
  { fileName: "1_Project_Design_Document_GCSP1134.pdf", sha256: PDD_HASH, pageCount: 37, documentDate: "2025-07-07", documentVersion: "3.0", integrityStatus: "VERIFIED" },
  { fileName: "1_PDD.pdf", sha256: PDD_HASH, pageCount: 37, documentDate: "2025-07-07", documentVersion: "3.0", integrityStatus: "DUPLICATE_IDENTICAL", canonicalFileName: "1_Project_Design_Document_GCSP1134.pdf" },
  { fileName: "2_Validation_Report_GCSP1134.pdf", sha256: "f290be4e912d0524ff23d0156e84a761d9c2fb4a1ac09d6826b239e7f4178b17", pageCount: 12, documentDate: "2025-07-11", documentVersion: "1", integrityStatus: "VERIFIED" },
  { fileName: "3_Validation_Statement_GCSP1134pdf.pdf", sha256: "cae4ea858ac48cadc04129befa6de18fe8293b0c169e273af95b788574643925", pageCount: 1, documentDate: "2025-07-11", documentVersion: "20.03.2025 (template)", integrityStatus: "VERIFIED" },
  { fileName: "4_ValidationFinding_Report_GCSP1134.pdf", sha256: "299e6ad5c80c9d93558c8a5086f8b162755e048001f89493b78af028729ca3bd", pageCount: 3, documentDate: "2025-07-11", integrityStatus: "VERIFIED" },
  { fileName: "Certificated.pdf", sha256: "cb497e032cd79f6c1e15ff615a4a0f86bd197a8545dfca8853d5263fd9f872cb", pageCount: 2, documentDate: "2026-07-26", integrityStatus: "VERIFIED" },
];

function source(fileName, page, documentDate, sha256, evidenceType, documentVersion) {
  return { fileName, page, documentDate, documentVersion, sha256, evidenceType };
}

const PDD_DATE = "2025-07-07";
const fields = [
  { key: "projectId", label: "Project ID", value: "GCSP1134", sources: [source("1_Project_Design_Document_GCSP1134.pdf", 1, PDD_DATE, PDD_HASH, "DIRECT", "3.0")] },
  { key: "projectName", label: "Project name", value: "Sonnenerde PyroDry", sources: [source("1_Project_Design_Document_GCSP1134.pdf", 1, PDD_DATE, PDD_HASH, "DIRECT", "3.0")] },
  { key: "operator", label: "Operator", value: "Sonnenerde GmbH", sources: [source("3_Validation_Statement_GCSP1134pdf.pdf", 1, "2025-07-11", "cae4ea858ac48cadc04129befa6de18fe8293b0c169e273af95b788574643925", "DIRECT")] },
  { key: "facility", label: "Facility", value: "Oberwarter Strasse 100, 7422 Riedlingsdorf, Austria", sources: [source("1_Project_Design_Document_GCSP1134.pdf", 1, PDD_DATE, PDD_HASH, "DIRECT", "3.0")] },
  { key: "coordinates", label: "Pyrolysis-unit coordinates", value: "47.3300432692775, 16.153561287932853", sources: [source("1_Project_Design_Document_GCSP1134.pdf", 4, PDD_DATE, PDD_HASH, "DIRECT", "3.0")] },
  { key: "technology", label: "Technology", value: "NGE T-Cracker DH 5000 D pyrolysis unit", sources: [source("1_Project_Design_Document_GCSP1134.pdf", 9, PDD_DATE, PDD_HASH, "DIRECT", "3.0")] },
  { key: "feedstock", label: "Feedstock categories", value: "Woody residues from composting and landscape management; grain husks; paper fibre sludge; mushroom substrate", sources: [source("1_Project_Design_Document_GCSP1134.pdf", 11, PDD_DATE, PDD_HASH, "DIRECT", "3.0")] },
  { key: "applications", label: "Intended applications", value: "Soil products, compost additive, manure additive, and feed additive", sources: [source("1_Project_Design_Document_GCSP1134.pdf", 30, PDD_DATE, PDD_HASH, "DIRECT", "3.0"), source("1_Project_Design_Document_GCSP1134.pdf", 31, PDD_DATE, PDD_HASH, "DIRECT", "3.0")] },
  { key: "methodology", label: "PDD methodology", value: "Global Biochar C-Sink 3.1; PDD issue 07.07.2025; version 3.0", sources: [source("1_Project_Design_Document_GCSP1134.pdf", 1, PDD_DATE, PDD_HASH, "DIRECT", "3.0")] },
];

const forecasts = [
  { key: "yield", label: "Feedstock-to-biochar yield", value: "0.4 t biochar (DM) / t feedstock (DM)", sources: [source("1_Project_Design_Document_GCSP1134.pdf", 8, PDD_DATE, PDD_HASH, "FORECAST", "3.0")] },
  { key: "plannedCapacity", label: "Planned annual capacity", value: "2,500 t (DM) feedstock; 1,000 t (DM) nominal biochar", sources: [source("1_Project_Design_Document_GCSP1134.pdf", 9, PDD_DATE, PDD_HASH, "FORECAST", "3.0")] },
  { key: "fiveYear", label: "Five-year C-sink forecast", value: "9,000 tCO2eq potential; 6,750 tCO2eq permanent forecast", sources: [source("1_Project_Design_Document_GCSP1134.pdf", 8, PDD_DATE, PDD_HASH, "FORECAST", "3.0")] },
];

const evidenceAvailability = {
  projectConfigurationComplete: false, feedstockBatchEligibility: false, actualBatchMassBalance: false, laboratoryQualityAndStability: false, actualCarbonRemovalQuantity: false, transportChainOfCustodyAndApplication: false, permitAndLegalEvidence: false, certificationAndRegistryEvidence: false, dryMatterMethodAndElectricityFactorEvidence: false,
};

const conflicts = [
  "DUPLICATE_PDD_FILES", "LOCATION_SPELLING_INCONSISTENCY", "PDD_ISSUE_DATE_FOOTER_METADATA_INCONSISTENCY", "CH4_DOCUMENTATION_GAP", "FORECAST_POTENTIAL_VERSUS_PERMANENT_FORECAST_WORDING", "PUBLIC_CONSULTATION_INFORMATION_MISSING", "CORRECTIVE_ACTION_EVIDENCE_MISSING", "ACTUAL_OPERATIONAL_AND_LABORATORY_RECORDS_MISSING",
];

const evidenceGaps = [
  "No actual batch mass balance, dry-matter weigh records, or production logs.",
  "No laboratory report for H/Corg, carbon content, moisture, ash, or stability.",
  "No transport, ownership-transfer, final-use, application GPS, or chain-of-custody records.",
  "No permit, registry entry, certificate primary document, or corrective-action evidence.",
];

function sha256(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function buildAssessment() {
  const canonicalDocuments = documents.filter((document) => document.integrityStatus === "VERIFIED");
  const duplicateDocuments = documents.filter((document) => document.integrityStatus === "DUPLICATE_IDENTICAL");
  const duplicateIsExact = duplicateDocuments.every((duplicate) =>
    canonicalDocuments.some((canonical) => canonical.fileName === duplicate.canonicalFileName && canonical.sha256 === duplicate.sha256),
  );
  const filesVerified = documents.length > 0 && documents.every((document) => document.sha256.length === 64 && document.pageCount > 0) && duplicateIsExact;
  return {
    fileIngestion: filesVerified ? "VERIFIED" : "EVIDENCE_INCOMPLETE",
    projectIdentity: "VERIFIED",
    projectConfiguration: "EVIDENCE_INCOMPLETE",
    feedstockEligibility: "EVIDENCE_INCOMPLETE",
    actualBatchMassBalance: "NOT_ASSESSABLE",
    laboratoryQualityAndStability: "NOT_ASSESSABLE",
    actualCarbonRemovalQuantity: "NOT_ASSESSABLE",
    transportChainOfCustodyAndApplication: "NOT_ASSESSABLE",
    permitAndLegalStatus: "NEEDS_HUMAN_REVIEW",
    certificationAndRegistryValidity: "NEEDS_HUMAN_REVIEW",
    dryMatterMethodAndElectricityFactor: "NEEDS_HUMAN_REVIEW",
    documentControlConflicts: conflicts.length === 0 ? "ASSESSABLE" : "NEEDS_HUMAN_REVIEW",
    auditReady: false,
  };
}

export function getSonnenerdeDemonstration(options = {}) {
  const evidenceRoot = options.evidenceRoot || EVIDENCE_ROOT;
  const safeRoot = path.resolve(evidenceRoot);
  const unavailableDocuments = [];

  for (const document of documents) {
    const filePath = path.resolve(safeRoot, document.fileName);
    if (path.dirname(filePath) !== safeRoot || !fs.existsSync(filePath)) {
      unavailableDocuments.push(document.fileName);
      continue;
    }
    if (sha256(filePath) !== document.sha256) unavailableDocuments.push(document.fileName);
  }

  if (unavailableDocuments.length > 0) {
    return {
      availability: "EVIDENCE_UNAVAILABLE",
      label: "CONTROLLED LOCAL DOCUMENT DEMONSTRATION",
      message: "External local evidence is unavailable or failed integrity verification. No project fields, forecasts, or assessment are loaded.",
      unavailableDocuments,
    };
  }

  return {
    availability: "AVAILABLE",
    label: "CONTROLLED LOCAL DOCUMENT DEMONSTRATION",
    message: "Read-only source-grounded demonstration. Forecasts are not actual production or carbon-removal results.",
    documents: documents.map((document) => ({ ...document, readable: true })),
    projectFields: fields,
    forecastFields: forecasts,
    evidenceGaps,
    conflicts,
    evidenceAvailability,
    assessment: buildAssessment(),
  };
}
