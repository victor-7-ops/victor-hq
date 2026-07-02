# Changelog

All notable changes to the OpenClaw Dashboard are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-03-19

### Breaking Changes
- Upgraded to Next.js 16, React 19, Tailwind CSS 4
- New design system (Apple-inspired glass aesthetic) replaces the previous dark theme
- Layout restructured with HeaderBar, Sidebar, and LiveStreamWidget
- Settings now managed via SettingsProvider context (localStorage-based)
- Moved from Tailwind v3 config file to v4 @theme tokens in CSS
- Radix UI primitives replaced with the unified `radix-ui` package

### Added
- **Multi-View Home Dashboard** — 4 switchable views: Org Map, Grid, Feed, and Constellation, giving operators multiple ways to monitor their fleet at a glance
- **Interactive Agent Chat** — Real-time SSE streaming chat with multimodal support (image uploads), per-agent conversation history, and slash command parsing (/help, /status, /cost, etc.)
- **Advanced Cost Analytics** — Token-level granularity, optimization scoring, cache savings estimation, anomaly detection, week-over-week trending, and per-model breakdown
- **Kanban Board** — Full agile board with columns (todo / in-progress / done / blocked), ticket chat threads, agent assignment, priority labels, and automation rules
- **Cron Pipeline Builder** — Visual DAG of job dependencies powered by @xyflow/react, execution history with cost tracking, delivery rules, and pipeline templates
- **Memory Health Monitor** — AI-driven health analysis, staleness detection, editing hints, reindex controls, and completeness checks
- **Rich Text Editor** — TipTap-based WYSIWYG editor supporting markdown, tables, code blocks, images, links, and text alignment
- **Reference File Management** — Document storage with rich text editing, tag-based organization, and full-text search
- **Competitor Intelligence** — Discovery, research, and profiling system for competitive analysis with per-competitor detail pages
- **Global Search** — Unified search across agents, crons, memory, costs, and all data types
- **Live Stream Widget** — Real-time activity log panel accessible from any page via the header bar
- **Agent Detail Pages** — Per-agent detail view with SOUL.md personality viewer, conversation history, and execution traces
- **Activity Console** — Browseable activity logs with filtering by source (cron, config, error)
- **Settings Page** — Full UI for accent color, portal branding, agent avatars, and operator profile configuration
- **Dynamic Favicon** — Theme-aware favicon that updates to match the selected accent color
- **Breadcrumb Navigation** — Context-aware breadcrumb trail across all pages
- **Mobile Sidebar** — Responsive hamburger menu for mobile and tablet viewports
- **Agent Avatars** — Custom profile images and emoji overrides per agent, stored and served via dedicated API route
- **SaaS-Grade Onboarding** — 10-step guided setup wizard for first-time users, replacing the previous 5-step wizard
- **DAG Visualization** — @xyflow/react powered dependency graphs for cron pipelines with interactive zoom and pan
- **SSE Streaming** — Server-Sent Events infrastructure for chat, logs, usage tracking, and pulse monitoring
- **Voice Features** — Text-to-speech via ElevenLabs and speech-to-text transcription endpoints
- **Slash Commands** — Chat command parser supporting /help, /status, /cost, and extensible custom commands
- **Release Tracker** — Dedicated releases page for tracking deployment history
- **Testing Framework** — Vitest integration with React Testing Library for unit and integration tests
- **Docker Support** — Updated multi-stage Dockerfile and docker-compose with volume mapping for persistence

### Improved
- **Design System** — Complete overhaul with Apple-inspired glass materials, CSS custom properties, and design tokens replacing the previous dark theme
- **Cost Tracking** — Evolved from basic per-agent charts to full optimization scoring with anomaly detection, cache savings estimation, and per-model breakdowns
- **Memory Browser** — Added health monitoring, AI-driven analysis, editing hints, and reindex controls on top of the existing log browser
- **Constellation View** — Enhanced with hover tooltips showing 24h stats, click-to-detail panels, and improved node drawing
- **Fleet Management** — Improved agent cards with context health bars, drift indicators, and execution trace timelines
- **Agent Registry** — Now purely discovery-based, auto-scans the OpenClaw workspace directory instead of requiring manual registration
- **Error Handling** — Consistent ErrorState component with retry actions deployed across all pages
- **Security Page** — Renamed from System Pulse, refined posture monitoring UI
- **Navigation** — Sidebar redesigned with grouped sections, feed count badges, and collapsible mobile support

### Changed
- Reorganized component structure (107 component files across fleet, constellation, kanban, chat, office, and shared directories)
- Database schema expanded with tables for kanban tickets, cost anomalies, reference files, competitor profiles, and conversation history
- API routes expanded from 25 to 52 endpoints covering chat, kanban, competitors, pipelines, avatars, voice, and more
- Switched from Zustand-only state to a hybrid of Zustand stores and React Context providers (SettingsProvider, QueryClientProvider)
- TanStack React Query upgraded to v5 for all data fetching with stale-time caching
- Recharts upgraded to v3 for cost and performance visualizations
- Zod upgraded to v4 for schema validation

## [1.1.0] - 2026-03-09

### Fixed
- Made gateway port configurable via `OPENCLAW_GATEWAY_PORT` environment variable
- Stripped screenshot metadata for privacy before committing to version control

## [1.0.0] - 2026-03-09

### Added
- Initial public release of OpenClaw Dashboard
- Agent fleet monitoring with constellation graph visualization
- Cost control dashboard with per-agent and per-provider attribution
- System Pulse for security posture monitoring (device tokens, OAuth, FileVault, git hooks)
- Memory log browser with full-text search
- Market intelligence feed with signal categorization and relevance scoring
- Tech updates radar with category filtering
- Practitioner signals aggregator (Reddit, forums, social platforms)
- Design system QA board with component-level fidelity scoring
- Agent office visualization (isometric pixel-art workspace)
- Todo/task manager with agent assignment and priority sorting
- Setup wizard (5-step initial configuration)
- Docker support with multi-stage build
- SQLite persistence via better-sqlite3
- SSE streams for real-time agent and system updates
- Daily brief digest connecting signals to project relevance
