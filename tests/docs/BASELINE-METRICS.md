# Baseline Metrics - openclaw-dashboard

**Date**: 2026-07-03
**Purpose**: Pre-QA snapshot for comparison during testing

---

## 1. Test Coverage (Current State)

### Unit Tests
- **Total Tests**: 60 (6 files: `lib/__tests__/*.test.ts` — agent-orchestrator-ownership, agent-orchestrator, api-error, crons-file, setup-detection, utils)
- **Passing**: 60 (100%)
- **Failing**: 0
- **Coverage**: Not instrumented (no coverage report configured in `vitest.config.ts`) — gap, not measured yet
- **Framework**: Vitest

### Integration Tests
- **Total Tests**: 0 automated. Manual curl-based cases documented in `01-CORE-TEST-CASES.md` through `04-IDENTITY-PROVIDERS-TEST-CASES.md`
- **Status**: Not Implemented (manual only)

### E2E Tests
- **Total Tests**: 0 automated (Playwright/Cypress not present in `package.json`)
- **Browsers Covered**: None automated — manual verification only, via `preview_*` tooling (Chromium-based)

---

## 2. Known Issues (Pre-QA)

### Critical Issues (found + fixed during initial QA pass, 2026-07-03)
- [x] **BUG-001** (P0, Resolved): `/api/identity` leaked raw credentials (gateway auth token, Telegram botToken) via unredacted `rawConfig` field. Fixed in `lib/sanitize.ts` + `app/api/identity/route.ts`.
- [x] **BUG-002** (P0, Resolved): `simple-git` had a critical RCE (GHSA-r275-fr43-pm7q), `next` 16.1.6 had 11 high-severity CVEs. Upgraded `simple-git` → 3.36.0, `next` → 16.2.10.

### Technical Debt
- [ ] No test coverage instrumentation configured — can't measure statement/branch coverage
- [ ] No automated E2E suite — all 33 written test cases in `tests/docs/` require manual execution
- [ ] `app/office` purpose undocumented — needs investigation before test cases can be written
- [ ] 2 moderate `postcss` vulnerabilities remain (nested inside `next`'s own deps) — fixing requires downgrading `next` to 9.3.3, not worth the regression; accepted risk

---

## 3. Security Status

### OWASP Top 10 Coverage
- [x] A01: Broken Access Control — N/A by design (single-user local tool, no auth layer/middleware found; documented in `02-FLEET-COSTS-MEMORY-TEST-CASES.md`)
- [ ] A02: Cryptographic Failures — not yet tested (how are stored credentials at rest protected, if at all?)
- [x] A03: Injection — test cases written (TC-CRON-002 shell injection, TC-KANBAN-003 / TC-MEM-003 prompt injection, TC-SEC-002 path traversal); not yet executed
- [ ] A04: Insecure Design — not yet assessed
- [x] A05: Security Misconfiguration — BUG-001 (credential exposure) found and fixed under this category
- [x] A06: Vulnerable Components — BUG-002 found and fixed (npm audit: was 1 critical/10 high, now 0 critical/0 high, 2 moderate remaining)
- [ ] A07: Authentication Failures — N/A, no auth to test
- [ ] A08: Data Integrity Failures — not yet assessed
- [ ] A09: Logging Failures — not yet assessed (does app log security-relevant events like config changes? `configAudit` exists but unclear if actionable)
- [ ] A10: SSRF — flagged as open risk in `03-CRONS-KANBAN-SECURITY-TEST-CASES.md` coverage notes (market-intel/tech-updates/practitioner-signals do outbound fetches) — not yet tested

**Current Coverage**: 4/10 addressed (A01 N/A-confirmed, A03 cases written, A05 fixed, A06 fixed) — 40%, with real P0s already resolved

---

## 4. Performance Metrics

- **Page Load Time**: `/` initial compile ~2-5.6s (Turbopack cold), ~200-260ms warm (dev mode, not representative of prod build)
- **API Response Time**: Highly variable — `/api/identity` ~1s, `/api/agents` observed at 32.9s cold (likely uncached parser work), `/api/crons` 14-21s cold. **Flag**: several endpoints show multi-second-to-30s+ cold response times in dev; worth profiling before treating as acceptable — not yet root-caused
- **Database Query Time**: Not measured (SQLite via better-sqlite3, synchronous — unlikely to be the bottleneck given above timings point elsewhere, e.g. filesystem parsing)

---

## 5. Code Quality

- **Linting Errors**: 32 errors, 28 warnings (ESLint, 327 files linted) — mostly `react-hooks/exhaustive-deps`, `react-hooks/immutability`, `react/no-children-prop`
- **TypeScript Strict Mode**: Yes (per `tsconfig.json`)
- **Code Duplication**: Not measured (no tool configured)
- **Cyclomatic Complexity**: Not measured (no tool configured)

---

## 6. Predicted Issues

**CRITICAL-001**: Slow cold-start API responses (`/api/agents` 32.9s, `/api/crons` 14-21s)
- **Predicted Severity**: P1 (UX degradation, not data loss — but severe enough to feel broken on first load)
- **Root Cause**: Unconfirmed — likely uncached filesystem/log parsing in `lib/parsers/openclaw-logs.ts` or similar, invoked per-request with no memoization
- **Test Case**: Not yet written — add TC-PERF-001 to a future performance category doc
- **Mitigation**: Profile the parser chain; consider caching parsed config/log state with invalidation on file mtime change

**CRITICAL-002**: ~~SSRF surface on outbound-fetching features~~ — **Investigated 2026-07-03, not confirmed.**
- All `fetch()` calls in `app/api/*` (competitors/discover, competitors/[id]/research, chat, agent-orchestrator/events) target hardcoded `localhost:<gateway-port>` or server-configured `getAOBaseUrl()` — no user-controlled URL parameter found in any route
- `app/api/market-intel`, `app/api/tech-updates`, `app/api/practitioner-signals` are DB read/write only, no outbound fetch in this codebase — external data presumably ingested by the OpenClaw agent process outside this dashboard
- `app/api/reference-files` has no fetch/axios/http calls either
- **Conclusion**: no SSRF vector found in this repo. Downgrading from predicted issue to closed/no-finding. If OpenClaw's separate ingestion process is in scope for QA, that's a different codebase to audit, not this one.

---

**Next Steps**: Execute the 33 written test cases across `01`–`04` docs (update `TEST-EXECUTION-TRACKING.csv` per test), then write category 05 covering SSRF surfaces (market-intel/tech-updates/practitioner-signals) and `app/office` once its purpose is confirmed.
