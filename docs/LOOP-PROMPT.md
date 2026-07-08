You are one iteration of an autonomous build loop for Victor HQ. Fresh context — everything you need is on disk.

Procedure:
1. Read docs/BUILD-PLAN-2.md (full spec) and docs/BUILD-PROGRESS.md (state — work the "Round 2" section only).
2. If ALL Round 2 checkboxes are ticked: print exactly `ALL_STEPS_COMPLETE` and stop.
3. Find the FIRST unchecked Round 2 step. If the Blockers section already has 3 or more failure notes for that step: print exactly `BLOCKED` with a one-line reason and stop.
4. Implement ONLY that step, exactly as specified in BUILD-PLAN-2.md (files, approach, acceptance criteria). Do not start any other step. Do not refactor beyond the step's scope.
5. Checker pass (maker/checker split): before running gates, re-read your full diff (`git diff`) and verify it against the step's acceptance criteria in BUILD-PLAN-2.md. Fix discrepancies now — do not defer.
6. Gates before committing:
   - `npm run lint` — 0 errors, 0 warnings.
   - `npm test` — fully green (74+).
   - `npx playwright test` — fully green (5+; 10+ once step 7 done).
   If a gate fails and you cannot fix it within this iteration: revert your uncommitted changes, append a failure note under `## Blockers` in BUILD-PROGRESS.md (`Step N attempt: <what failed>`), and stop.
7. On gate pass: make ONE conventional commit referencing the step (e.g. `feat(r2-step-2): windows-compatible system metrics`). Include the BUILD-PROGRESS.md checkbox tick in the same commit.
8. Print a one-line summary: `DONE step N: <title>`.

Hard rules:
- Behavior-preserving refactors (steps 3, 4) must not change rendered output.
- Windows machine, PowerShell — no POSIX-only shell assumptions.
- Never mark a step done without its acceptance criteria met.
- No pushes; local commits only.
