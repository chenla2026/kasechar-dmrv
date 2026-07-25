# KaseChar Gemini Architecture

## Body

- React SPA routes are built as tabbed screens in `src/App.tsx`.
- User enters batch form fields, uploads documents, starts Gemini actions, views checklist/gaps, checks audit logs, and exports a package.
- No decision-critical prompt logic is shipped to frontend.

## Controller

- `server/dev-server.mjs` exposes:
  - `POST /api/gemini/analyze`
  - `GET /api/audit-log`
  - `GET /api/health`
- Controller responsibilities:
  - Accept user evidence requests
  - Normalize request payloads
  - Execute Brain function
  - Persist in-memory audit entries for traceability
  - Return status and structured result objects to Body

## Brain (Protected)

- `server/brain/geminiBrain.mjs` contains all model prompts and model invocations.
- Model behavior is constrained by strict prompt templates:
  - no legal decisions
  - no invented evidence
  - no final credit claims
  - output in JSON-first style
- Output is normalized before being returned.

## Decision tracks and status policy

Controlled statuses are only used as **support signals**:

- `EVIDENCE_INCOMPLETE` when required checklist fields are still missing.
- `NEEDS_HUMAN_REVIEW` when risk flags or AI-detected uncertainty exceed safe thresholds.
- `NOT_ASSESSABLE` when confidence is low or contradictions are detected.
- `ASSESSABLE` only when minimum evidence completeness is reached and model output is acceptable.
- `READY_FOR_AUDIT_PACKAGE` only after export preparation and manual reviewer sign-off path.

## Why this satisfies the requested architecture

- Frontend is simple and operationally usable immediately.
- Controller isolates model interactions, logs, and API contract.
- Brain keeps interpretation logic hidden from UI and can be swapped/revisioned separately by prompt version.
