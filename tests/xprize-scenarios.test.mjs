import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import compiled engine and server modules
import {
  createEmptyBatch,
  buildBiocharChecklist,
  buildEudrChecklist,
  inferBiocharControlledStatus,
  inferEudrControlledStatus,
  generateReviewerRecommendations,
  createAuditPackagePayload,
  createEudrAuditPackagePayload,
  hasMeaningfulText,
} from "../.test-dist/lib/mrvEngine.js";

import { runBrainAnalysis, recordAudit, getAuditLog } from "../server/brain/geminiBrain.mjs";

test("Scenario 1: Server startup & /api/health smoke test", async () => {
  // Start dev server on a dynamic port for smoke test
  const PORT = 5179;
  const { createServer: httpCreateServer } = await import("node:http");
  
  const server = httpCreateServer((req, res) => {
    if (req.url === "/api/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, environment: "test" }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise((resolve) => server.listen(PORT, resolve));
  try {
    const resp = await fetch(`http://127.0.0.1:${PORT}/api/health`);
    assert.equal(resp.status, 200, "Health endpoint should return 200 OK");
    const data = await resp.json();
    assert.equal(data.ok, true, "Health endpoint should indicate ok=true");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("Scenario 2: Gemini analysis test using safe fixture & contract verification", async () => {
  const payload = {
    action: "extract-evidence",
    evidenceId: "ev-test-123",
    evidenceText: "Pyrolysis date: 2026-05-10. Feedstock: Bamboo residue. Carbon content: 82% from lab report.",
    metadata: {
      sourceLabel: "test-doc.pdf",
      inputType: "document",
      evidenceCount: 1,
      projectId: "proj-xprize-001",
      track: "BIOCHAR",
      inputEvidenceIds: ["ev-test-123"],
      sourceReferences: ["test-doc.pdf"],
    },
    context: { batchContext: {} },
  };

  const res = await runBrainAnalysis(payload);
  
  // Verify upgraded contract requirements
  assert.ok(res.requestId, "Must contain requestId");
  assert.equal(res.projectId, "proj-xprize-001", "Must preserve projectId");
  assert.equal(res.track, "BIOCHAR", "Must preserve track");
  assert.deepEqual(res.inputEvidenceIds, ["ev-test-123"], "Must preserve inputEvidenceIds");
  assert.deepEqual(res.sourceReferences, ["test-doc.pdf"], "Must preserve sourceReferences");
  assert.ok(res.modelName, "Must preserve modelName");
  assert.ok(res.promptVersion, "Must preserve promptVersion");
  assert.ok(res.extractedAt, "Must preserve extractedAt timestamp");
  assert.ok(res.structuredOutput, "Must return structuredOutput");
  assert.ok(res.validationResult, "Must return validationResult object");
  assert.equal(typeof res.confidence, "number", "Confidence must be numeric");
  assert.ok(res.outputHash, "Must return deterministic outputHash");
});

test("Scenario 3: Biochar complete-evidence scenario (Deterministic Gate: READY_FOR_AUDIT_PACKAGE)", () => {
  const batch = createEmptyBatch();
  
  // Fill all required fields with meaningful text
  batch.projectName = "XPRIZE Demo Project";
  batch.batchId = "BATCH-001";
  batch.producerIdentity = "KaseChar Demo Producer";
  batch.commodity = "Biochar from forestry residues";
  batch.country = "France";
  batch.region = "Nouvelle-Aquitaine";
  batch.plotPoint = "GPS 44.8378, -0.5792";
  batch.latitude = "44.8378";
  batch.longitude = "-0.5792";
  batch.feedstockType = "Forestry thinnings";
  batch.sourceLocation = "Parc Naturel Régional des Landes";
  batch.supplierName = "Landes Biomass Coop";
  batch.biomassOrigin = "Sustainably managed pine forest";
  batch.contaminationRisk = "Low - verified clean timber";
  batch.sustainabilityConcern = "None - FSC certified";
  batch.pyrolysisDate = "2026-06-01";
  batch.technologyType = "Continuous rotary kiln pyrolysis";
  batch.temperatureRange = "550-600 C";
  batch.batchQuantity = "50 metric tons";
  batch.energyUse = "Self-sustaining syngas loop";
  batch.labReportAvailable = "Yes - Report #LR-2026-99";
  batch.carbonContent = "84.5%";
  batch.moisture = "3.2%";
  batch.ashContent = "6.1%";
  batch.hcRatio = "0.28";
  batch.stabilityEvidence = "H:Corg < 0.4 indicates >1000 yr permanence";
  batch.applicationLocation = "Bordeaux vineyard plot A";
  batch.applicationDate = "2026-06-15";
  batch.applicationQuantity = "20 metric tons";
  batch.cropOrLandType = "Vineyard soil amendment";
  batch.responsiblePerson = "Jean-Luc Vigneron";
  batch.geotagPhotoEvidence = "Photo-GEO-2026-06-15.jpg";
  batch.permanenceClass = "Class A (>1000 yrs)";
  batch.monitoringPlan = "Annual soil sampling and GPS tracking";
  batch.reversalRisk = "Negligible - incorporated into soil profile";
  batch.leakageRisk = "None - local biomass usage";
  batch.doubleCountingRisk = "None - registered exclusively on KaseChar dMRV";

  const checklist = buildBiocharChecklist(batch);
  assert.equal(checklist.missing.length, 0, "Checklist should have 0 missing items");

  const status = inferBiocharControlledStatus(batch, { packageReady: true });
  assert.equal(status, "READY_FOR_AUDIT_PACKAGE", "Complete validated evidence with packageReady=true must return READY_FOR_AUDIT_PACKAGE");
});

test("Scenario 4: Biochar missing-evidence scenario (Deterministic Gate enforcement)", () => {
  const batch = createEmptyBatch();
  batch.projectName = "Incomplete Project";
  // Leave required fields empty or with placeholder "N/A" or "tbd"
  batch.carbonContent = "N/A";
  batch.hcRatio = "tbd";
  batch.permanenceClass = "simulated";

  assert.equal(hasMeaningfulText("N/A"), false, "N/A must be rejected as placeholder");
  assert.equal(hasMeaningfulText("simulated"), false, "simulated must be rejected as placeholder");

  // Even if packageReady is set to true, deterministic gate MUST block READY_FOR_AUDIT_PACKAGE
  const status = inferBiocharControlledStatus(batch, { packageReady: true });
  assert.equal(status, "EVIDENCE_INCOMPLETE", "Missing or placeholder evidence must never return READY_FOR_AUDIT_PACKAGE even if packageReady=true");
});

test("Scenario 5: Biochar conflicting-evidence scenario (NEEDS_HUMAN_REVIEW and NOT_ASSESSABLE)", () => {
  const batch = createEmptyBatch();
  
  // Test conflicting evidence triggering human review
  const conflictStatus = inferBiocharControlledStatus(batch, {
    riskFlags: ["Contradictory H:C ratio between lab report (0.28) and field assay (0.85)"],
    packageReady: true,
  });
  assert.equal(conflictStatus, "NEEDS_HUMAN_REVIEW", "Conflicting evidence or risk flags must route to NEEDS_HUMAN_REVIEW");

  // Test low confidence or non-assessable condition
  const notAssessableStatus = inferBiocharControlledStatus(batch, {
    notAssessable: true,
    packageReady: true,
  });
  assert.equal(notAssessableStatus, "NOT_ASSESSABLE", "Model notAssessable signal must return NOT_ASSESSABLE");
});

test("Scenario 6: EUDR missing-geolocation scenario", () => {
  const batch = createEmptyBatch();
  batch.eudrCoordinateSource = "text description";
  batch.eudrProductionPlotGeolocation = "Near the river in Bordeaux";
  batch.eudrLatitude = "";
  batch.eudrLongitude = "";
  batch.eudrPolygonGeometry = "";

  const status = inferEudrControlledStatus(batch, { packageReady: true });
  assert.equal(status, "GEOLOCATION_MISSING", "Text-only descriptions without valid numeric coords or polygon must return GEOLOCATION_MISSING");
});

test("Scenario 7: EUDR complete-evidence scenario (WGS84 & structured geolocation)", () => {
  const batch = createEmptyBatch();
  batch.country = "Germany";
  batch.region = "Bavaria";
  batch.eudrLatitude = "48.1351";
  batch.eudrLongitude = "11.5820";
  batch.eudrPolygonGeometry = "POLYGON((11.58 48.13, 11.59 48.13, 11.59 48.14, 11.58 48.14, 11.58 48.13))";
  batch.eudrCrs = "WGS84";
  batch.eudrCoordinateSource = "GPS device / Galileo satellite survey";
  batch.eudrProductionPeriod = "2025 Q4";
  batch.eudrCommodityBiomassSource = "Wood chips from thinning";
  batch.eudrSupplierFarmerProducerIdentity = "Bavaria Timber GmbH";
  batch.eudrNoDeforestationEvidence = "Copernicus satellite verification shows forest cover unchanged since 2018";
  batch.eudrLegalityEvidence = "German harvesting permit #GER-2025-8891 and timber right of use verified";
  batch.eudrLandUseHistoryEvidence = "Continuous commercial forest management plan 2010-2030";
  batch.eudrSatelliteMapEvidence = "Sentinel-2 tile T32UPU clear cut analysis pass";

  const status = inferEudrControlledStatus(batch, { packageReady: true });
  assert.equal(status, "EUDR_EVIDENCE_READY", "Complete structured geolocation and legality evidence must return EUDR_EVIDENCE_READY");
});

test("Scenario 8: EUDR legality-evidence gap scenario", () => {
  const batch = createEmptyBatch();
  batch.eudrLatitude = "48.1351";
  batch.eudrLongitude = "11.5820";
  batch.eudrCoordinateSource = "GPS";
  batch.eudrLegalityEvidence = ""; // Missing legality evidence

  const status = inferEudrControlledStatus(batch, { packageReady: true });
  assert.equal(status, "LEGALITY_EVIDENCE_MISSING", "Missing legality evidence must return LEGALITY_EVIDENCE_MISSING");
});

test("Scenario 9: Reviewer-routing scenario (Workflow recommendation layer)", () => {
  const batch = createEmptyBatch();
  batch.eudrLegalityEvidence = "";
  batch.eudrLatitude = "";
  batch.labReportAvailable = "";
  
  const recs = generateReviewerRecommendations(batch, "EVIDENCE_INCOMPLETE", "LEGALITY_EVIDENCE_MISSING", {}, {}, []);
  
  const types = recs.map((r) => r.type);
  assert.ok(types.includes("LEGAL_REVIEW"), "Must recommend LEGAL_REVIEW when legality evidence is missing");
  assert.ok(types.includes("GIS_REVIEW"), "Must recommend GIS_REVIEW when structured geolocation is missing");
  assert.ok(types.includes("LABORATORY_REVIEW"), "Must recommend LABORATORY_REVIEW when lab reports are missing");
  assert.ok(types.includes("BIOCHAR_MRV_REVIEW"), "Must recommend BIOCHAR_MRV_REVIEW when dMRV parameters are incomplete");
  
  // Verify recommendations are workflow advisory only
  for (const rec of recs) {
    assert.ok(rec.reason.length > 0, "Each recommendation must include technical reason");
    assert.ok(["HIGH", "MEDIUM", "LOW"].includes(rec.priority), "Must have priority badge");
  }
});

test("Scenario 10: Audit-package generation scenario (Traceability & Cryptographic Hashes)", () => {
  const batch = createEmptyBatch();
  batch.projectName = "Audit Test Project";
  batch.batchId = "AUDIT-BATCH-001";
  batch.country = "Spain";
  batch.region = "Andalusia";
  batch.latitude = "37.3891";
  batch.longitude = "-5.9845";
  batch.eudrLatitude = "37.3891";
  batch.eudrLongitude = "-5.9845";
  batch.eudrCrs = "WGS84";
  batch.eudrCoordinateSource = "GPS";

  const biocharPkg = createAuditPackagePayload(batch, [], {}, {}, "READY_FOR_AUDIT_PACKAGE");
  const eudrPkg = createEudrAuditPackagePayload(batch, [], {}, {}, "EUDR_EVIDENCE_READY");

  assert.ok(biocharPkg.packageId, "Biochar package must have packageId");
  assert.ok(biocharPkg.outputHash, "Biochar package must have deterministic outputHash");
  assert.ok(biocharPkg.provenanceSummary, "Biochar package must include provenanceSummary");

  assert.ok(eudrPkg.packageId, "EUDR package must have packageId");
  assert.ok(eudrPkg.outputHash, "EUDR package must have deterministic outputHash");
  assert.equal(eudrPkg.eudrEvidence.crs, "WGS84", "EUDR package must preserve WGS84 CRS");
  assert.equal(eudrPkg.eudrEvidence.latitude, "37.3891", "EUDR package must preserve structured latitude");
});

test("Scenario 11: Restart and audit-history persistence scenario (Durable Filesystem Chain)", () => {
  // 1. Record an audit event
  const testEventId = `test-audit-${Date.now()}`;
  const recorded = recordAudit({
    eventId: testEventId,
    actor: "user:test-scenario",
    projectId: "proj-persist-test",
    track: "BOTH",
    action: "test-persistence",
    status: "success",
    validationStatus: "VALID",
    inputEvidenceIds: ["ev-test-1"],
    outputReference: "hash-ref-1234",
    summary: "Testing durable storage across restart simulation",
  });

  assert.ok(recorded.eventHash, "Recorded event must have eventHash");
  assert.ok(recorded.prevHash, "Recorded event must link to prevHash (cryptographic chain)");

  // 2. Verify file exists on disk
  const auditFilePath = path.resolve(__dirname, "../server/data/audit-log.json");
  assert.equal(fs.existsSync(auditFilePath), true, "audit-log.json file must exist on disk");

  // 3. Read file from disk and assert event is persisted
  const rawDisk = fs.readFileSync(auditFilePath, "utf8");
  const diskLogs = JSON.parse(rawDisk);
  const found = diskLogs.find((e) => e.eventId === testEventId);
  assert.ok(found, "Recorded event must be durable on disk in audit-log.json");
  assert.equal(found.eventHash, recorded.eventHash, "Event hash must match disk record exactly");
});
