# Identity / Providers Test Cases — openclaw-dashboard

Ground truth for test steps. Update `templates/TEST-EXECUTION-TRACKING.csv` for status only.

---

## IDENTITY — Config & Credential Exposure

### TC-ID-001: /api/identity Does Not Leak Secrets via rawConfig

**Priority**: P0
**Type**: Security
**Estimated Time**: 5 minutes

**Prerequisites**:
- Dev server running
- `openclaw.json` (path from `getConfig().openclawDataDir`) contains at least one credential-shaped field (API key, token) — check real config or seed a test one

**Test Steps**:
1. `curl -s http://localhost:3000/api/identity | grep -iE "key|token|secret|password"`
2. Inspect `rawConfig` field in response specifically — this is `app/api/identity/route.ts:27-33`, which reads `openclaw.json` verbatim via `fs.readFileSync` and returns it unredacted in the JSON payload
3. Load `/identity` page in browser, check Network tab / rendered DOM for the same values

**Expected Result**:
✅ No raw credential values present in response — `rawConfig` should be redacted/omitted, or route should return only whitelisted safe fields

**Pass/Fail Criteria**:
- ✅ PASS: Credentials absent or redacted (e.g. `***last4`) in both API response and rendered page
- ❌ FAIL: Any credential value readable in `rawConfig` or elsewhere in response

**Potential Bugs to Watch For**:
- **Confirmed code smell**: `route.ts` returns `rawConfig` as full unredacted file content with comment "Read raw config for display" — no redaction step visible. This is a P0 finding, not just a theoretical test — verify against real config file before filing bug.
- Same risk applies to `parseProviderConnections` / `parseConfigAudit` outputs — check those too for embedded secrets

---

### TC-ID-002: /api/identity Handles Missing/Corrupt Config Gracefully

**Priority**: P1
**Type**: Integration
**Estimated Time**: 3 minutes

**Prerequisites**:
- Ability to temporarily rename/corrupt `openclaw.json` at `dataDir`

**Test Steps**:
1. Rename `openclaw.json` so it's missing
2. `curl http://localhost:3000/api/identity`
3. Restore file, corrupt it (invalid JSON), repeat
4. Restore valid file

**Expected Result**:
✅ Missing file: `rawConfig` empty string (existing `catch {}` at line 33 handles this), rest of response still returns 200 with defaults
✅ Corrupt file: `parseMainConfig` doesn't throw uncaught — route's outer try/catch returns 500 with `errorMessage(error)`, no stack trace leaked

**Pass/Fail Criteria**:
- ✅ PASS: Both cases handled without crash, no internal paths/stack traces in error body
- ❌ FAIL: Unhandled exception (dev server error overlay/500 HTML), or `errorMessage` leaks file paths/stack

**Potential Bugs to Watch For**:
- `errorMessage(error)` (lib/api-error.ts) — check whether it includes raw `error.stack` or file system paths in production mode
- `dataDir` value itself (`_meta.dataDir`) is returned in every response — confirm this isn't sensitive (local path disclosure, low severity but worth noting)

---

### TC-ID-003: /api/identity/provider-detail Scoped Correctly

**Priority**: P1
**Type**: Integration
**Estimated Time**: 3 minutes

**Prerequisites**:
- Multiple providers configured (per `parseProviderConnections`)

**Test Steps**:
1. `curl http://localhost:3000/api/identity/provider-detail?provider=<known-id>`
2. Verify only that provider's detail returned, not all providers
3. Try an unknown/invalid provider id
4. Try a provider id with path-traversal-shaped input (`../../etc/passwd`) if id maps to any file lookup

**Expected Result**:
✅ Valid id → scoped detail only
✅ Invalid id → 404/400, not a crash or full dump
✅ Traversal-shaped id → rejected, no filesystem access outside intended scope

**Pass/Fail Criteria**:
- ✅ PASS: All three behave correctly
- ❌ FAIL: Unknown id returns all providers (over-fetch), or traversal input touches filesystem

**Potential Bugs to Watch For**:
- Same `rawConfig`-style leakage risk as TC-ID-001 if this endpoint also reads raw files per-provider

---

## PROVIDERS — Connection Status

### TC-PROV-001: /api/providers Reflects Live Connection State

**Priority**: P1
**Type**: Integration
**Estimated Time**: 3 minutes

**Prerequisites**:
- At least one provider with valid credentials, one with invalid/missing

**Test Steps**:
1. `curl http://localhost:3000/api/providers`
2. Verify status field distinguishes connected vs failed vs unconfigured per provider
3. Invalidate one working provider's credential temporarily, re-fetch, verify status flips

**Expected Result**:
✅ Status accurately reflects real connectivity, not just "config present"

**Pass/Fail Criteria**:
- ✅ PASS: Status matches actual credential validity
- ❌ FAIL: Shows "connected" for invalid/expired credentials (false confidence), or vice versa

**Potential Bugs to Watch For**:
- Status cached and not re-validated (stale "connected" shown long after key revoked)
- No distinction between "not configured" and "configured but failing" states

---

## Coverage Notes

**Action item, not just a test case**: TC-ID-001 identifies a likely real P0 bug in `app/api/identity/route.ts` (unredacted `rawConfig` in API response). Recommend filing this in `BUG-TRACKING-TEMPLATE.csv` and fixing before further QA cycles — don't wait for formal test execution to raise it, since the code read alone is enough evidence to act on.

Still open: `app/office` (purpose unclear, investigate first), `app/market-intel`/`app/tech-updates`/`app/practitioner-signals` (SSRF surface on outbound fetches), `app/agent-orchestrator` session lifecycle depth.
