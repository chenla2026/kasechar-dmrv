# KaseChar internal demo runbook

## Start

Run `npm run dev` from the repository root and open `http://127.0.0.1:5173`.

## Preconditions

Use the local development server. The Sonnenerde controlled demonstration is a server-owned demo state. Its admitted DEMO EVIDENCE is deliberately labelled and is not a real Sonnenerde operational record.

## Three-state walkthrough

1. Open **PDD Monitoring Workspace** from More workflows. State 1 shows `MONITORING_NOT_STARTED`, zero of five monitoring items supported, one forecast-only item, two missing operational items, and `PACKAGE BLOCKED`.
2. In **Activity and evidence capture**, select a monitoring-plan item and leave the attachment type as `No attachment — USER_ASSERTION only`. Submit the prefilled activity. State 2 becomes `EVIDENCE_GAPS_FOUND`; material coverage remains zero.
3. Optionally submit metadata for a structured operator, uploaded document, laboratory, device, or unavailable record. The server creates the evidence ID and SHA-256 integrity metadata, keeps the record pending review, and does not make it material. Then in **Admit DEMO EVIDENCE**, admit the controlled laboratory record. State 3 shows one of five monitoring items supported; remaining forecast and application gaps keep the package blocked.
4. Use **Reset demo** to restore State 1. Reset is available only in non-production mode and only resets this controlled Sonnenerde demo state.

## Gemini behaviour

Use **Check document intelligence**. When the configured server-side Gemini pathway is available, the UI shows source filename/page plus model metadata. It remains advisory and cannot alter monitoring status, material coverage, or package availability. When unavailable, the UI displays: `Document intelligence is temporarily unavailable. Existing source-grounded monitoring records remain accessible.`

## Expected gate

The verification-support package must remain blocked throughout this walkthrough because material gaps remain unresolved. KaseChar prepares monitoring and evidence records for independent review only; it does not verify removals, certify projects, issue credits, or replace an independent VVB.

## Known limitation

The controlled evidence record exists solely for this internal demonstration. A production workflow requires captured and independently reviewed operational evidence.
