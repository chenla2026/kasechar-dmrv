# DEMO_SCRIPT

## 60-second XPRISE demo flow

1. Open app → choose **Batch record**.
2. Fill project, geolocation, source, production, quality, application, and permanence fields.
3. Go to **Evidence intake**.
4. Add one text evidence (for example: supplier invoice / lab note), then upload one file.
5. Go to **Gemini panel**.
   - Click **Extract EVIDENCE**
   - Click **Classify evidence**
   - Click **Detect gaps**
6. Open **MRV checklist** to show remaining gaps.
7. Open **Evidence gap report** to show advisory signals.
8. Open **Audit log** to show `model`, `promptVersion`, `outputStatus`, and timestamp.
9. Open **Export package** and click **Generate due-diligence summary**.
10. Copy JSON package and AI summary to demonstrate buyer/auditor handoff format.

## Key claims to keep in the script

- No final legal/compliance conclusion is made automatically.
- Missing data is explicitly shown as incompleteness.
- Human reviewer remains required for final certification.
- Evidence, logs, and status are traceable.

## Manual setup checks before judging

- `npm run dev` in `kasechar-gemini`.
- Confirm `GEMINI_API_KEY` is set.
- Confirm evidence + batch context is available.
