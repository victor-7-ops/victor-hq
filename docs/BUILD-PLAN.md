# Victor HQ — Build Plan (handoff for executing agent)

Self-contained implementation plan. Execute steps in order; each step has acceptance criteria. Repo: `C:\Users\gadia\Documents\Claude\openclaw-dashboard` (Next.js 16 / React 19 / better-sqlite3 / Tailwind 4, dev server `npm run dev` on :3333, tests `npm test` (vitest), lint `npm run lint`).

## Baseline (verified 2026-07-07)

- 60/60 vitest tests pass; coverage limited to `lib/__tests__/` — no page/component/API-route tests.
- ESLint: 32 errors + 28 warnings across 27 files. Includes 1 `react-hooks/rules-of-hooks` violation (critical), 13 `react-hooks/immutability` (9 in `lib/office/components/OfficeCanvas.tsx`, 3 in `OnboardingWizard.tsx`), 24 `exhaustive-deps`, 5 `react-hooks/refs` in `lib/office/components/ToolOverlay.tsx`, 3 `react/no-children-prop` in `components/fleet/AgentTree.tsx`.
- Uncommitted working-tree changes (KEEP, they are in-flight work to finish): `lib/sanitize.ts` adds `redactSecrets()` / `redactJsonString()`; `app/api/identity/route.ts` applies them. Also `package.json` / `package-lock.json` modified. New untracked `tests/` dir contains manual QA docs (`tests/docs/*.md`) + templates only — no e2e automation yet.
- External dependencies and default failure behavior:
  - OpenClaw gateway (`http://localhost:${OPENCLAW_GATEWAY_PORT||18789}`) — several fetches have no timeout; chat/TTS/transcribe hang ~30s when offline; `app/api/competitors/discover`, `app/api/competitors/[id]/research`, `app/api/kanban/chat/[id]` have no try/catch and crash.
  - Agent Orchestrator daemon (discovery via `~/.ao/running.json`, fallback `http://127.0.0.1:3001`) — `aoFetch()` in `lib/agent-orchestrator.ts:62` throws on any non-ok; `/agent-orchestrator` page unusable offline ("reconnecting" forever).
  - `openclaw` CLI (`OPENCLAW_BIN`, default `openclaw` on PATH) — `execSync` calls in `lib/parsers/openclaw-cli.ts` block the Node event loop (up to ~45s for `openclaw models status`); known "dev server freeze" in README.
- Env vars used: `OPENCLAW_HOME`, `WORKSPACE_PATH`, `OPENCLAW_BIN`, `OPENCLAW_GATEWAY_TOKEN`, `OPENCLAW_GATEWAY_PORT`. `.env.local` exists locally. No startup validation anywhere.
- Existing utilities to REUSE (do not reinvent):
  - `errorMessage()` from `lib/api-error.ts` — standard error JSON pattern (see `app/api/security/route.ts`).
  - `redactSecrets()` / `redactJsonString()` in `lib/sanitize.ts` (uncommitted) — key-name regex `/token|key|secret|password|credential|auth/i`, masks to `****XXXX`.
  - `resolveHomePath()` from `lib/utils.ts`.
  - SQLite singleton `getDb()` in `lib/db/schema.ts`; queries in `lib/db/queries.ts` (860 lines, parameterized, WAL mode).

## Route-specific notes gathered during analysis

- `app/api/system/route.ts` — already has try/catch; uses macOS-only commands (`top -l`, `sysctl vm.swapusage`, `df -k /`, `pgrep`) that silently fail on Windows (Victor's machine is Windows 11). Response contains no raw credentials (versions/metrics only) — redaction NOT needed here, but Windows fallbacks are a worthwhile improvement (optional, low priority).
- `app/api/security/route.ts` — has try/catch + `errorMessage`. Returns `securityPosture` and `openclawConfig`-derived fields from `parseMainConfig(dataDir)`; wrap `securityPosture` and any config-derived objects in `redactSecrets()` before responding.
- `app/api/agents/route.ts` — has try/catch. Response includes `modelsConfig` from `getOpenClawModels()`; audit that object for provider API keys and wrap response in `redactSecrets()` if any credential-shaped fields exist.
- `app/api/identity/route.ts` — redaction already applied (uncommitted). Keep as-is; add tests; commit.

## Steps

### Phase 1 — Ship it safe (blocking)

**Step 1 — Complete credential redaction**
- Apply `redactSecrets()` from `lib/sanitize.ts` to responses of `/api/security` (posture/config fields) and `/api/agents` (`modelsConfig`); audit every other route returning config blobs (grep for `parseMainConfig`, `openclawConfig`, `providers`) and apply where credential-shaped values can appear.
- Add unit tests in `lib/__tests__/sanitize-redact.test.ts`: nested objects, arrays, non-matching keys untouched, short values (`<=4` chars) fully masked, `redactJsonString` invalid-JSON passthrough.
- Commit the in-flight `lib/sanitize.ts` + `app/api/identity/route.ts` work together with these changes.
- Acceptance: no raw token/key/secret values in any API response (curl each route, grep for real token substring); vitest passes.

**Step 2 — Harden API routes**
- Add try/catch + `errorMessage()` JSON to: `app/api/competitors/route.ts`, `app/api/pipelines/route.ts`, `app/api/reference-files/route.ts` (GET and POST).
- Add `AbortSignal.timeout(5000)` to every gateway fetch: `app/api/chat/route.ts:73`, `app/api/chat/[id]/route.ts:95`, `app/api/tts/route.ts`, `app/api/transcribe/route.ts`, `app/api/competitors/discover/route.ts`, `app/api/competitors/[id]/research/route.ts`.
- Wrap `app/api/competitors/discover`, `app/api/competitors/[id]/research`, `app/api/kanban/chat/[id]` handlers in try/catch (they currently crash on network error; kanban route inits OpenAI client bare).
- Acceptance: with gateway stopped, routes return 4xx/5xx JSON within ~6s, never hang or crash the process.

**Step 3 — Startup env validation**
- New `lib/env.ts`: validate `OPENCLAW_HOME`, `WORKSPACE_PATH`, `OPENCLAW_BIN`, `OPENCLAW_GATEWAY_TOKEN`. Per-var actionable message (what it is, where to set it — `.env.local`, see `.env.local.example`). Distinguish hard-required (`OPENCLAW_HOME`) from degraded-mode-ok (gateway token → chat disabled warning).
- Call from Next.js `instrumentation.ts` (create it; Next 16 supports it by default).
- Unit tests for the validator.
- Acceptance: missing var → clear startup message; valid `.env.local` → boots normally.

### Phase 2 — Daily-driver resilience

**Step 4 — Agent Orchestrator offline degradation**
- Add SQLite table (extend `lib/db/schema.ts` migrations + `lib/db/queries.ts`) caching last-known AO projects/sessions JSON with timestamp.
- In `lib/agent-orchestrator.ts`: on successful fetch, upsert cache; on failure, return cached data with `_meta: { stale: true, cachedAt }` instead of throwing (list endpoints only; mutations still error).
- `app/agent-orchestrator/page.tsx` (~lines 76–110): replace infinite reconnect with banner "Agent Orchestrator not running" + Retry button; render stale cached data dimmed.
- Acceptance: daemon offline → page renders cached data + banner; daemon back → live data resumes; tests cover cache read/write.

**Step 5 — Unblock event loop**
- `lib/parsers/openclaw-cli.ts`: convert `execSync` to async `execFile` (promisified), keep/extend existing TTL cache (10m for `models status`). Update callers (`app/api/agents/route.ts` `getOpenClawModels`/`getOpenClawSessions`, `lib/anthropic.ts` if applicable) to await.
- Also note `app/api/system/route.ts` and `app/api/security/route.ts` use `execSync` with short timeouts (3–5s) — acceptable, but convert opportunistically if trivial.
- Acceptance: no `execSync` in request hot paths of openclaw-cli.ts; dev server responsive during status refresh; existing parser tests pass.

**Step 6 — Lint to zero errors**
- Order: (1) the single `rules-of-hooks` violation (run `npm run lint` to locate; full log at `~/AppData/Local/rtk/tee/1783407556_lint.log`), (2) immutability violations in `lib/office/components/OfficeCanvas.tsx` (ref mutations during render — move into effects/callbacks), `ToolOverlay.tsx`, `OnboardingWizard.tsx`, (3) 24 exhaustive-deps — add deps or restructure; verify each fix doesn't create fetch loops, (4) `react/no-children-prop` in `components/fleet/AgentTree.tsx` (pass children as JSX).
- Acceptance: `npm run lint` → 0 errors; app behavior unchanged (spot-check office canvas + affected pages in dev).

### Phase 3 — Improve (roadmap)

**Step 7 — Playwright e2e**: setup in `tests/e2e/` + `playwright.config.ts`; smoke flows from manual matrices in `tests/docs/*.md`: home load, chat send (gateway mocked), costs page, kanban. Acceptance: `npx playwright test` green, ≥4 flows.

**Step 8 — Decompose god components**: `app/memory/page.tsx` (3,269 lines) → tab sub-components (overview / browser / guide / health); extract message rendering from `components/chat/ConversationView.tsx` (1,181 lines). Behavior-preserving. Acceptance: no touched file >800 lines; lint clean; tests pass.

**Step 9 — DB hygiene**: indexes on `memory_entries(type, agent, created_at)`, `ds_reports(status)`; migration version table with applied-name tracking in `lib/db/schema.ts`. Acceptance: migrations idempotent on existing DB; `EXPLAIN QUERY PLAN` shows index use.

**Step 10 — Docs**: README rough-edges refresh (freeze fixed by step 5), env var table, degraded-mode behavior. Acceptance: README matches implemented behavior.

## Verification (run after each phase)

1. `npm run lint` — 0 errors by end of phase 2.
2. `npm test` — all green, count growing.
3. Manual with gateway STOPPED: chat page errors within 6s (no hang); AO page shows offline banner + cached data; `curl` `/api/system`, `/api/security`, `/api/agents`, `/api/identity` — grep responses for a known real token substring, expect none.
4. Step 5 check: trigger models-status refresh while navigating dashboard — no freeze.

## Notes for executor

- Windows machine (PowerShell). Watch for POSIX-only shell assumptions.
- Do NOT revert the uncommitted `lib/sanitize.ts` / `app/api/identity/route.ts` changes — they are the starting point of Step 1.
- Commit per step (conventional commits); keep changes surgical — no architecture rewrites needed.
