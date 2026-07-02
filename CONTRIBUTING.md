# Contributing to OpenClaw Dashboard

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/ChristianAlmurr/openclaw-dashboard
   cd openclaw-dashboard
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local — set OPENCLAW_HOME to your ~/.openclaw path
   ```

4. **Run the dev server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3333](http://localhost:3333)

## Project Structure

```
app/                    # Next.js 16 App Router pages
  api/                  # API routes (REST endpoints)
  agents/               # Agent management UI
  chat/                 # Chat interface
  competitors/          # Competitor research dashboard
  costs/                # Cost tracking
  crons/                # Cron job management
  fleet/                # Fleet overview
  kanban/               # Task board
  office/               # Office layout / agent workspace
  settings/             # Dashboard settings
  ...
components/             # Shared React components
  ui/                   # Radix/shadcn primitives
lib/                    # Core utilities
  db/                   # SQLite database layer (schema + queries)
scripts/                # CLI utilities (setup, backfill, db-harden)
public/                 # Static assets
```

## Tech Stack

- **Framework**: Next.js 16 (App Router, React Server Components)
- **UI**: Tailwind CSS v4, Radix UI, shadcn/ui, Recharts, XY Flow
- **Database**: SQLite via better-sqlite3
- **State**: Zustand, TanStack React Query
- **Editor**: TipTap rich text editor
- **Language**: TypeScript (strict mode)

## Pull Request Process

1. Fork the repository and create a feature branch from `main`
2. Make your changes with clear, focused commits
3. Ensure `npm run build` passes without errors
4. Run `npm run lint` and fix any issues
5. Run `npm run test` if you changed logic with test coverage
6. Open a PR with a clear description of what changed and why

## Code Style

- TypeScript throughout (strict mode)
- Tailwind CSS for styling — use design tokens from `globals.css`
- React Server Components by default; add `'use client'` only when needed
- Keep components focused and composable
- Use `lib/` for shared logic, `components/ui/` for primitives

## Reporting Bugs

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Browser/OS/Node version
- Screenshots if applicable

## Feature Requests

Open an issue tagged `enhancement` describing the use case and proposed solution.
