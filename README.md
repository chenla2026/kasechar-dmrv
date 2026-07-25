# KaseChar Gemini (dMRV MVP)

This is a dedicated implementation target for a Gemini-enabled KaseChar MVP focused on Biochar evidence workflows.

## What is implemented

- **Body**: React screens for dashboard, biochar batch, evidence upload, extraction/control actions, checklist, gap report, audit log, and package export.
- **Controller**: API request route `/api/gemini/analyze` and `/api/audit-log` handled by a server controller.
- **Brain (protected)**: Server-side Gemini prompt engine in `server/brain/geminiBrain.mjs`.
- Structured controlled statuses:
  - `ASSESSABLE`
  - `NOT_ASSESSABLE`
  - `NEEDS_HUMAN_REVIEW`
  - `EVIDENCE_INCOMPLETE`
  - `READY_FOR_AUDIT_PACKAGE`
- Audit trail captures model name, prompt version, action, input type, and output status.
- No final credit/legal decision is made by the system; all outputs are advisory.

## Repository layout

- `src/`: React body and UI logic.
- `server/`: Local app server and protected Brain.
- `server/dev-server.mjs`: Serves the app and API endpoints.
- `server/brain/geminiBrain.mjs`: Controlled Gemini wrapper and model guardrails.
- `src/lib/mrvEngine.ts`: Checklist, status inference, and extraction merge helpers.

## Run locally (non-admin Windows)

1. Open a terminal in `kasechar-gemini`.
2. Install dependencies:
   ```powershell
   npm install
   ```
3. Copy `.env.example` to `.env` and set your `GEMINI_API_KEY`.
4. Start dev server (client + API):
   ```powershell
   npm run dev
   ```
5. Open `http://127.0.0.1:5173`.

Production-like local run:
```powershell
npm run build
npm run preview
```

## Endpoints

- `GET /api/health`
- `POST /api/gemini/analyze`
- `GET /api/audit-log`

## Notes

- This MVP remains a support system for evidence preparation and transparency.
- Human review and legal/compliance decisions are intentionally outside AI finalization.
