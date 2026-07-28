import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const VERRA_BINDING = Object.freeze({ standard: "VERRA", methodologyId: "VM0044", methodologyVersion: "1.2", status: "ACTIVE", effectiveDate: "2025-06-27" });
const PARC_NOTICE = "GOLD STANDARD PARC: UNDER DEVELOPMENT - NOT A CURRENT CERTIFICATION OR CREDITING PATHWAY.";
const PARC_TRACKS = new Set(["DISTRIBUTED", "MECHANIZED_TRANSITION", "INDUSTRIAL_PRECISION"]);
const ALLOWED_MEDIA_TYPES = new Set(["application/pdf", "text/plain", "image/jpeg", "image/png"]);
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const PACKAGE_NOTICE = "Evidence package complete for independent review. Not a verification, certification, credit decision, or registry submission.";

const DOMAIN_RULES = Object.freeze({
  "VM0044-01": "Methodology and facility binding", "VM0044-02": "Greenfield-facility evidence", "VM0044-03": "Eligible waste-biomass evidence", "VM0044-04": "Feedstock prior-fate and sustainability evidence", "VM0044-05": "Additionality and baseline evidence references", "VM0044-06": "Production technology classification", "VM0044-07": "Biochar quality and laboratory evidence", "VM0044-08": "Measurement and calibration evidence", "VM0044-09": "Batch-level mass and inventory reconciliation", "VM0044-10": "Transport and chain of custody", "VM0044-11": "Final eligible end-use evidence", "VM0044-12": "Geolocation and double-counting prevention evidence", "VM0044-13": "Monitoring Plan completeness", "VM0044-14": "QA/QC and secure record-retention evidence", "VM0044-15": "Independent-review package readiness",
});

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function hashJson(value) { return sha256(JSON.stringify(value)); }
function fail(message) { throw new Error(message); }
function isPlainObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function strictObject(value, keys, name) {
  if (!isPlainObject(value)) fail(`${name} must be an object.`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`${name} contains unknown field: ${key}.`);
  return value;
}
function text(value, name) { if (typeof value !== "string" || !value.trim()) fail(`${name} must be a non-empty string.`); return value.trim(); }
function optionalText(value, name) { return value === undefined ? undefined : text(value, name); }
function projectId(value) { const id = text(value, "projectId"); if (!/^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/.test(id)) fail("projectId has an invalid format."); return id; }
function ids(value, name) { if (!Array.isArray(value) || value.some((id) => typeof id !== "string" || !id.trim())) fail(`${name} must be an array of non-empty IDs.`); return [...new Set(value.map((id) => id.trim()))]; }
function pick(value, allowed, name) { if (!allowed.includes(value)) fail(`${name} has an invalid value.`); return value; }
function date(value, name) { const result = text(value, name); if (!Number.isFinite(Date.parse(result))) fail(`${name} must be an ISO-compatible date.`); return result; }
function mass(value, name) { const result = text(value, name); if (!/^\d+(?:\.\d+)?$/.test(result)) fail(`${name} must be a non-negative decimal string.`); return Number(result); }
function stableIds(values) { return [...new Set(values.flatMap((value) => Array.isArray(value) ? value : []))].sort(); }
function safeFileName(value) { const fileName = text(value, "fileName"); if (fileName !== path.basename(fileName) || fileName.includes("..") || /[\\/]/.test(fileName)) fail("fileName must not contain a path."); return fileName; }
function decodeBase64(value) { const source = text(value, "contentBase64"); if (!/^[A-Za-z0-9+/]+={0,2}$/.test(source) || source.length % 4 !== 0) fail("contentBase64 is invalid."); const bytes = Buffer.from(source, "base64"); if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES) fail("Document content is empty or exceeds the size limit."); return bytes; }
function contentMatchesMediaType(bytes, mediaType) {
  if (mediaType === "application/pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mediaType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mediaType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return !bytes.includes(0);
}
function publicDocument(record) { return { evidenceId: record.evidenceId, evidenceClass: record.evidenceClass, projectId: record.projectId, sourceOrigin: record.sourceOrigin, sourcePageOrSection: record.sourcePageOrSection, fileName: record.fileName, mediaType: record.mediaType, contentHash: record.contentHash, capturedAt: record.capturedAt, revisionHistory: [] }; }
function publicAssertion(record) { return { evidenceId: record.assertionId, evidenceClass: record.evidenceClass, projectId: record.projectId, sourceOrigin: record.sourceOrigin, sourcePageOrSection: record.sourcePageOrSection, capturedAt: record.capturedAt, revisionHistory: [] }; }

function validateBinding(value) {
  const binding = strictObject(value, ["standard", "selectedTrack", "sourceDocumentReference"], "methodologyBinding");
  const standard = pick(binding.standard, ["VERRA", "GOLD_STANDARD"], "methodologyBinding.standard");
  if (binding.selectedTrack !== undefined && !PARC_TRACKS.has(binding.selectedTrack)) fail("methodologyBinding.selectedTrack has an invalid value.");
  return { standard, selectedTrack: binding.selectedTrack, sourceDocumentReference: text(binding.sourceDocumentReference, "methodologyBinding.sourceDocumentReference") };
}
function normalizeBinding(binding) { return binding.standard === "GOLD_STANDARD" ? { standard: "GOLD_STANDARD", methodologyId: "PARC", methodologyVersion: "DRAFT", status: "DRAFT", selectedTrack: binding.selectedTrack, effectiveDate: "2026-04-22", sourceDocumentReference: binding.sourceDocumentReference } : { ...VERRA_BINDING, sourceDocumentReference: binding.sourceDocumentReference }; }
function validateRecord(value, keys, required, idFields, name) { const record = strictObject(value, keys, name); for (const field of required) text(record[field], `${name}.${field}`); for (const field of idFields) ids(record[field], `${name}.${field}`); return record; }
function validatePreflightRequest(input) {
  const request = strictObject(input, ["projectId", "methodologyBinding", "monitoringRoute", "facilityProfile", "feedstockLots", "productionBatches", "measurementAndCalibrationRecords", "laboratorySamples", "transferAndInventoryEvents", "endUseInstances"], "methodology pre-flight request");
  const facility = validateRecord(request.facilityProfile, ["facilityId", "operator", "facilityIdentity", "location", "technologyClassification", "monitoringPlanVersion", "facilityEvidenceIds", "operatingPermitEvidenceIds", "healthAndSafetyEvidenceIds", "greenfieldEvidenceIds", "additionalityBaselineEvidenceIds", "monitoringPlanEvidenceIds", "recordRetentionEvidenceIds"], ["facilityId", "operator", "facilityIdentity", "location", "technologyClassification", "monitoringPlanVersion"], ["facilityEvidenceIds", "operatingPermitEvidenceIds", "healthAndSafetyEvidenceIds", "greenfieldEvidenceIds", "additionalityBaselineEvidenceIds", "monitoringPlanEvidenceIds", "recordRetentionEvidenceIds"], "facilityProfile");
  const list = (value, name, parser) => { if (!Array.isArray(value)) fail(`${name} must be an array.`); return value.map((entry, index) => parser(entry, `${name}[${index}]`)); };
  const lots = list(request.feedstockLots, "feedstockLots", (entry, name) => { const record = validateRecord(entry, ["lotId", "supplier", "sourceLocation", "biomassClass", "isWasteBiomass", "wetMass", "dryMass", "priorFateEvidenceIds", "sustainabilityAndLandRightsEvidenceIds", "moistureEvidenceIds", "chainOfCustodyEvidenceIds", "sourceEvidenceIds"], ["lotId", "supplier", "sourceLocation", "biomassClass", "wetMass", "dryMass"], ["priorFateEvidenceIds", "sustainabilityAndLandRightsEvidenceIds", "moistureEvidenceIds", "chainOfCustodyEvidenceIds", "sourceEvidenceIds"], name); if (typeof record.isWasteBiomass !== "boolean") fail(`${name}.isWasteBiomass must be boolean.`); mass(record.wetMass, `${name}.wetMass`); mass(record.dryMass, `${name}.dryMass`); return record; });
  const batches = list(request.productionBatches, "productionBatches", (entry, name) => { const record = validateRecord(entry, ["batchId", "reactorOrFacilityId", "batchStart", "batchEnd", "feedstockLotIds", "wetInputMass", "dryInputMass", "biocharWetOutputMass", "biocharDryOutputMass", "processObservationEvidenceIds", "productionTechnologyRoute", "massBalanceReconciliationEvidenceIds", "sourceEvidenceIds"], ["batchId", "reactorOrFacilityId", "batchStart", "batchEnd", "wetInputMass", "dryInputMass", "biocharWetOutputMass", "biocharDryOutputMass", "productionTechnologyRoute"], ["feedstockLotIds", "processObservationEvidenceIds", "massBalanceReconciliationEvidenceIds", "sourceEvidenceIds"], name); date(record.batchStart, `${name}.batchStart`); date(record.batchEnd, `${name}.batchEnd`); if (Date.parse(record.batchEnd) < Date.parse(record.batchStart)) fail(`${name} ends before it starts.`); for (const field of ["wetInputMass", "dryInputMass", "biocharWetOutputMass", "biocharDryOutputMass"]) mass(record[field], `${name}.${field}`); return record; });  const calibrations = list(request.measurementAndCalibrationRecords, "measurementAndCalibrationRecords", (entry, name) => { const record = validateRecord(entry, ["recordId", "deviceIdentity", "measuredParameter", "timestamp", "calibrationCertificateEvidenceIds", "calibrationValidFrom", "calibrationValidTo", "responsibleParty", "rawRecordHash", "sourceEvidenceIds"], ["recordId", "deviceIdentity", "measuredParameter", "timestamp", "calibrationValidFrom", "calibrationValidTo", "responsibleParty", "rawRecordHash"], ["calibrationCertificateEvidenceIds", "sourceEvidenceIds"], name); for (const field of ["timestamp", "calibrationValidFrom", "calibrationValidTo"]) date(record[field], `${name}.${field}`); if (Date.parse(record.calibrationValidFrom) > Date.parse(record.calibrationValidTo)) fail(`${name} has an invalid calibration interval.`); return record; });
  const samples = list(request.laboratorySamples, "laboratorySamples", (entry, name) => validateRecord(entry, ["sampleId", "custodyChainEvidenceIds", "productionBatchIds", "samplingProcedureEvidenceIds", "laboratoryIdentity", "laboratoryAccreditationEvidenceIds", "rawResultsEvidenceIds", "qaStatus", "resultProvenanceEvidenceIds"], ["sampleId", "laboratoryIdentity", "qaStatus"], ["custodyChainEvidenceIds", "productionBatchIds", "samplingProcedureEvidenceIds", "laboratoryAccreditationEvidenceIds", "rawResultsEvidenceIds", "resultProvenanceEvidenceIds"], name));
  const transfers = list(request.transferAndInventoryEvents, "transferAndInventoryEvents", (entry, name) => { const record = validateRecord(entry, ["eventId", "sourceBatchId", "quantity", "custodyHandoffEvidenceIds", "transportEvidenceIds", "lossEventEvidenceIds", "destination", "sourceEvidenceIds"], ["eventId", "sourceBatchId", "quantity", "destination"], ["custodyHandoffEvidenceIds", "transportEvidenceIds", "lossEventEvidenceIds", "sourceEvidenceIds"], name); mass(record.quantity, `${name}.quantity`); return record; });
  const endUses = list(request.endUseInstances, "endUseInstances", (entry, name) => { const record = validateRecord(entry, ["endUseId", "usePathway", "batchIds", "quantity", "applicationOrDeliveryDate", "geolocation", "recipientOrAccountableEndUser", "finalNonCombustionUseEvidenceIds", "pathwaySpecificEvidenceIds"], ["endUseId", "usePathway", "quantity", "applicationOrDeliveryDate", "geolocation", "recipientOrAccountableEndUser"], ["batchIds", "finalNonCombustionUseEvidenceIds", "pathwaySpecificEvidenceIds"], name); pick(record.usePathway, ["SOIL", "NON_SOIL", "OTHER"], `${name}.usePathway`); date(record.applicationOrDeliveryDate, `${name}.applicationOrDeliveryDate`); mass(record.quantity, `${name}.quantity`); return record; });
  return { projectId: projectId(request.projectId), methodologyBinding: validateBinding(request.methodologyBinding), monitoringRoute: pick(request.monitoringRoute, ["HIGH_TECH_MONITORED", "LOW_TECH_WITH_MEASURED_DATA", "LOW_TECH_CONSERVATIVE_ROUTE", "NOT_ASSESSABLE"], "monitoringRoute"), facilityProfile: facility, feedstockLots: lots, productionBatches: batches, measurementAndCalibrationRecords: calibrations, laboratorySamples: samples, transferAndInventoryEvents: transfers, endUseInstances: endUses };
}

export function createMethodologyPreflightController({ evidenceDirectory = path.resolve(process.cwd(), "server", "data", "methodology-evidence"), persistDocuments = true, allowReviewerAdmission = false } = {}) {
  const documents = new Map(); const assertions = new Map(); const assessments = new Map(); const auditEvents = []; let previousAuditHash = "GENESIS";
  const safeStoragePath = (caseId, evidenceId) => { const root = path.resolve(evidenceDirectory); const target = path.resolve(root, caseId, `${evidenceId}.bin`); if (!target.startsWith(root + path.sep)) fail("Evidence storage path rejected."); return target; };
  function captureDocument(input) {
    const value = strictObject(input, ["projectId", "sourceOrigin", "sourcePageOrSection", "fileName", "mediaType", "contentBase64"], "document capture"); const caseId = projectId(value.projectId); const mediaType = pick(value.mediaType, [...ALLOWED_MEDIA_TYPES], "mediaType"); const bytes = decodeBase64(value.contentBase64); if (!contentMatchesMediaType(bytes, mediaType)) fail("Document bytes do not match the declared mediaType."); const evidenceId = `mdoc-${randomUUID()}`;
    const record = { evidenceId, evidenceClass: "DOCUMENT_CAPTURED", projectId: caseId, sourceOrigin: text(value.sourceOrigin, "sourceOrigin"), sourcePageOrSection: optionalText(value.sourcePageOrSection, "sourcePageOrSection"), fileName: safeFileName(value.fileName), mediaType, contentHash: sha256(bytes), capturedAt: new Date().toISOString(), revisionHistory: [] };
    if (persistDocuments) { const target = safeStoragePath(caseId, evidenceId); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes, { flag: "wx" }); }
    documents.set(evidenceId, record); return publicDocument(record);
  }
  function registerUserAssertion(input) {
    const value = strictObject(input, ["projectId", "sourceOrigin", "text"], "user assertion"); const record = { assertionId: `mua-${randomUUID()}`, evidenceClass: "USER_ASSERTION", projectId: projectId(value.projectId), sourceOrigin: text(value.sourceOrigin, "sourceOrigin"), text: text(value.text, "text"), capturedAt: new Date().toISOString(), revisionHistory: [] };
    assertions.set(record.assertionId, record); return publicAssertion(record);
  }
  // Intentionally server-only: no HTTP route invokes extraction or reviewer admission.
  function createSourceLinkedAssertion(input) {
    const value = strictObject(input, ["projectId", "documentEvidenceId", "field", "value", "sourcePageOrSection", "sourceOrigin", "conflicting"], "source-linked assertion"); const caseId = projectId(value.projectId); const document = documents.get(text(value.documentEvidenceId, "documentEvidenceId"));
    if (!document || document.projectId !== caseId || document.evidenceClass !== "DOCUMENT_CAPTURED") fail("Source-linked assertion requires a same-project captured document.");
    const record = { assertionId: `msa-${randomUUID()}`, evidenceClass: "SOURCE_LINKED", projectId: caseId, documentEvidenceId: document.evidenceId, field: text(value.field, "field"), value: text(value.value, "value"), sourcePageOrSection: text(value.sourcePageOrSection, "sourcePageOrSection"), sourceOrigin: text(value.sourceOrigin, "sourceOrigin"), conflicting: value.conflicting === true, capturedAt: new Date().toISOString(), revisionHistory: [] };
    assertions.set(record.assertionId, record); return publicAssertion(record);
  }
  function admitSourceLinkedAssertion(input) {
    if (!allowReviewerAdmission) fail("Reviewer admission is not available through this runtime controller."); const value = strictObject(input, ["assertionId", "reviewerId", "requirementId"], "reviewer admission"); const linked = assertions.get(text(value.assertionId, "assertionId"));
    if (!linked || linked.evidenceClass !== "SOURCE_LINKED") fail("Only source-linked assertions can be admitted."); const requirementId = text(value.requirementId, "requirementId"); if (!Object.hasOwn(DOMAIN_RULES, requirementId)) fail("Unknown methodology requirement.");
    const record = { ...linked, assertionId: `mra-${randomUUID()}`, evidenceClass: "REVIEW_ADMITTED", reviewerId: text(value.reviewerId, "reviewerId"), admittedForRequirementId: requirementId, capturedAt: new Date().toISOString(), revisionHistory: [linked.assertionId] }; assertions.set(record.assertionId, record); return publicAssertion(record);
  }  function evidenceState(referenceIds, caseId, requirementId) {
    const values = ids(referenceIds, `${requirementId}.evidenceIds`); if (!values.length) return { ids: [], state: "MISSING", conflict: false };
    const records = values.map((id) => assertions.get(id)); if (records.some((record) => !record)) fail(`${requirementId} references an unrecognized evidence assertion ID.`); if (records.some((record) => record.projectId !== caseId)) fail(`${requirementId} references cross-project evidence.`);
    const conflict = records.some((record) => record.conflicting === true || record.evidenceClass === "REJECTED"); const admitted = records.every((record) => record.evidenceClass === "REVIEW_ADMITTED" && record.admittedForRequirementId === requirementId && documents.has(record.documentEvidenceId));
    return { ids: values, state: admitted ? "ADMITTED" : "UNVERIFIED", conflict };
  }
  function reconcile(request) {
    const tolerance = 0.000001; const transfers = new Map(); const endUses = new Map();
    for (const entry of request.transferAndInventoryEvents) transfers.set(entry.sourceBatchId, (transfers.get(entry.sourceBatchId) || 0) + mass(entry.quantity, "transfer.quantity"));
    for (const entry of request.endUseInstances) for (const batchId of entry.batchIds) endUses.set(batchId, (endUses.get(batchId) || 0) + mass(entry.quantity, "endUse.quantity"));
    return request.productionBatches.every((batch) => { const dryInput = mass(batch.dryInputMass, "batch.dryInputMass"); const dryOutput = mass(batch.biocharDryOutputMass, "batch.biocharDryOutputMass"); const transferred = transfers.get(batch.batchId) || 0; const used = endUses.get(batch.batchId) || 0; return dryInput > 0 && dryOutput > 0 && dryOutput <= dryInput && Math.abs(dryOutput - transferred) <= tolerance && Math.abs(transferred - used) <= tolerance; });
  }
  function domain(requirementId, condition, referenceLists, caseId, gateCode, notAssessable = false) {
    const evidence = evidenceState(stableIds(referenceLists), caseId, requirementId); const supported = condition && evidence.state === "ADMITTED" && !evidence.conflict;
    const status = supported ? "READY_FOR_INDEPENDENT_VERIFICATION" : evidence.conflict ? "NEEDS_HUMAN_REVIEW" : evidence.state === "UNVERIFIED" ? "EVIDENCE_UNVERIFIED" : notAssessable ? "NOT_ASSESSABLE" : "EVIDENCE_INCOMPLETE";
    return { requirementId, label: DOMAIN_RULES[requirementId], status, evidenceIds: evidence.ids, gateCodes: supported ? [] : [evidence.conflict ? "UNRESOLVED_MATERIAL_CONFLICT" : gateCode] };
  }
  function buildDomains(request, binding) {
    const f = request.facilityProfile; const lots = request.feedstockLots; const batches = request.productionBatches; const calibrations = request.measurementAndCalibrationRecords; const samples = request.laboratorySamples; const transfers = request.transferAndInventoryEvents; const endUses = request.endUseInstances; const p = request.projectId; const now = Date.now(); const result = [];
    result.push(domain("VM0044-01", Boolean(f.facilityId && f.operator && f.facilityIdentity && f.location && f.technologyClassification && binding.sourceDocumentReference), [f.facilityEvidenceIds], p, "METHODOLOGY_FACILITY_BINDING_INCOMPLETE"));
    result.push(domain("VM0044-02", true, [f.greenfieldEvidenceIds], p, "GREENFIELD_EVIDENCE_MISSING"));
    result.push(domain("VM0044-03", lots.length > 0 && lots.every((lot) => lot.isWasteBiomass === true && lot.biomassClass), lots.map((lot) => lot.sourceEvidenceIds), p, "WASTE_BIOMASS_OR_PRIOR_FATE_MISSING"));
    result.push(domain("VM0044-04", lots.length > 0 && lots.every((lot) => lot.supplier && lot.sourceLocation), lots.flatMap((lot) => [lot.priorFateEvidenceIds, lot.sustainabilityAndLandRightsEvidenceIds, lot.moistureEvidenceIds, lot.chainOfCustodyEvidenceIds]), p, "WASTE_BIOMASS_OR_PRIOR_FATE_MISSING"));
    result.push(domain("VM0044-05", true, [f.additionalityBaselineEvidenceIds], p, "ADDITIONALITY_BASELINE_REFERENCE_MISSING"));
    result.push(domain("VM0044-06", batches.length > 0 && batches.every((batch) => batch.productionTechnologyRoute), batches.flatMap((batch) => [batch.processObservationEvidenceIds, batch.sourceEvidenceIds]), p, "PRODUCTION_TECHNOLOGY_EVIDENCE_MISSING"));
    result.push(domain("VM0044-07", samples.length > 0 && samples.every((sample) => sample.productionBatchIds.length > 0 && sample.laboratoryIdentity && sample.qaStatus), samples.flatMap((sample) => [sample.custodyChainEvidenceIds, sample.samplingProcedureEvidenceIds, sample.laboratoryAccreditationEvidenceIds, sample.rawResultsEvidenceIds, sample.resultProvenanceEvidenceIds]), p, "LABORATORY_EVIDENCE_MISSING", true));
    const calibrationValid = calibrations.length > 0 && calibrations.every((record) => Date.parse(record.calibrationValidFrom) <= Date.parse(record.timestamp) && Date.parse(record.timestamp) <= Date.parse(record.calibrationValidTo) && Date.parse(record.calibrationValidTo) >= now);
    result.push(domain("VM0044-08", calibrationValid, calibrations.flatMap((record) => [record.calibrationCertificateEvidenceIds, record.sourceEvidenceIds]), p, "CALIBRATION_INVALID", true));
    result.push(domain("VM0044-09", batches.length > 0 && reconcile(request), batches.map((batch) => batch.massBalanceReconciliationEvidenceIds), p, "MASS_BALANCE_UNRECONCILED", true));
    result.push(domain("VM0044-10", batches.length > 0 && batches.every((batch) => transfers.some((transfer) => transfer.sourceBatchId === batch.batchId && transfer.destination)), transfers.flatMap((transfer) => [transfer.custodyHandoffEvidenceIds, transfer.transportEvidenceIds, transfer.lossEventEvidenceIds, transfer.sourceEvidenceIds]), p, "CHAIN_OF_CUSTODY_INCOMPLETE"));
    result.push(domain("VM0044-11", batches.length > 0 && batches.every((batch) => endUses.some((endUse) => endUse.batchIds.includes(batch.batchId) && endUse.geolocation && endUse.applicationOrDeliveryDate && endUse.recipientOrAccountableEndUser)), endUses.map((endUse) => endUse.finalNonCombustionUseEvidenceIds), p, "END_USE_EVIDENCE_MISSING"));
    result.push(domain("VM0044-12", endUses.length > 0 && endUses.every((endUse) => endUse.geolocation), endUses.map((endUse) => endUse.pathwaySpecificEvidenceIds), p, "END_USE_EVIDENCE_MISSING"));
    result.push(domain("VM0044-13", Boolean(f.monitoringPlanVersion), [f.monitoringPlanEvidenceIds], p, "MONITORING_PLAN_INCOMPLETE"));
    result.push(domain("VM0044-14", true, [f.operatingPermitEvidenceIds, f.healthAndSafetyEvidenceIds, f.recordRetentionEvidenceIds], p, "QA_QC_OR_RECORD_RETENTION_INCOMPLETE"));
    const priorReady = result.every((entry) => entry.status === "READY_FOR_INDEPENDENT_VERIFICATION"); result.push({ requirementId: "VM0044-15", label: DOMAIN_RULES["VM0044-15"], status: priorReady ? "READY_FOR_INDEPENDENT_VERIFICATION" : "EVIDENCE_INCOMPLETE", evidenceIds: stableIds(result.map((entry) => entry.evidenceIds)), gateCodes: priorReady ? [] : ["INDEPENDENT_VERIFICATION_PACKAGE_BLOCKED"] });
    return result;
  }
  function audit(assessmentRun) { const event = { eventId: `methodology-audit-${randomUUID()}`, assessmentId: assessmentRun.assessmentId, createdAt: assessmentRun.createdAt, methodologyId: assessmentRun.methodologyBinding.methodologyId, methodologyVersion: assessmentRun.methodologyBinding.methodologyVersion, status: assessmentRun.status, outputHash: assessmentRun.outputHash, prevHash: previousAuditHash }; event.eventHash = hashJson(event); previousAuditHash = event.eventHash; auditEvents.push(event); return { ...event }; }  function publicAssessmentRun(assessmentRun) { const { ruleSetVersion, ...safe } = assessmentRun; return safe; }
  function runPreflight(input) {
    const request = validatePreflightRequest(input); const binding = normalizeBinding(request.methodologyBinding); const assessmentId = `assessment-${randomUUID()}`; const createdAt = new Date().toISOString();
    if (binding.standard === "GOLD_STANDARD") {
      const deterministicGateResults = ["PARC-DRAFT-TRACK-CONFIGURATION", "PARC-DRAFT-FACILITY-EVIDENCE", "PARC-DRAFT-FEEDSTOCK-EVIDENCE", "PARC-DRAFT-END-USE-EVIDENCE"].map((requirementId) => ({ requirementId, label: "Draft adapter evidence mapping", status: "METHODOLOGY_DRAFT_NOT_USABLE", evidenceIds: [], gateCodes: ["GOLD_STANDARD_PARC_DRAFT_NOT_USABLE"] }));
      const assessmentRun = { assessmentId, projectId: request.projectId, methodologyBinding: binding, ruleSetVersion: "gold-standard-parc-draft-adapter-2026-04", inputEvidenceIds: [], deterministicGateResults, reviewerRecommendations: [PARC_NOTICE], createdAt, outputHash: "", status: "METHODOLOGY_DRAFT_NOT_USABLE" };
      assessmentRun.outputHash = hashJson(assessmentRun); const auditEvent = audit(assessmentRun); assessments.set(assessmentId, { assessmentRun, package: null });
      return { assessmentRun: publicAssessmentRun(assessmentRun), status: "METHODOLOGY_DRAFT_NOT_USABLE", monitoringRoute: request.monitoringRoute, methodologyNotice: PARC_NOTICE, gateCodes: ["GOLD_STANDARD_PARC_DRAFT_NOT_USABLE"], packageAvailable: false };
    }
    const deterministicGateResults = buildDomains(request, binding); const gateCodes = [...new Set(deterministicGateResults.flatMap((result) => result.gateCodes))]; const allReady = deterministicGateResults.every((result) => result.status === "READY_FOR_INDEPENDENT_VERIFICATION");
    const status = gateCodes.includes("UNRESOLVED_MATERIAL_CONFLICT") ? "NEEDS_HUMAN_REVIEW" : allReady ? "READY_FOR_INDEPENDENT_VERIFICATION" : deterministicGateResults.some((result) => result.status === "EVIDENCE_UNVERIFIED") ? "EVIDENCE_UNVERIFIED" : deterministicGateResults.some((result) => result.status === "NOT_ASSESSABLE") ? "NOT_ASSESSABLE" : "EVIDENCE_INCOMPLETE";
    const inputEvidenceIds = stableIds(deterministicGateResults.map((result) => result.evidenceIds)); const assessmentRun = { assessmentId, projectId: request.projectId, methodologyBinding: binding, ruleSetVersion: "verra-vm0044-v1.2-preflight-2026-07", inputEvidenceIds, deterministicGateResults, reviewerRecommendations: gateCodes.map((code) => `Review required: ${code}`), createdAt, outputHash: "", status };
    assessmentRun.outputHash = hashJson(assessmentRun); const packageRecord = status === "READY_FOR_INDEPENDENT_VERIFICATION" ? { packageId: `verification-package-${randomUUID()}`, packageHash: hashJson({ assessmentId, inputEvidenceIds, ruleSetVersion: assessmentRun.ruleSetVersion }), sourceEvidenceIds: inputEvidenceIds, status: "READY_FOR_INDEPENDENT_VERIFICATION", notice: PACKAGE_NOTICE } : null;
    const auditEvent = audit(assessmentRun); assessments.set(assessmentId, { assessmentRun, package: packageRecord }); return { assessmentRun: publicAssessmentRun(assessmentRun), status, monitoringRoute: request.monitoringRoute, gateCodes, packageAvailable: Boolean(packageRecord) };
  }
  function getVerificationPackage(input) { const value = strictObject(input, ["assessmentId"], "package export request"); const record = assessments.get(text(value.assessmentId, "assessmentId")); if (!record || !record.package || record.assessmentRun.status !== "READY_FOR_INDEPENDENT_VERIFICATION") fail("A ready independent-review package is not available for this assessment."); return { ...record.package }; }
  return { captureDocument, registerUserAssertion, createSourceLinkedAssertion, admitSourceLinkedAssertion, runPreflight, getVerificationPackage, getAuditLog: () => auditEvents.map((event) => ({ ...event })) };
}

const productionController = createMethodologyPreflightController();
export const captureMethodologyDocument = (input) => productionController.captureDocument(input);
export const registerMethodologyUserAssertion = (input) => productionController.registerUserAssertion(input);
export const runMethodologyPreflight = (input) => productionController.runPreflight(input);
export const getMethodologyVerificationPackage = (input) => productionController.getVerificationPackage(input);
export const getMethodologyAuditLog = () => productionController.getAuditLog();
export { PACKAGE_NOTICE, PARC_NOTICE };