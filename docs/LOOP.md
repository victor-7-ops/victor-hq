# LOOP.md — Loops that maintain this repository

Convention from [loop-engineering](https://github.com/cobusgreyling/loop-engineering): this file describes the loops; `BUILD-PROGRESS.md` is the state they read/write.

## build-loop (active)

| Aspect | Value |
|---|---|
| Purpose | Execute `docs/BUILD-PLAN.md` step-by-step until dashboard fully functional |
| Driver | `scripts/build-loop.ps1` (fresh `claude -p` per iteration, Sonnet 5) |
| Prompt | `docs/LOOP-PROMPT.md` |
| State | `docs/BUILD-PROGRESS.md` (checkboxes + Blockers) |
| Verifier gates | `npm run lint` (no new errors) + `npm test` (green) — deterministic, model judgment never marks done |
| Maker/checker | Maker implements step; checker pass reviews own diff against acceptance criteria before commit |
| Circuit breaker | 3 failure notes on same step → `BLOCKED`; max 30 iterations |
| Rollout levels | L1 `-ReportOnly` (analyze + report, no edits) → L2 default with `acceptEdits` (Bash still gated by allowlist) → L3 unattended (`-Unattended`, skips permissions — only after L1/L2 trust built) |
| Human gate | Blockers section = escalation channel; loop stops, human resolves, restart |
| Kill switch | Ctrl+C driver; commit-per-step keeps history clean |

## Future loop candidates (not active)

- **post-merge cleanup** — lint/dead-code sweep after each merged step
- **PR babysitter** — once repo grows GitHub PR flow
