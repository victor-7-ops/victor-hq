/**
 * Safely retrieve a required environment variable at runtime.
 * Call inside functions (not at module top level) so imports don't crash during build/test.
 */
export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
      `See .env.example for configuration.`
    )
  }
  return value
}

/** OpenClaw gateway port -- reads OPENCLAW_GATEWAY_PORT, defaults to 18789. */
export function gatewayPort(): number {
  return parseInt(process.env.OPENCLAW_GATEWAY_PORT || '18789', 10)
}

/** OpenClaw gateway base URL for the OpenAI-compatible API (e.g. http://localhost:18789/v1). */
export function gatewayBaseUrl(): string {
  return `http://localhost:${gatewayPort()}/v1`
}

// ---------------------------------------------------------------------------
// Startup environment validation
// ---------------------------------------------------------------------------
//
// OPENCLAW_HOME is the only hard requirement -- everything else degrades
// gracefully (a feature turns off / falls back) rather than crashing.

export type EnvSeverity = 'error' | 'warning'

export interface EnvIssue {
  variable: string
  severity: EnvSeverity
  message: string
}

export interface EnvValidationResult {
  ok: boolean
  issues: EnvIssue[]
}

/** Validate required/optional env vars. Pure function -- no process.exit, no console output. */
export function validateEnv(env: NodeJS.ProcessEnv = process.env): EnvValidationResult {
  const issues: EnvIssue[] = []

  if (!env.OPENCLAW_HOME) {
    issues.push({
      variable: 'OPENCLAW_HOME',
      severity: 'error',
      message:
        'OPENCLAW_HOME is not set. This is the path to your OpenClaw data directory ' +
        '(usually ~/.openclaw). Set it in .env.local -- see .env.local.example.',
    })
  }

  if (!env.WORKSPACE_PATH) {
    issues.push({
      variable: 'WORKSPACE_PATH',
      severity: 'warning',
      message:
        'WORKSPACE_PATH is not set. Pipeline editing (POST /api/pipelines) will be ' +
        'disabled until it is set in .env.local.',
    })
  }

  if (!env.OPENCLAW_BIN) {
    issues.push({
      variable: 'OPENCLAW_BIN',
      severity: 'warning',
      message:
        'OPENCLAW_BIN is not set -- falling back to "openclaw" on PATH. Set it in ' +
        '.env.local if the CLI is not globally available.',
    })
  }

  if (!env.OPENCLAW_GATEWAY_TOKEN) {
    issues.push({
      variable: 'OPENCLAW_GATEWAY_TOKEN',
      severity: 'warning',
      message:
        'OPENCLAW_GATEWAY_TOKEN is not set (and not found in ~/.openclaw/secrets/.env). ' +
        'Chat, TTS, and transcription features will be disabled until it is configured.',
    })
  }

  return {
    ok: !issues.some((i) => i.severity === 'error'),
    issues,
  }
}

/** Format a validation result as human-readable lines for console output. */
export function formatEnvIssues(result: EnvValidationResult): string[] {
  return result.issues.map(
    (issue) => `[env] ${issue.severity.toUpperCase()} ${issue.variable}: ${issue.message}`,
  )
}
