import type {
  BatchForm,
  ChecklistItem,
  ControlledDemonstrationAssessment,
  ControlledDemonstrationAvailability,
  ControlledStatus,
  BiocharControlledStatus,
  DemonstrationDocument,
  DecisionSignals,
  EudrDecisionSignals,
  EudrControlledStatus,
  EvidenceRecord,
  GeminiExtraction,
  ReviewerRecommendation,
  ReviewerRecommendationType,
} from "../types";

const requiredBiocharChecklist: Array<{
  id: keyof BatchForm;
  section: string;
  label: string;
}> = [
  { id: "projectName", section: "Project identity", label: "Project name" },
  { id: "batchId", section: "Project identity", label: "Batch ID" },
  { id: "producerIdentity", section: "Project identity", label: "Producer identity" },
  { id: "commodity", section: "Project identity", label: "Commodity/biomass" },

  { id: "country", section: "Geolocation", label: "Country" },
  { id: "region", section: "Geolocation", label: "Region" },
  { id: "plotPoint", section: "Geolocation", label: "Plot GPS point or polygon" },
  { id: "latitude", section: "Geolocation", label: "Latitude" },
  { id: "longitude", section: "Geolocation", label: "Longitude" },

  { id: "feedstockType", section: "Feedstock evidence", label: "Feedstock type" },
  { id: "sourceLocation", section: "Feedstock evidence", label: "Feedstock source location" },
  { id: "supplierName", section: "Feedstock evidence", label: "Supplier identity" },
  { id: "biomassOrigin", section: "Feedstock evidence", label: "Biomass origin" },
  { id: "contaminationRisk", section: "Feedstock evidence", label: "Contamination risk" },
  { id: "sustainabilityConcern", section: "Feedstock evidence", label: "Sustainability concern" },

  { id: "pyrolysisDate", section: "Production evidence", label: "Pyrolysis date" },
  { id: "technologyType", section: "Production evidence", label: "Production technology" },
  { id: "temperatureRange", section: "Production evidence", label: "Temperature range" },
  { id: "batchQuantity", section: "Production evidence", label: "Production quantity" },
  { id: "energyUse", section: "Production evidence", label: "Energy use (if available)" },

  { id: "labReportAvailable", section: "Biochar quality", label: "Lab report availability" },
  { id: "carbonContent", section: "Biochar quality", label: "Carbon content" },
  { id: "moisture", section: "Biochar quality", label: "Moisture" },
  { id: "ashContent", section: "Biochar quality", label: "Ash content" },
  { id: "hcRatio", section: "Biochar quality", label: "H:Corg ratio" },
  { id: "stabilityEvidence", section: "Biochar quality", label: "Stability evidence" },

  { id: "applicationLocation", section: "Application evidence", label: "Application location" },
  { id: "applicationDate", section: "Application evidence", label: "Application date" },
  { id: "applicationQuantity", section: "Application evidence", label: "Quantity applied" },
  { id: "cropOrLandType", section: "Application evidence", label: "Crop or land type" },
  { id: "responsiblePerson", section: "Application evidence", label: "Responsible person" },

  {
    id: "permanenceClass",
    section: "Storage and permanence",
    label: "Permanence class",
  },
  {
    id: "monitoringPlan",
    section: "Storage and permanence",
    label: "Monitoring plan",
  },
  { id: "reversalRisk", section: "Storage and permanence", label: "Reversal risk" },
  { id: "leakageRisk", section: "Storage and permanence", label: "Leakage risk" },
  { id: "doubleCountingRisk", section: "Storage and permanence", label: "Double-counting risk" },
];

const requiredEudrChecklist: Array<{
  id: string;
  section: string;
  label: string;
  valueSelector: (record: BatchForm) => string;
}> = [
  { id: "eudr-geolocation", section: "EUDR geolocation", label: "Production plot geolocation", valueSelector: deriveGeoValue },
  { id: "eudr-country", section: "EUDR geolocation", label: "Country and region", valueSelector: (record) => `${record.country} ${record.region}`.trim() },
  { id: "eudr-commodity", section: "EUDR commodity", label: "Commodity / biomass source", valueSelector: (record) => firstFilled([record.eudrCommodityBiomassSource, record.commodity]) },
  { id: "eudr-producer", section: "EUDR producers", label: "Supplier/farmer/producer identity", valueSelector: (record) => firstFilled([record.eudrSupplierFarmerProducerIdentity, record.supplierName, record.producerIdentity]) },
  { id: "eudr-period", section: "EUDR production", label: "Production date or period", valueSelector: (record) => firstFilled([record.eudrProductionPeriod, record.productionDate]) },
  { id: "eudr-no-deforestation", section: "EUDR evidence", label: "Evidence of no deforestation after 31 Dec 2020", valueSelector: (record) => record.eudrNoDeforestationEvidence },
  { id: "eudr-legality", section: "EUDR legality", label: "Legality evidence", valueSelector: (record) => record.eudrLegalityEvidence },
  { id: "eudr-landuse", section: "EUDR evidence", label: "Land-use history evidence", valueSelector: (record) => record.eudrLandUseHistoryEvidence },
  { id: "eudr-satellite", section: "EUDR evidence", label: "Satellite or map evidence", valueSelector: (record) => record.eudrSatelliteMapEvidence },
];

export function hasMeaningfulText(value: string | undefined): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length < 2) return false;
  const placeholderWords = [
    "n/a", "na", "null", "undefined", "unknown", "simulated", 
    "fallback", "default", "tbd", "to be determined", "none", 
    "nil", "test placeholder", "placeholder", "dummy"
  ];
  if (placeholderWords.includes(trimmed)) {
    return false;
  }
  return true;
}

function firstFilled(values: Array<string | undefined>): string {
  for (const value of values) {
    if (hasMeaningfulText(value)) {
      return value!.trim();
    }
  }
  return "";
}

export function deriveGeoValue(record: BatchForm): string {
  const plot = firstFilled([
    record.eudrPolygonGeometry,
    record.plotPoint,
    record.eudrProductionPlotGeolocation,
  ]);
  if (hasMeaningfulText(plot)) {
    return plot;
  }

  const lat = firstFilled([record.eudrLatitude, record.latitude]);
  const lon = firstFilled([record.eudrLongitude, record.longitude]);
  if (hasMeaningfulText(lat) && hasMeaningfulText(lon)) {
    return `${lat}, ${lon}`;
  }

  return "";
}

export function computeDeterministicHash(str: string): string {
  let h1 = 0xdeadbeef | 0;
  let h2 = 0x41c6ce57 | 0;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const part1 = (h1 >>> 0).toString(16).padStart(8, "0");
  const part2 = (h2 >>> 0).toString(16).padStart(8, "0");
  return `hash-${part1}${part2}${part1}${part2}`;
}

export function createEmptyBatch(): BatchForm {
  const now = new Date().toISOString().slice(0, 10);
  return {
    id: `batch-${Math.random().toString(36).slice(2, 11)}`,
    projectName: "",
    batchId: "",
    commodity: "",
    producerIdentity: "",
    supplierName: "",

    country: "",
    region: "",
    plotPoint: "",
    latitude: "",
    longitude: "",
    productionDate: now,

    feedstockType: "",
    sourceLocation: "",
    biomassOrigin: "",
    contaminationRisk: "",
    sustainabilityConcern: "",

    pyrolysisDate: "",
    technologyType: "",
    temperatureRange: "",
    batchQuantity: "",
    energyUse: "",

    labReportAvailable: "",
    carbonContent: "",
    moisture: "",
    ashContent: "",
    hcRatio: "",
    stabilityEvidence: "",
    contaminationIndicators: "",

    applicationLocation: "",
    applicationDate: "",
    applicationQuantity: "",
    cropOrLandType: "",
    responsiblePerson: "",
    geotagPhotoEvidence: "",

    eudrProductionPlotGeolocation: "",
    eudrProductionPeriod: "",
    eudrCommodityBiomassSource: "",
    eudrSupplierFarmerProducerIdentity: "",
    eudrNoDeforestationEvidence: "",
    eudrLegalityEvidence: "",
    eudrLandUseHistoryEvidence: "",
    eudrSatelliteMapEvidence: "",
    eudrRiskStatus: "",

    eudrLatitude: "",
    eudrLongitude: "",
    eudrPolygonGeometry: "",
    eudrCrs: "WGS84",
    eudrCoordinateSource: "",
    eudrCaptureDate: "",
    eudrLinkedPlotRecord: "",

    permanenceClass: "",
    monitoringPlan: "",
    reversalRisk: "",
    leakageRisk: "",
    doubleCountingRisk: "",

    notes: "",
  };
}

export function buildBiocharChecklist(record: BatchForm) {
  const items: ChecklistItem[] = requiredBiocharChecklist.map((entry) => {
    const value = String(record[entry.id] ?? "");
    return {
      id: entry.id,
      section: entry.section,
      label: entry.label,
      value,
      required: true,
      status: hasMeaningfulText(value) ? "complete" : "missing",
    };
  });

  const missing = items.filter((item) => item.status === "missing");

  return {
    items,
    completed: items.length - missing.length,
    total: items.length,
    missing,
  };
}

export function buildEudrChecklist(record: BatchForm) {
  const items: ChecklistItem[] = requiredEudrChecklist.map((entry) => {
    const value = entry.valueSelector(record);
    return {
      id: entry.id,
      section: entry.section,
      label: entry.label,
      value,
      required: true,
      status: hasMeaningfulText(value) ? "complete" : "missing",
    };
  });

  const missing = items.filter((item) => item.status === "missing");

  return {
    items,
    completed: items.length - missing.length,
    total: items.length,
    missing,
  };
}

export function applyExtractionToBatch(batch: BatchForm, extraction: GeminiExtraction): BatchForm {
  const next = { ...batch } as BatchForm;

  next.feedstockType = firstFilled([
    next.feedstockType,
    extraction.feedstockEvidence?.feedstockType,
  ]);
  next.sourceLocation = firstFilled([
    next.sourceLocation,
    extraction.feedstockEvidence?.sourceLocation,
  ]);
  next.supplierName = firstFilled([next.supplierName, extraction.feedstockEvidence?.supplierName]);
  next.biomassOrigin = firstFilled([
    next.biomassOrigin,
    extraction.feedstockEvidence?.biomassOrigin,
  ]);
  next.contaminationRisk = firstFilled([
    next.contaminationRisk,
    extraction.feedstockEvidence?.contaminationRisk,
  ]);
  next.sustainabilityConcern = firstFilled([
    next.sustainabilityConcern,
    extraction.feedstockEvidence?.sustainabilityConcern,
  ]);

  next.pyrolysisDate = firstFilled([
    next.pyrolysisDate,
    extraction.productionEvidence?.pyrolysisDate,
  ]);
  next.technologyType = firstFilled([
    next.technologyType,
    extraction.productionEvidence?.technologyType,
  ]);
  next.temperatureRange = firstFilled([
    next.temperatureRange,
    extraction.productionEvidence?.temperatureRange,
  ]);
  next.batchId = firstFilled([next.batchId, extraction.productionEvidence?.batchId]);
  next.batchQuantity = firstFilled([
    next.batchQuantity,
    extraction.productionEvidence?.batchQuantity,
  ]);
  next.energyUse = firstFilled([next.energyUse, extraction.productionEvidence?.energyUse]);
  next.producerIdentity = firstFilled([
    next.producerIdentity,
    extraction.productionEvidence?.producerIdentity,
  ]);

  next.labReportAvailable = firstFilled([
    next.labReportAvailable,
    extraction.qualityEvidence?.labReportAvailable,
  ]);
  next.carbonContent = firstFilled([
    next.carbonContent,
    extraction.qualityEvidence?.carbonContent,
  ]);
  next.moisture = firstFilled([next.moisture, extraction.qualityEvidence?.moisture]);
  next.ashContent = firstFilled([next.ashContent, extraction.qualityEvidence?.ashContent]);
  next.hcRatio = firstFilled([next.hcRatio, extraction.qualityEvidence?.hcRatio]);
  next.stabilityEvidence = firstFilled([
    next.stabilityEvidence,
    extraction.qualityEvidence?.stabilityEvidence,
  ]);
  next.contaminationIndicators = firstFilled([
    next.contaminationIndicators,
    extraction.qualityEvidence?.contaminationIndicators,
  ]);

  next.applicationLocation = firstFilled([
    next.applicationLocation,
    extraction.applicationEvidence?.applicationLocation,
  ]);
  next.applicationDate = firstFilled([
    next.applicationDate,
    extraction.applicationEvidence?.applicationDate,
  ]);
  next.applicationQuantity = firstFilled([
    next.applicationQuantity,
    extraction.applicationEvidence?.applicationQuantity,
  ]);
  next.cropOrLandType = firstFilled([
    next.cropOrLandType,
    extraction.applicationEvidence?.cropOrLandType,
  ]);
  next.responsiblePerson = firstFilled([
    next.responsiblePerson,
    extraction.applicationEvidence?.responsiblePerson,
  ]);
  next.geotagPhotoEvidence = firstFilled([
    next.geotagPhotoEvidence,
    extraction.applicationEvidence?.geotagPhotoEvidence,
  ]);

  next.permanenceClass = firstFilled([
    next.permanenceClass,
    extraction.storageEvidence?.permanenceClass,
  ]);
  next.monitoringPlan = firstFilled([
    next.monitoringPlan,
    extraction.storageEvidence?.monitoringPlan,
  ]);
  next.reversalRisk = firstFilled([next.reversalRisk, extraction.storageEvidence?.reversalRisk]);
  next.leakageRisk = firstFilled([next.leakageRisk, extraction.storageEvidence?.leakageRisk]);
  next.doubleCountingRisk = firstFilled([
    next.doubleCountingRisk,
    extraction.storageEvidence?.doubleCountingRisk,
  ]);

  next.eudrProductionPlotGeolocation = firstFilled([
    next.eudrProductionPlotGeolocation,
    extraction.eudrEvidence?.productionPlotGeolocation,
  ]);
  next.eudrProductionPeriod = firstFilled([
    next.eudrProductionPeriod,
    extraction.eudrEvidence?.productionPeriod,
    extraction.productionEvidence?.pyrolysisDate,
    next.productionDate,
  ]);
  next.eudrCommodityBiomassSource = firstFilled([
    next.eudrCommodityBiomassSource,
    extraction.eudrEvidence?.commodityOrBiomassSource,
    next.commodity,
  ]);
  next.eudrSupplierFarmerProducerIdentity = firstFilled([
    next.eudrSupplierFarmerProducerIdentity,
    extraction.eudrEvidence?.supplierFarmerProducerIdentity,
    next.supplierName,
    next.producerIdentity,
  ]);
  next.eudrNoDeforestationEvidence = firstFilled([
    next.eudrNoDeforestationEvidence,
    extraction.eudrEvidence?.noDeforestationEvidence,
  ]);
  next.eudrLegalityEvidence = firstFilled([
    next.eudrLegalityEvidence,
    extraction.eudrEvidence?.legalityEvidence,
  ]);
  next.eudrLandUseHistoryEvidence = firstFilled([
    next.eudrLandUseHistoryEvidence,
    extraction.eudrEvidence?.landUseHistoryEvidence,
  ]);
  next.eudrSatelliteMapEvidence = firstFilled([
    next.eudrSatelliteMapEvidence,
    extraction.eudrEvidence?.satelliteMapEvidence,
  ]);
  next.eudrRiskStatus = firstFilled([next.eudrRiskStatus, extraction.eudrEvidence?.riskStatus]);

  next.eudrLatitude = firstFilled([next.eudrLatitude, extraction.eudrEvidence?.latitude, next.latitude]);
  next.eudrLongitude = firstFilled([next.eudrLongitude, extraction.eudrEvidence?.longitude, next.longitude]);
  next.eudrPolygonGeometry = firstFilled([next.eudrPolygonGeometry, extraction.eudrEvidence?.polygonGeometry]);
  next.eudrCrs = firstFilled([next.eudrCrs, extraction.eudrEvidence?.crs, "WGS84"]);
  next.eudrCoordinateSource = firstFilled([next.eudrCoordinateSource, extraction.eudrEvidence?.coordinateSource]);
  next.eudrCaptureDate = firstFilled([next.eudrCaptureDate, extraction.eudrEvidence?.captureDate]);
  next.eudrLinkedPlotRecord = firstFilled([next.eudrLinkedPlotRecord, extraction.eudrEvidence?.linkedPlotRecord, next.plotPoint]);

  return next;
}

export function generateReviewerRecommendations(
  batch: BatchForm,
  biocharStatus: BiocharControlledStatus,
  eudrStatus: EudrControlledStatus,
  biocharSignals: DecisionSignals,
  eudrSignals: EudrDecisionSignals,
  evidence: EvidenceRecord[]
): ReviewerRecommendation[] {
  const recs: ReviewerRecommendation[] = [];
  const allRiskFlags = [...(biocharSignals.riskFlags || []), ...(eudrSignals.riskFlags || [])];

  if (
    eudrStatus === "LEGALITY_EVIDENCE_MISSING" ||
    eudrSignals.missingLegalityEvidence ||
    !hasMeaningfulText(batch.eudrLegalityEvidence) ||
    allRiskFlags.some((f) => /legal|permit|law|tenure|illegal|right of use/i.test(f))
  ) {
    recs.push({
      type: "LEGAL_REVIEW",
      reason: "Legality evidence is missing or flagged for EUDR due diligence support.",
      track: "EUDR",
      priority: "HIGH",
    });
  }

  if (
    eudrStatus === "GEOLOCATION_MISSING" ||
    eudrStatus === "DEFORESTATION_RISK_REVIEW_REQUIRED" ||
    eudrSignals.missingGeolocation ||
    eudrSignals.missingSatelliteEvidence ||
    !hasMeaningfulText(deriveGeoValue(batch)) ||
    !hasMeaningfulText(batch.eudrSatelliteMapEvidence)
  ) {
    recs.push({
      type: "GIS_REVIEW",
      reason: "Structured geolocation, polygon geometry, or satellite deforestation analysis requires GIS verification.",
      track: "EUDR",
      priority: "HIGH",
    });
  }

  if (
    !hasMeaningfulText(batch.feedstockType) ||
    !hasMeaningfulText(batch.sourceLocation) ||
    !hasMeaningfulText(batch.supplierName) ||
    !hasMeaningfulText(batch.biomassOrigin) ||
    hasMeaningfulText(batch.contaminationRisk) ||
    hasMeaningfulText(batch.sustainabilityConcern) ||
    allRiskFlags.some((f) => /feedstock|supplier|sustainability|biomass|source/i.test(f))
  ) {
    recs.push({
      type: "SOURCING_REVIEW",
      reason: "Feedstock sourcing chain of custody or biomass sustainability indicators require sourcing review.",
      track: "BOTH",
      priority: "MEDIUM",
    });
  }

  if (
    !hasMeaningfulText(batch.labReportAvailable) ||
    !hasMeaningfulText(batch.carbonContent) ||
    !hasMeaningfulText(batch.moisture) ||
    !hasMeaningfulText(batch.ashContent) ||
    !hasMeaningfulText(batch.hcRatio) ||
    !hasMeaningfulText(batch.stabilityEvidence) ||
    hasMeaningfulText(batch.contaminationIndicators) ||
    allRiskFlags.some((f) => /lab|carbon|moisture|ash|ratio|contamination|chemical/i.test(f))
  ) {
    recs.push({
      type: "LABORATORY_REVIEW",
      reason: "Biochar laboratory test reports or chemical quality parameters require laboratory analysis review.",
      track: "BIOCHAR",
      priority: "HIGH",
    });
  }

  if (
    biocharStatus === "EVIDENCE_INCOMPLETE" ||
    biocharStatus === "NOT_ASSESSABLE" ||
    !hasMeaningfulText(batch.pyrolysisDate) ||
    !hasMeaningfulText(batch.temperatureRange) ||
    !hasMeaningfulText(batch.batchQuantity) ||
    !hasMeaningfulText(batch.permanenceClass) ||
    !hasMeaningfulText(batch.monitoringPlan) ||
    hasMeaningfulText(batch.reversalRisk) ||
    hasMeaningfulText(batch.leakageRisk) ||
    hasMeaningfulText(batch.doubleCountingRisk) ||
    allRiskFlags.some((f) => /permanence|leakage|reversal|double-counting|mrv/i.test(f))
  ) {
    recs.push({
      type: "BIOCHAR_MRV_REVIEW",
      reason: "Carbon quantification, permanence classification, or leakage monitoring plans require dMRV technical review.",
      track: "BIOCHAR",
      priority: "HIGH",
    });
  }

  if (
    biocharStatus === "NEEDS_HUMAN_REVIEW" ||
    eudrStatus === "NEEDS_HUMAN_REVIEW" ||
    biocharSignals.needsHumanReview ||
    eudrSignals.needsHumanReview ||
    allRiskFlags.length > 0 ||
    evidence.some((e) => (e.lastGeminiSummary || "").toLowerCase().includes("conflict") || (e.lastGeminiSummary || "").toLowerCase().includes("unsupported"))
  ) {
    recs.push({
      type: "HUMAN_PROJECT_REVIEW",
      reason: "Unresolved AI risk flags, conflicting evidence, or general project complexity requires human project oversight.",
      track: "BOTH",
      priority: "HIGH",
    });
  }

  return recs;
}
