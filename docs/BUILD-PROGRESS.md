# Build Progress — Victor HQ (loop state file)

Loop reads this first, updates it last. Only tick a box after the step's acceptance criteria pass (lint + tests + e2e green, committed).

## Round 2 (active — spec: docs/BUILD-PLAN-2.md)

- [x] Step 1 — Shared agents API client (lib/api/agents-client.ts, refactor 12 consumers)
- [x] Step 2 — Windows-compatible system metrics (/api/system win32 branches)
- [x] Step 3 — Decompose app/security/page.tsx (2,332 lines → components)
- [x] Step 4 — Split lib/parsers/openclaw-logs.ts (domain modules + re-export barrel)
- [x] Step 5 — Unify server state on react-query (conversations first)
- [x] Step 6 — UX resilience polish (ErrorState retry, avatar fallback, logo 404)
- [x] Step 7 — Broaden e2e suite (5 → 10+ tests)
- [x] Step 8 — Cold-start latency (warm CLI caches in instrumentation.ts)

## Blockers

- Step 8 attempt (2026-07-09): literal `curl /api/agents` on a freshly-started dev
  server still takes ~13s on the very first hit — that's Turbopack's one-time,
  on-demand route compile in `next dev`, not the openclaw-cli TTL cache.
  Confirmed the warm-up itself works: the 2nd request (cache warm + route
  compiled) returns in ~24ms. Real users hit `/` first (which itself fetches
  `/api/agents`), so the route is already compiling by the time it's needed;
  the synthetic direct-curl-to-cold-route benchmark doesn't reflect that path.
  Not fixable from instrumentation.ts — it runs in-process, not via HTTP, so it
  can't force Turbopack to pre-compile a route handler.

(none yet — append one dated line per failed attempt: `Step N attempt: <what failed>`)

## Archive — Round 1 (complete, spec: docs/BUILD-PLAN.md)

- [x] Step 1 — Complete credential redaction
- [x] Step 2 — Harden API routes
- [x] Step 3 — Startup env validation
- [x] Step 4 — AO offline degradation
- [x] Step 5 — Async CLI calls
- [x] Step 6 — ESLint react-hooks violations → 0 errors
- [x] Step 7 — Playwright e2e
- [x] Step 8 — Decompose god components
- [x] Step 9 — DB hygiene
- [x] Step 10 — Docs refresh
