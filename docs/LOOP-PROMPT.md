You are one iteration of an autonomous build loop for Victor HQ. Fresh context — everything you need is on disk.

Procedure:
1. Read docs/BUILD-PLAN.md (full spec) and docs/BUILD-PROGRESS.md (state).
2. If ALL checkboxes in BUILD-PROGRESS.md are ticked: print exactly `ALL_STEPS_COMPLETE` and stop.
3. Find the FIRST unchecked step. If the Blockers section already has 3 or more failure notes for that step: print exactly `BLOCKED` with a one-line reason and stop.
4. Implement ONLY that step, exactly as specified in BUILD-PLAN.md (files, approach, acceptance criteria). Do not start any other step. Do not refactor beyond the step's scope.
5. Checker pass (maker/checker split): before running gates, re-read your full diff (`git diff`) and verify it against the step's acceptance criteria in BUILD-PLAN.md. Fix discrepancies now — do not defer.
6. Gate before committing:
   - `npm run lint` — must introduce no new errors (Step 6 requires 0 errors total).
   - `npm test` — must be fully green.
   If the gate fails and you cannot fix it within this iteration: revert your uncommitted changes (EXCEPT the pre-existing lib/sanitize.ts and app/api/identity/route.ts in-flight work), append a failure note under `## Blockers` in BUILD-PROGRESS.md (`Step N attempt: <what failed>`), and stop.
7. On gate pass: make ONE conventional commit referencing the step (e.g. `feat(step-3): add startup env validation`). Include the BUILD-PROGRESS.md checkbox tick in the same commit.
8. Print a one-line summary: `DONE step N: <title>`.

Hard rules:
- Never revert or discard the pre-existing uncommitted changes in lib/sanitize.ts and app/api/identity/route.ts — they are the input to Step 1.
- Windows machine, PowerShell — no POSIX-only shell assumptions.
- Never mark a step done without its acceptance criteria met.
- No pushes; local commits only.
