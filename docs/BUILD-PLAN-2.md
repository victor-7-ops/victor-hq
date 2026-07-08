# Victor HQ — Build Plan Round 2 (handoff for executing agent)

Improvement round. Round 1 (docs/BUILD-PLAN.md) is fully executed and committed through `d5ed890`. Execute the 8 steps below in order; one step per iteration; acceptance criteria decide "done".

## Baseline (verified 2026-07-08)

- `npm run lint` → 0 errors, 0 warnings. `npm test` → 74/74 green. `npx playwright test` → 5/5 green.
- Dev server `npm run dev` on :3333. Windows 11 machine, PowerShell — no POSIX-only assumptions.
- Known measured issues: `/api/agents` first hit ~11.8s, `/api/system` ~15s (dev compile + cold CLI cache); swap/disk metrics report zeros on Windows (macOS-only commands); `logo.png` 404 on every page load.
- Round-1 patterns to imitate: decomposition style from commit `0a51d17` (memory page), error-state UX on `/agent-orchestrator` page, TTL cache in `lib/parsers/openclaw-cli.ts`, `errorMessage()` from `lib/api-error.ts`, redaction in `lib/sanitize.ts`.

## Steps

### Step 1 — Shared agents API client
Round 1 patched `{agents:[...]}` unwrapping at ~12 call sites (see commit `d5ed890` for full list: app/chat, app/kanban, app/memory, app/crons, app/agents/[id], app/page.tsx, components/OrgMap.tsx, CostsPage, NavLinks, GlobalSearch, settings, OnboardingWizard). Root-cause it:
- New `lib/api/agents-client.ts`: `fetchAgents(): Promise<Agent[]>` — fetch `/api/agents`, unwrap `{agents}`, normalize `reportsTo`/`directReports` from `parentId` (logic exists in `app/page.tsx:132-146` — move it here).
- Refactor every consumer from commit `d5ed890` to use it; delete scattered unwraps.
- Unit tests for the normalizer (orphan parentId, null parentId, cycles safe).
- Acceptance: one source of truth; all touched pages render in browser; vitest green.

### Step 2 — Windows-compatible system metrics
`app/api/system/route.ts` uses macOS-only commands (`top -l`, `sysctl vm.swapusage`, `df -k /`, `pgrep`) — silently zero on Windows.
- Branch on `os.platform()`: win32 paths via PowerShell one-liners (`Get-CimInstance Win32_PageFileUsage` for swap, `Get-PSDrive C` or `Get-CimInstance Win32_LogicalDisk` for disk, `Get-Process` for gateway pid) or pure `os`-module where possible. Keep darwin paths intact.
- Use async exec (follow `lib/parsers/openclaw-cli.ts` pattern), not execSync.
- Acceptance: on Windows `/api/system` returns non-zero disk + swap totals; warm response < 3s.

### Step 3 — Decompose app/security/page.tsx (2,332 lines)
Same treatment as memory page (commit `0a51d17`): split sections into `app/security/components/`. Behavior-preserving, no logic changes.
- Acceptance: no touched file > 800 lines; lint clean; page renders all sections in browser.

### Step 4 — Split lib/parsers/openclaw-logs.ts (1,184 lines)
Split by domain into `lib/parsers/logs/` modules (agents, devices + security-posture, main-config). Keep `lib/parsers/openclaw-logs.ts` as re-export barrel so consumers don't change.
- Acceptance: parser tests pass; no consumer import edits needed; each new module < 500 lines.

### Step 5 — Unify server state on react-query (conversations first)
Zustand + react-query both hold server state (drift risk). Keep zustand for pure UI state only.
- Move conversation fetching from `lib/conversation-store.ts` to a react-query hook in `hooks/` (project already uses @tanstack/react-query v5 — follow existing useQuery patterns, e.g. agent-orchestrator page).
- Streaming updates keep writing through query cache (`queryClient.setQueryData`) or local state — do not break SSE chat streaming.
- Acceptance: chat send + stream works in browser; conversation list consistent after send; no duplicate fetches of same endpoint on chat page load; tests pass.

### Step 6 — UX resilience polish
- (a) Retry buttons on error states: competitors page + chat page. Reuse/extract the error-state component from `/agent-orchestrator` page into `components/ErrorState.tsx`.
- (b) `app/api/avatar/[agentId]/route.ts`: return generated fallback SVG (initials) when avatar file missing, correct content-type.
- (c) Fix `logo.png` 404 on every page load — add the asset or remove the reference.
- Acceptance: retry buttons refetch on click; no broken avatar images; zero 404s in network tab on home load.

### Step 7 — Broaden e2e suite (5 → 10+)
Extend `tests/e2e/` using manual matrices in `tests/docs/02-FLEET-COSTS-MEMORY-TEST-CASES.md` and `03-CRONS-KANBAN-SECURITY-TEST-CASES.md`:
- memory page tab switching, security page renders sections, agent-orchestrator offline banner, todos CRUD (mock API), global search open + query.
- Acceptance: `npx playwright test` ≥ 10 tests, all green locally.

### Step 8 — Cold-start latency
- In `instrumentation.ts` (exists since round-1 step 3): fire-and-forget warm of the openclaw-cli TTL caches (models status, sessions) at server start.
- Acceptance: after dev server ready + 30s, first `/api/agents` responds < 2s.

## Verification gates (every iteration)
1. `npm run lint` → 0 errors, 0 warnings.
2. `npm test` → 74+ green (growing with steps 1, 5).
3. `npx playwright test` → green (5+; 10+ from step 7 on).
4. Step-specific acceptance above; browser spot-check via :3333.

## Executor rules
- One step per iteration, one conventional commit per step (`feat(r2-step-N): ...` / `refactor(r2-step-N): ...`).
- Behavior-preserving refactors (steps 3, 4) must not change rendered output.
- Windows/PowerShell environment. No pushes; local commits only.
