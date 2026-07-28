# KaseChar dMRV MVP

KaseChar is an evidence-controlled biochar dMRV workspace for source-grounded monitoring, gap identification, and independent-review preparation. It does not certify projects, determine legal compliance, issue credits, submit registries, or represent verified removals.

## Architecture

- **Body**: React workspace and thin API adapters.
- **Controller**: server-owned evidence admission, deterministic assessment, package gating, and audit records.
- **Brain**: protected server-side Gemini assistance for advisory extraction and classification.

The browser submits inputs and renders server responses. It does not create evidence IDs, hashes, admissions, controlled readiness, or review packages.

## Included workflow

- Source-grounded Sonnenerde PyroDry controlled document demonstration.
- PDD monitoring workspace with plan provenance, evidence coverage, review gaps, and timeline.
- Server-generated evidence IDs and SHA-256 integrity metadata.
- USER_ASSERTION treatment as advisory-only.
- Explicit controlled demo evidence, labelled `DEMO_RECORD_NOT_REAL_PROJECT_EVIDENCE`.
- Server-gated monitoring support package export.
- Gold Standard PARC permanently blocked as a draft, non-crediting pathway.

## Run locally

```powershell
npm run dev
```

Production-like local check:

```powershell
npm run build
npm run preview
```

## Validation

Run:

```powershell
npm run typecheck
npm run lint
npm run build
npm test
```

Public product media and validation records are in [product-evidence](product-evidence/README.md).