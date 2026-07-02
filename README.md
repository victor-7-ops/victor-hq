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

## Known rough edges

- `openclaw models status` can be slow on this machine (expired-token check adds latency) — cached aggressively to stop it from freezing the dev server, but the underlying slowness isn't fixed
- Windows-specific: shell redirects and env var handling were patched for PowerShell/cmd, might not match upstream behavior on Mac/Linux

## Not public-repo boilerplate

This isn't meant to be a polished template for other people — it's wired to my own OpenClaw config, agent roster, and vault paths. Forking the original [openclaw-dashboard](https://github.com/ChristianAlmurr/openclaw-dashboard) is the better starting point if you want a clean base.
