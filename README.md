# Victor HQ

My personal command centre for running AI agents day-to-day: one dashboard to see what's happening, chat with agents, and (eventually) let GitHub issues turn into PRs on their own.

Built on top of [OpenClaw](https://openclaw.ai), originally forked from [ChristianAlmurr/openclaw-dashboard](https://github.com/ChristianAlmurr/openclaw-dashboard) and reworked for my own setup.

## What's actually in here

- **Org chart + chat** — Ada (CEO), Rowan (Ops), Nova (Research), Iris (Comms), all routed through the OpenClaw gateway to real Claude models. Talk to any of them from the Map view.
- **Agent Orchestrator integration** (`/agent-orchestrator`) — live board (Working / Needs You / In Review / Ready to Merge) synced over SSE with [Agent Orchestrator](https://github.com/AgentWrapper/agent-orchestrator), a separate desktop app that runs coding agents in isolated git worktrees. Register a repo, spawn a session, send it a message, kill it — all from here.
- **CEO delegation framework** — `.claude/agents/*.md`, real Claude Code subagents (developer, pm, qa, analytics, marketer, ux-expert, writer, prepper) for on-demand task breakdown, invoked via the `Agent` tool.
- **Obsidian vault memory** — anything the CEO agents write (specs, research, QA reports) lands directly in my vault via directory junctions, not buried in a `docs/` folder nobody opens.
- Everything else that shipped with the original dashboard: crons, activity feed, cost tracking, memory health, kanban.

## Running it

```bash
npm install
cp .env.local.example .env.local
# fill in OPENCLAW_HOME, WORKSPACE_PATH, OPENCLAW_BIN, OPENCLAW_GATEWAY_TOKEN
npm run dev
```

Opens on `http://localhost:3333`. Needs a running OpenClaw gateway (`openclaw gateway start`) and, for the Agent Orchestrator page, the Agent Orchestrator desktop app running in the background.

At startup, `instrumentation.ts` validates env vars (`lib/env.ts`) and logs any issues to the console — see the table below for what's required vs. optional.

### Environment variables

| Variable | Required? | What it does if missing |
|---|---|---|
| `OPENCLAW_HOME` | **Required** | Startup validation logs a clear error (server still boots, degraded). Path to your OpenClaw data directory, usually `~/.openclaw`. |
| `WORKSPACE_PATH` | Optional | Pipeline editing (`POST /api/pipelines`) is disabled. |
| `OPENCLAW_BIN` | Optional | Falls back to `openclaw` on `PATH`. |
| `OPENCLAW_GATEWAY_TOKEN` | Optional | Falls back to `~/.openclaw/secrets/.env`; if still unset, chat/TTS/transcription are disabled. |
| `OPENCLAW_GATEWAY_PORT` | Optional | Defaults to `18789`. |
| `PROJECT_REPO_PATH` | Optional | Disables sprint/task parsing from a project repo. |
| `GITHUB_PAT` | Optional | Disables GitHub integration. |
| `COMPETITOR_PRODUCT_CONTEXT` | Optional | Falls back to a generic placeholder for competitor research prompts. |
| `ELEVENLABS_API_KEY` | Optional | Disables text-to-speech for agents. |
| `DATA_DIR` | Optional | Defaults to `~/.openclaw-dashboard` for the SQLite database. |
| `PORT` | Optional | Defaults to `3333`. |

See `.env.local.example` for the full annotated list.

Tests: `npm test` (vitest, unit, 85 tests) and `npx playwright test` (e2e smoke flows in `tests/e2e/`, 10 specs covering home, chat, kanban, costs, memory, security, and agent-orchestrator).

## Degraded-mode behavior

Built to stay usable when its dependencies aren't running, rather than hang or crash:

- **OpenClaw gateway offline** — chat, TTS, transcribe, and competitor-research routes time out after 5s and return a JSON error instead of hanging; the chat UI shows a clear failure message.
- **Agent Orchestrator daemon offline** — `/agent-orchestrator` shows cached project/session data (dimmed, with a "not running — showing cached data" banner + Retry) instead of spinning forever; with no cache yet, it shows a clear "not running" state.
- **`openclaw` CLI missing/slow** — model/session status calls run asynchronously (no more `execSync`) and are cached; `instrumentation.ts` fire-and-forget warms those caches at server start so the first real request doesn't pay the cold-CLI tax.
- **Credentials in API responses** — config/posture data that could contain API keys or tokens is redacted (`lib/sanitize.ts`) before it reaches the client.
- **Agent avatar missing** — `/api/avatar/[agentId]` returns a generated initials SVG instead of a 404, so avatars never render broken.

## Known rough edges

- Windows-specific: shell redirects and env var handling were patched for PowerShell/cmd, might not match upstream behavior on Mac/Linux

## Not public-repo boilerplate

This isn't meant to be a polished template for other people — it's wired to my own OpenClaw config, agent roster, and vault paths. Forking the original [openclaw-dashboard](https://github.com/ChristianAlmurr/openclaw-dashboard) is the better starting point if you want a clean base.
