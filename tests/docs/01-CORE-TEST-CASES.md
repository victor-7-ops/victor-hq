# Core Test Cases — openclaw-dashboard

Ground truth for test steps. Update `templates/TEST-EXECUTION-TRACKING.csv` for status only — do NOT duplicate steps there.

App: Next.js dashboard (App Router). Dev server: `npm run dev` (see `.claude/launch.json`).

---

## WEB — Navigation & Shell

### TC-WEB-001: App Loads at Root

**Priority**: P0
**Type**: E2E
**Estimated Time**: 2 minutes

**Prerequisites**:
- Dev server running (`npm run dev`), reachable at configured port
- `.env.local` populated per `.env.local.example`

**Test Steps**:
1. Navigate to `/`
2. Observe page render
3. Check browser console for errors
4. Check Sidebar renders with nav links (Fleet, Kanban, Costs, Crons, Security, Memory, Chat, etc.)

**Expected Result**:
✅ HTTP 200, page renders without error boundary triggering
✅ No console errors
✅ Sidebar links match `components/NavLinks.tsx` entries

**Pass/Fail Criteria**:
- ✅ PASS: Page loads, no console errors, nav present
- ❌ FAIL: Blank page, thrown error, missing nav

**Potential Bugs to Watch For**:
- Missing env var causes unhandled exception (check `lib/env.ts` validation)
- Hydration mismatch warnings

---

### TC-WEB-002: Sidebar Navigation Routes Correctly

**Priority**: P1
**Type**: E2E
**Estimated Time**: 5 minutes

**Prerequisites**:
- App loaded at `/` (TC-WEB-001 passed)

**Test Steps**:
1. Click each top-level sidebar link (Fleet, Kanban, Costs, Crons, Security, Memory, Chat, Market Intel, Tech Updates, Reference Files, Activity, Settings)
2. For each, verify URL changes to matching route under `app/`
3. Verify page content loads (not error boundary, not infinite spinner)

**Expected Result**:
✅ Each route resolves to correct page component
✅ Active nav item highlighted per `components/Sidebar.tsx` logic

**Pass/Fail Criteria**:
- ✅ PASS: All routes load without error
- ❌ FAIL: 404, error boundary, or route mismatch on any link

**Potential Bugs to Watch For**:
- Broken links after route renames
- Missing loading state (`app/loading.tsx`) causing layout shift

---

### TC-WEB-003: Global Search

**Priority**: P2
**Type**: E2E
**Estimated Time**: 3 minutes

**Prerequisites**:
- App loaded, `components/GlobalSearch.tsx` mounted

**Test Steps**:
1. Trigger global search (keyboard shortcut or click)
2. Type a known entity name (e.g. an agent or task title)
3. Observe results list
4. Select a result

**Expected Result**:
✅ Search results filter as expected
✅ Selecting result navigates to correct entity

**Pass/Fail Criteria**:
- ✅ PASS: Relevant results shown, navigation correct
- ❌ FAIL: No results for known entity, navigation goes to wrong page

**Potential Bugs to Watch For**:
- XSS via unsanitized search query reflected in UI (check `lib/sanitize.ts` usage)
- Search index stale vs live data

---

### TC-WEB-004: Onboarding Wizard (First Run)

**Priority**: P1
**Type**: E2E
**Estimated Time**: 5 minutes

**Prerequisites**:
- Fresh install state — `lib/setup-detection.ts` reports not onboarded (`/api/onboarded` returns false)

**Test Steps**:
1. Navigate to `/`
2. Observe `OnboardingWizard` / `/setup` redirect
3. Complete wizard steps
4. Verify redirect to dashboard on completion

**Expected Result**:
✅ Wizard blocks dashboard access until required setup done
✅ `/api/setup/detect` reflects new state after completion

**Pass/Fail Criteria**:
- ✅ PASS: Wizard gates correctly, completes, persists state
- ❌ FAIL: Dashboard accessible while unconfigured, or wizard state lost on reload

**Potential Bugs to Watch For**:
- Partial completion not persisted (reload loses progress)
- Required env/config skippable when it shouldn't be

---

## API — Core Endpoints

### TC-API-001: GET /api/tasks Returns Valid Task List

**Priority**: P0
**Type**: Integration
**Estimated Time**: 2 minutes

**Prerequisites**:
- Dev server running
- DB seeded (`scripts/seed-demo.mjs` or existing data)

**Test Steps**:
1. `curl -s http://localhost:3000/api/tasks`
2. Verify HTTP 200
3. Verify response is JSON array/object matching `lib/types.ts` Task shape

**Expected Result**:
✅ HTTP 200, valid JSON, no stack trace in body

**Pass/Fail Criteria**:
- ✅ PASS: Schema matches, no errors
- ❌ FAIL: 500 error, malformed JSON, or leaked stack trace

**Potential Bugs to Watch For**:
- Unhandled DB connection failure returning HTML error page instead of JSON
- N+1 query causing slow response

---

### TC-API-002: POST /api/kanban Input Validation

**Priority**: P0
**Type**: Security
**Estimated Time**: 3 minutes

**Prerequisites**:
- Dev server running

**Test Steps**:
1. `curl -X POST http://localhost:3000/api/kanban -H "Content-Type: application/json" -d '{}'` (missing required fields)
2. Observe response
3. `curl -X POST http://localhost:3000/api/kanban -H "Content-Type: application/json" -d '{"title":"<script>alert(1)</script>"}'`
4. Observe stored/returned value

**Expected Result**:
✅ Missing fields → 400 with clear validation error (see `lib/validation.ts`)
✅ Script tag stored escaped/sanitized, not executed when rendered

**Pass/Fail Criteria**:
- ✅ PASS: Validation rejects bad input; XSS payload neutralized on render
- ❌ FAIL: 500 on bad input, or raw script executes in UI (stored XSS)

**Potential Bugs to Watch For**:
- Stored XSS in kanban card titles/descriptions
- Missing server-side validation (client-only checks)

---

### TC-API-003: SSE Streams Stay Alive (/api/stream, /api/pulse-stream, /api/usage/stream)

**Priority**: P1
**Type**: Integration
**Estimated Time**: 3 minutes

**Prerequisites**:
- Dev server running

**Test Steps**:
1. `curl -N http://localhost:3000/api/stream` (or relevant stream endpoint)
2. Observe events over ~30s
3. Kill client mid-stream, verify server doesn't leak connection (check server logs / process for hung handlers)

**Expected Result**:
✅ Stream emits `data:` events per `lib/sse.ts` format
✅ No server error on abrupt client disconnect

**Pass/Fail Criteria**:
- ✅ PASS: Stream stable, disconnect handled cleanly
- ❌ FAIL: Stream drops silently, server throws on disconnect, or connection leak

**Potential Bugs to Watch For**:
- Memory leak from unclosed streams on repeated connect/disconnect
- No heartbeat → proxies/load balancers timing out connection

---

### TC-API-004: /api/transcribe Rejects Oversized / Malformed Audio

**Priority**: P1
**Type**: Security
**Estimated Time**: 3 minutes

**Prerequisites**:
- Dev server running
- `lib/transcribe.ts` config present (API key etc.)

**Test Steps**:
1. POST a non-audio file (e.g. `.txt` renamed `.mp3`) to `/api/transcribe`
2. POST an oversized file (>configured limit)
3. Observe responses

**Expected Result**:
✅ Both rejected with appropriate 4xx and no crash
✅ No unbounded memory use processing oversized upload

**Pass/Fail Criteria**:
- ✅ PASS: Both invalid inputs rejected gracefully
- ❌ FAIL: 500 error, hang, or file accepted and mis-processed

**Potential Bugs to Watch For**:
- Missing file size limit (DoS vector)
- MIME type spoofing not checked

---

## SEC — OWASP Baseline

### TC-SEC-001: Sensitive Env Vars Not Exposed to Client

**Priority**: P0
**Type**: Security
**Estimated Time**: 3 minutes

**Prerequisites**:
- App running, `.env.local` has secret keys (API keys, DB creds)

**Test Steps**:
1. Load `/` in browser, view page source and JS bundles
2. Search bundle output for known secret values / key names from `.env.local.example`
3. Check `lib/env.ts` for `NEXT_PUBLIC_` prefixing discipline

**Expected Result**:
✅ No secret values present in client bundle or HTML
✅ Only intentionally public vars (`NEXT_PUBLIC_*`) appear client-side

**Pass/Fail Criteria**:
- ✅ PASS: No secrets found client-side
- ❌ FAIL: Any API key/secret findable in browser-served assets

**Potential Bugs to Watch For**:
- Secret accidentally passed as prop to client component
- Server-only lib imported into a `"use client"` file

---

### TC-SEC-002: Path Traversal on Reference Files Endpoint

**Priority**: P0
**Type**: Security
**Estimated Time**: 3 minutes

**Prerequisites**:
- Dev server running
- `/api/reference-files/[id]` accessible

**Test Steps**:
1. `curl "http://localhost:3000/api/reference-files/..%2f..%2f..%2fetc%2fpasswd"`
2. `curl "http://localhost:3000/api/reference-files/../../package.json"`
3. Observe response

**Expected Result**:
✅ Request rejected (400/404), no file content outside intended storage dir returned

**Pass/Fail Criteria**:
- ✅ PASS: Traversal blocked
- ❌ FAIL: Any out-of-scope file content returned

**Potential Bugs to Watch For**:
- Unsanitized `id` param used directly in filesystem path
- Symlink following outside storage root

---

### TC-SEC-003: Command/Git API Does Not Allow Arbitrary Command Injection

**Priority**: P0
**Type**: Security
**Estimated Time**: 5 minutes

**Prerequisites**:
- Dev server running
- `/api/git`, `/api/claude-code`, `/api/config` endpoints reachable (these likely shell out — verify in `lib/git/`)

**Test Steps**:
1. Identify parameters passed to any shell-exec (`lib/git/*`, cron/pipeline runners)
2. Submit payloads with shell metacharacters (`; whoami`, `` `id` ``, `$(id)`) in those params
3. Observe response and server logs

**Expected Result**:
✅ Metacharacters treated as literal data, not executed
✅ No evidence of command execution (no unexpected process output)

**Pass/Fail Criteria**:
- ✅ PASS: Injection payloads inert
- ❌ FAIL: Evidence of shell command execution from user input

**Potential Bugs to Watch For**:
- Use of `exec`/`execSync` with string concatenation instead of `execFile`/array args
- Cron pipeline definitions allowing arbitrary shell commands from untrusted input

---

## Coverage Notes

Not yet covered (add as separate category docs when prioritized):
- `app/agent-orchestrator`, `app/fleet`, `app/constellation` — multi-agent orchestration flows
- `app/costs`, `hooks/useCostData.ts`, `hooks/useTokenUsage.ts` — cost/usage accuracy
- `app/memory`, `lib/memory*.ts` — memory health, reindexing correctness
- Auth/access control — confirm whether any auth exists at all (single-user tool?); if none, document as accepted risk in `BASELINE-METRICS.md`
